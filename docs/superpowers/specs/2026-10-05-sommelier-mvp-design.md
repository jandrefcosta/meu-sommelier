# Meu Sommelier — Design do MVP

> Data: 2026-10-05 · Status: **aguardando revisão** · Backlog de produto: [`docs/produto/backlog-mvp.md`](../../produto/backlog-mvp.md)

## 1. Entendimento e objetivo

**O que foi pedido (PO):** a partir da foto de um vinho, obter preço médio no Brasil, ano ideal para abrir, guarda máxima segura, tempo de decantação e harmonização. Duas abas: **Adega** (lista no estilo da nota atual do Keep) e **O que abrir** (a pessoa diz o que vai comer e o app sugere a garrafa).

**Decisões tomadas no brainstorming:**

| Tema | Decisão |
|---|---|
| Público | O casal + amigos/família: **várias adegas isoladas**, com convites |
| Plataforma | **PWA agora**, app nativo depois. A API REST e o domínio ficam separados da UI |
| Preço | **IA + busca na web**, exibido como estimativa com fontes e data |
| Stack | **TypeScript full-stack** |
| Hospedagem | **Railway**: serviço web + PostgreSQL + Bucket S3 |
| IA | **Multi-provedor**: Anthropic direto ou endpoint OpenAI-compatível (omnirouter, OpenRouter, LiteLLM), configurável por capacidade |
| Foto | Câmera nativa do celular (`capture`) **ou** galeria |

**Critérios de sucesso do MVP:** a lista atual do Keep foi migrada; cadastrar por foto leva menos de 30 s de interação do usuário (sem contar a espera da IA, que tem limite de 45 s); o casal usa "O que abrir" no dia a dia.

### Escopo

**Dentro:** US-01, 02, 03, 04, 05, 06, 07, 09, 10, 12, 12b, 13, 14 do backlog.
**Fora:** US-08 (busca/filtros), US-11 (conversa), Diário de Degustação (E5), Lista de Desejos (E6), câmera dentro do app com moldura, cache de fichas entre adegas, limpeza de fotos órfãs, Sentry, RLS no Postgres, login por link mágico.

## 2. Arquitetura

```
Railway
├─ web          Next.js (App Router): PWA + rotas REST /api/*
├─ PostgreSQL   plugin nativo
└─ Bucket       S3-compatível, privado (fotos dos rótulos)

Monorepo pnpm (repositório: meu-sommelier)
apps/web          @meu-sommelier/web   UI, route handlers, casos de uso, composição de dependências
packages/core     @meu-sommelier/core  domínio puro: tipos, schemas zod, regras (sem I/O)
packages/ai       @meu-sommelier/ai    portas Sommelier/ModeloLLM/BuscaPrecos + adaptadores + fakes
packages/db       @meu-sommelier/db    Drizzle: schema, migrations, repositórios com escopo de adega
```

**Dependências entre pacotes:** `web → core, ai, db`; `ai → core`; `db → core`. O `core` não depende de nada do projeto.

**Bibliotecas:** Next.js, React, zod, Drizzle ORM, Better Auth (plugin *organization*), `@anthropic-ai/sdk`, `openai` (cliente para endpoints compatíveis), `@aws-sdk/client-s3`, pino, Vitest, MSW, PGlite, fast-check, Playwright.

**Camadas no servidor:** o *route handler* valida a entrada com zod; o *caso de uso* orquestra repositório, IA e storage via dependências injetadas (`criarDependencias()`); o `core` aplica as regras. O "ano atual" e o "agora" sempre usam o fuso `America/Sao_Paulo` e vêm de um `Relogio` injetável.

## 3. Domínio e dados

### 3.1 Adega e membros
Uma **adega** é uma *organization* do Better Auth. Membros e convites usam as tabelas do Better Auth (`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`). No primeiro login, o app cria automaticamente "Adega de {primeiro nome}" e a define como ativa.

### 3.2 Tabela `item_adega`
Cada linha representa um vinho+safra dentro de uma adega, com a ficha embutida e editável.

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid PK | |
| `adega_id` | text FK → organization | indexado; presente em toda consulta |
| `nome` | text | obrigatório, 1–200 caracteres |
| `produtor` | text null | |
| `safra` | int null | null = sem safra (NV) |
| `tipo` | enum `tinto, branco, rose, espumante, sobremesa, fortificado` | |
| `uvas` | text[] | pode ser vazio |
| `pais`, `regiao` | text null | |
| `preco_min_centavos`, `preco_max_centavos` | int null | BRL; ambos nulos = "não consultado"; min ≤ max |
| `preco_fontes` | jsonb | `[{loja, url, precoCentavos}]`, pode ser vazio |
| `preco_consultado_em` | timestamptz null | |
| `abrir_de` | int | 🎯 ano inicial |
| `abrir_ate` | int null | fim da faixa 🎯 (ex.: 2027–2028); null = ano único |
| `guarda_ate` | int | ⏳; `guarda_ate ≥ (abrir_ate ?? abrir_de)` |
| `decantar_min`, `decantar_max` | int null | minutos; ambos nulos = "Não necessário"; min ≤ max |
| `harmonizacoes` | text[] | 🥩, 1–5 itens |
| `quantidade` | int | ≥ 0; 0 = "Já bebemos" |
| `foto_key` | text null | chave no Bucket |
| `origem` | enum `foto, nome, importacao, manual` | |
| `chave_duplicata` | text | `chaveDuplicata(nome, safra)`; **índice único `(adega_id, chave_duplicata)`** |
| `criado_por` | text FK → user | |
| `criado_em`, `atualizado_em` | timestamptz | |

### 3.3 Tabela `uso_ia`
`id, adega_id, usuario_id, tipo (rotulo | nome | prato | preco), provedor, modelo, tokens_entrada, tokens_saida, custo_usd numeric null, sucesso bool, criado_em`. É a base dos limites e da tela de uso.

### 3.4 Regras puras (`packages/core`)
- `FichaVinhoSchema` (zod) é o **único schema** da ficha: valida a saída da IA, o corpo da API e o formulário. `FichaVinho` cobre os campos da 3.2 de `nome` até `harmonizacoes`.
- `statusConsumo(item, anoAtual)`, avaliado nesta ordem:
  - `anoAtual > guarda_ate` → `passou` 🔴
  - `anoAtual === guarda_ate` → `abrir_logo` 🟠
  - `anoAtual < abrir_de` → `aguardar` 🔵
  - caso contrário → `no_ponto` 🟢
- `ordenarAdega(itens, anoAtual)`: grupo `quantidade > 0` na ordem `passou, abrir_logo, no_ponto, aguardar`, com desempate por `abrir_de` e depois `nome`. Em seguida vem o grupo "Já bebemos" (`quantidade = 0`), por `atualizado_em` decrescente.
- `chaveDuplicata(nome, safra)`: minúsculas, sem acentos, espaços colapsados, `|`, e a safra ou `nv`.
- `parseListaKeep(texto) → { importados: FichaVinho[], falhas: { linha: number, texto: string, motivo: string }[] }`, aplicado linha a linha. Linhas vazias são ignoradas; qualquer outra linha não reconhecida vai para `falhas`.
- `formatarLinhaKeep(ficha) → string`, a inversa do parse, usada nos testes de ida e volta e na exibição.
- `horaDeAbrir(horaRefeicao: "HH:MM", decantarMax: number | null) → "HH:MM" | null`.
- `filtrarSugestoes(sugestoesIA, idsEnviados)`: descarta `itemId` que não estejam na lista enviada e devolve no máximo 3.
- `CodigoErro`: enum fechado com os códigos da seção 6.

**Formato Keep aceito** (exemplos reais da PO):
```
Château Labadie Médoc Cru Bourgeois (2020) | 💵 R$ 220–280 | 🎯 2026 (⏳ 2030) | 🍷 Decantar: 30–45 min | 🥩 Estrogonofe de carne, corte de novilho grelhado
Perez Cruz Gran Reserva Cabernet Sauvignon (2024) | 💵 R$ 130–180 | 🎯 2027–2028 (⏳ 2033) | 🍷 Decantar: 45 min | 🥩 Churrasco, bife de tira, carnes vermelhas grelhadas
Salentein Reserva Pinot Noir (2023) | 💵 R$ 160–220 | 🎯 2026 (⏳ 2029) | 🍷 Decantar: Não necessário | 🥩 Capellini com cogumelos e ricota, frango assado com ervas
```
O parser aceita "–" ou "-" nas faixas e espaços variáveis. Itens importados entram com `tipo` `tinto` quando não for possível inferir, `quantidade` 1 e `origem` `importacao`; tudo isso pode ser editado na prévia.

## 4. IA

### 4.1 Portas (`packages/ai`)
```ts
interface Sommelier {
  lerRotulo(img: { bytes: Uint8Array; mime: string }): Promise<ResultadoFicha>
  fichaPorNome(texto: string): Promise<ResultadoFicha>
  sugerirParaPrato(p: { prato: string; adega: ItemResumo[] }): Promise<ResultadoSugestao>
}
type ResultadoFicha =
  | { ok: true; ficha: FichaVinho; precoConsultado: boolean; usos: UsoIA[] }
  | { ok: false; motivo: "nao_e_vinho" | "ilegivel" | "indisponivel"; usos: UsoIA[] }
type ResultadoSugestao =
  | { ok: true; sugestoes: { itemId: string; motivo: string; decantarMin: number | null }[];
      semBoaOpcao: { estiloIdeal: string } | null; usos: UsoIA[] }
  | { ok: false; motivo: "indisponivel"; usos: UsoIA[] }

interface ModeloLLM {
  gerarJson<T>(p: { instrucoes: string; texto: string; imagem?: { bytes: Uint8Array; mime: string };
                    schema: z.ZodType<T>; timeoutMs: number }): Promise<{ dados: T; uso: UsoIA }>
  readonly suportaImagem: boolean
}
interface BuscaPrecos {
  buscar(p: { nome: string; safra: number | null }):
    Promise<{ ok: true; min: number; max: number; fontes: FontePreco[]; uso: UsoIA | null }
          | { ok: false; uso: UsoIA | null }>
}
type UsoIA = { tipo: "rotulo" | "nome" | "prato" | "preco"; provedor: string; modelo: string;
               tokensEntrada: number; tokensSaida: number; custoUsd: number | null }
```
`ItemResumo` contém `id, nome, safra, tipo, uvas, status, decantar_min, decantar_max, harmonizacoes`.

### 4.2 Adaptadores
- `AnthropicLLM`: usa `@anthropic-ai/sdk` com saída estruturada (`output_config.format`) gerada a partir do schema zod e `fallbacks: "default"`. Modelo padrão `claude-opus-5-5`.
- `OpenAICompativelLLM`: SDK `openai` com `baseURL` configurável. Usa `response_format: json_schema` quando `OPENAI_COMPAT_JSON_SCHEMA=true`; caso contrário, pede o JSON nas instruções.
- `BuscaPrecosAnthropic`: Claude com `web_search_20260209`, `max_uses: 3` e `user_location` no Brasil. Extrai faixa e fontes.
- `BuscaPrecosApiBusca`: API de busca (Tavily) + `ModeloLLM` para extrair os preços.
- `SemBuscaPrecos`: sempre `{ ok: false }`.
- `FakeLLM`, `FakeBuscaPrecos`, `FakeSommelier`: respondem a partir de fixtures JSON.
- `SommelierPadrao(llmRotulo, llmPrato, buscaPrecos)`: implementa `Sommelier` sobre as portas. Gera a ficha e, se ela der certo, busca o preço. Se a busca falhar, a ficha volta com `precoConsultado: false` e os campos de preço nulos.

**Regras comuns:** todo `gerarJson` valida a resposta com zod e, em caso de falha, faz **1 nova tentativa** enviando o erro de validação; se falhar de novo, lança `ErroIA("indisponivel")`. O SDK já faz até 2 retentativas para 429/5xx/rede. Os timeouts são 45 s para rótulo/nome (incluindo preço) e 20 s para prato. Prompts ficam em arquivos `.md` versionados em `packages/ai/prompts/`, em pt-BR, e tratam o conteúdo do usuário como dado.

**Sugestão para prato:** o app envia apenas os itens com `quantidade > 0`, já com `status` calculado. A instrução manda preferir `abrir_logo`/`no_ponto`/`passou` a `aguardar` e avisar quando a melhor opção estiver em `aguardar`. A saída passa por `filtrarSugestoes`. Se não restar nada, `semBoaOpcao` vem preenchido.

### 4.3 Configuração (variáveis de ambiente)
```
IA_ROTULO=anthropic:claude-opus-5-5        # formato provedor:modelo; provedores: anthropic | openai-compat | fake
IA_PRATO=anthropic:claude-opus-5-5
IA_PRECO_BUSCA=anthropic                   # anthropic | api-busca | nenhuma | fake
IA_PRECO_MODELO=claude-opus-5-5
ANTHROPIC_API_KEY=
OPENAI_COMPAT_BASE_URL=
OPENAI_COMPAT_API_KEY=
OPENAI_COMPAT_JSON_SCHEMA=true
OPENAI_COMPAT_SUPORTA_IMAGEM=true
TAVILY_API_KEY=
```
`carregarConfigIA(env)` valida tudo com zod **na subida da aplicação** e falha com mensagem clara quando falta chave ou quando o modelo de `IA_ROTULO` não suporta imagem.

## 5. API e fluxos

Rotas REST JSON. O Better Auth fica montado em `/api/auth/*`. Toda rota sob `/api/adegas/:adegaId/*` chama `exigirMembro(adegaId, sessao)` antes de qualquer outra coisa: sem sessão responde **401**, sem ser membro responde **404**.

| Método e rota | Entrada | Saída | História |
|---|---|---|---|
| `POST /api/adegas/:id/leituras` | multipart `foto` | `200 {ficha, fotoKey, precoConsultado}` · erros da seção 6 | US-01 |
| `POST /api/adegas/:id/leituras/nome` | `{texto}` (1–200) | `200 {ficha, precoConsultado}` | US-03 |
| `GET /api/adegas/:id/itens?bebidos=true\|false` | — | `200 {itens: (Item & {status})[]}` ordenados por `ordenarAdega` | US-04 |
| `POST /api/adegas/:id/itens` | `{ficha, quantidade≥1, fotoKey?, origem, somarSeDuplicado?: boolean}` | `201 {item}` · `409 {erro: DUPLICADO, duplicadoDe: id}` · com `somarSeDuplicado=true`, `200 {item}` com a quantidade somada | US-02 |
| `GET /api/adegas/:id/itens/:itemId` | — | `200 {item, fotoUrl?}` | US-06 |
| `PATCH /api/adegas/:id/itens/:itemId` | campos parciais de ficha + `quantidade` | `200 {item}` | US-06 |
| `DELETE /api/adegas/:id/itens/:itemId` | — | `204` | US-06 |
| `POST /api/adegas/:id/itens/:itemId/consumo` | `{delta: -1 \| 1}` | `200 {item}` (quantidade nunca < 0) | US-05, US-10 |
| `GET /api/adegas/:id/itens/:itemId/foto` | — | `302` para URL assinada (10 min) · `404` sem foto | US-06 |
| `POST /api/adegas/:id/importacoes/keep` | `{texto, confirmar: boolean, itens?: FichaVinho[]}` | `confirmar=false` → `200 {importados, falhas}`; `confirmar=true` → grava os `itens` (prévia editada) numa transação → `201 {criados}` | US-07 |
| `POST /api/adegas/:id/sugestoes` | `{prato (1–200), horaRefeicao?: "HH:MM"}` | `200 {sugestoes: [{item, motivo, decantarMin, abrirAs}], semBoaOpcao}` · com a adega vazia, `200` e `sugestoes: []` + `adegaVazia: true`, sem chamar a IA | US-09 |
| `GET /api/adegas/:id/uso` | — | `200 {mes, leituras, sugestoes, custoUsd, limites}` | US-14 |

**Convites (US-12/12b):** usam o fluxo de convite do Better Auth. Em Configurações → Membros, o membro informa o e-mail do convidado e a UI mostra o link `/convite/:id` para copiar ou compartilhar no WhatsApp. O envio por e-mail fica desligado no MVP. Quem abre o link faz login com Google usando aquele e-mail e passa a ser membro da adega. Para "ter a própria adega" basta acessar o app: o primeiro login cria uma.

**Login:** Google OAuth. Login por e-mail e senha existe **apenas** com `NODE_ENV=test`, para o E2E.

**Telas (PWA, mobile-first):**
- Abas inferiores **🍷 Adega** e **🍽️ O que abrir**, com o botão flutuante **📷 Ler rótulo**.
- Menu com Membros, Importar do Keep, Uso do mês e Sair.
- "Ler rótulo" oferece **📷 Tirar foto** (`<input type="file" accept="image/*" capture="environment">`) e **🖼️ Escolher da galeria** (sem `capture`), além de "Digitar o nome".
- A tela de revisão mostra todos os campos editáveis, com o 💵 marcado como "estimativa de dd/mm" e as fontes clicáveis.
- Cada item da Adega usa o formato Keep acrescido do selo de status.
- `manifest.webmanifest`, ícones e um service worker mínimo permitem a instalação (US-13). Não há modo offline no MVP.

## 6. Erros, limites e custos

**Formato:** `{ "erro": { "codigo": CodigoErro, "mensagem": string pt-BR } }`. Stack traces nunca chegam ao cliente.

| `codigo` | HTTP | Quando |
|---|---|---|
| `NAO_AUTENTICADO` | 401 | sem sessão |
| `NAO_ENCONTRADO` | 404 | adega de que o usuário não é membro, item inexistente |
| `ENTRADA_INVALIDA` | 400 | falha na validação zod (inclui `detalhes`) |
| `FOTO_INVALIDA` | 400 | tipo real (magic bytes) diferente de jpeg/png/webp, ou mais de 5 MB |
| `ROTULO_NAO_RECONHECIDO` | 422 | IA devolveu `nao_e_vinho`/`ilegivel` |
| `DUPLICADO` | 409 | mesmo `(adega_id, chave_duplicata)` |
| `LIMITE_IA_MES` | 429 | limite mensal da adega atingido (mensagem informa a data de renovação, dia 1º) |
| `MUITAS_REQUISICOES` | 429 | mais de 10 chamadas de IA por usuário em 60 s |
| `IA_ORCAMENTO_ESGOTADO` | 503 | teto global de custo do mês atingido |
| `IA_INDISPONIVEL` | 503 | provedor fora do ar, timeout ou JSON inválido após nova tentativa |

**Limites (variáveis de ambiente):** `LIMITE_LEITURAS_MES=60` (rótulo + nome), `LIMITE_SUGESTOES_MES=200`, `LIMITE_IA_POR_MINUTO=10`, `IA_ORCAMENTO_MENSAL_USD=20`. A contagem usa `uso_ia` no mês corrente, no fuso de São Paulo. O limite é verificado **antes** de chamar a IA, e chamadas que falham também são registradas.

**Fotos:** o navegador redimensiona a imagem para no máximo 1500 px no maior lado e converte para JPEG com qualidade 0,85 antes do upload, o que também resolve o HEIC do iPhone. A chave no Bucket é `adegas/{adegaId}/rotulos/{uuid}.jpg`. A foto é gravada **no momento da leitura**; as órfãs ficam (limpeza fora do escopo).

**Concorrência:** o consumo é feito com `UPDATE ... SET quantidade = GREATEST(quantidade + $delta, 0) ... RETURNING *`. Edição usa "última gravação vence". O índice único garante o 409 mesmo em condição de corrida. A importação roda numa única transação.

**Observabilidade:** logs pino em JSON com `requestId, adegaId, rota, provedor, modelo, latenciaMs, custoUsd, codigoErro`. Os backups diários do Postgres ficam ligados no Railway.

## 7. Testes

Nenhum teste automatizado chama IA real nem a internet. O desenvolvimento segue TDD.

| Camada | Ferramentas | Cenários obrigatórios |
|---|---|---|
| `core` | Vitest, fast-check | `statusConsumo`: ano < abrir_de, = abrir_de, dentro da faixa, = guarda_ate, > guarda_ate, faixa 2027–2028 · `ordenarAdega` · `chaveDuplicata` (acentos/caixa/espaços/NV) · `horaDeAbrir` (null, virada de meia-noite) · `filtrarSugestoes` (id inventado, >3) · `parseListaKeep` com as 5 linhas reais + "Não necessário" + faixa + hífen comum + linha inválida · ida e volta `formatarLinhaKeep`/`parseListaKeep` (fast-check) · cobertura ≥ 90% |
| `ai` (contrato) | Vitest, MSW | Mesma bateria para `AnthropicLLM` e `OpenAICompativelLLM`: JSON válido; inválido → nova tentativa → sucesso; inválido duas vezes → `indisponivel`; 429/500; timeout; imagem num modelo sem visão. `BuscaPrecosAnthropic`: erro de busca devolvido com 200 vira `{ok:false}`. `SommelierPadrao`: falha de preço → ficha sem preço |
| `ai` (config) | Vitest | `carregarConfigIA`: chave ausente, provedor desconhecido, rótulo sem visão → erro na subida |
| `db` | Vitest, PGlite | migrations aplicam; **isolamento entre adegas** em todos os métodos de repositório; consumo concorrente (2× −1 com quantidade 1 → 0); 409 de duplicata; importação toda-ou-nada |
| API | Vitest + handlers + `FakeSommelier` + PGlite | status e `codigo` de cada rota; 60ª leitura ok e 61ª `LIMITE_IA_MES`; teto global; adega vazia não chama a IA |
| Guarda de acesso | Vitest | percorre todos os `route.ts` sob `app/api/adegas/` e chama cada método exportado sem sessão (→ 401) e como não-membro (→ 404) |
| E2E | Playwright (viewport de celular), `IA_*=fake`, Postgres | login de teste → importar Keep → ler rótulo → salvar → "churrasco" → "Vamos abrir esta" → quantidade −1 |

**Manuais (com custo real):** `pnpm test:live` (contrato contra provedores reais), `pnpm ai:gravar` (atualiza fixtures), `pnpm eval:rotulos` (fotos reais em `fixtures/rotulos/` + gabarito `{nome, safra}`, com relatório de acerto, custo e latência por modelo configurado).

**CI/CD:** GitHub Actions executa lint → typecheck → unit/integração → E2E, com Postgres como service container. O Railway faz deploy da `main` com "Wait for CI" e roda as migrations do Drizzle no pre-deploy. Localmente, Postgres via `docker compose` ou PGlite.

## 8. Riscos e pontos em aberto

| Risco | Mitigação |
|---|---|
| A IA erra a safra ou os dados do rótulo | Tela de revisão obrigatória (US-02) + `eval:rotulos` |
| Preço estimado incorreto | Rótulo de "estimativa", fontes clicáveis, data da consulta |
| Custo cresce com convidados | Limites por adega + teto global |
| O omnirouter não suporta `json_schema` ou imagem | Flags `OPENAI_COMPAT_*` + validação na subida + nova tentativa |

**Perguntas abertas para a PO** (não bloqueiam o plano): as perguntas 2–6 do backlog (quantidade, histórico, preço pago, outros tipos de vinho, sugestão de compra), os valores iniciais dos limites e se o login só com Google atende todos os convidados.
