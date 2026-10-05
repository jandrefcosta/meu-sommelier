# Meu Sommelier — Backlog do MVP (rascunho para revisão da PO)

> Status: **v0.2** — 2026-10-05 (alinhado à spec `docs/superpowers/specs/2026-10-05-sommelier-mvp-design.md`). Escrito sob o perfil de PO especialista em produtos de vinho/consumo.
> Tudo marcado com 🟡 é **suposição** e precisa de confirmação da PO.

## 1. Visão do produto

**Para** um casal que compra vinhos com frequência e quer aproveitar cada garrafa no momento certo,
**o Meu Sommelier** é um app de bolso
**que** transforma a foto de um rótulo em uma ficha completa (preço, janela de consumo, decantação, harmonização), organiza a adega de casa e responde "o que eu abro hoje com esse prato?".
**Diferente de** apps como Vivino (focados em comunidade/compra), **nosso produto** é focado na *adega pessoal* e na *decisão do dia a dia*, em português, com referência de preço no Brasil.

### Personas
| Persona | Quem é | Dor principal |
|---|---|---|
| **A Anfitriã** (PO) | Compra vinhos, gosta de acertar a harmonização, hoje mantém uma lista manual no Google Keep | Perde tempo pesquisando cada garrafa; a lista é texto solto, sem lembrete de quando abrir |
| **O Parceiro de Taça** | Usa a adega, sugere o que abrir | Não sabe qual garrafa está "no ponto" nem qual combina com o jantar |

### Métrica de sucesso do MVP 🟡
- A lista atual do Keep foi migrada inteira para o app.
- Em 4 semanas de uso, ≥ 80% das garrafas abertas foram escolhidas via aba "O que abrir?".
- Cadastrar uma garrafa por foto leva < 30 s de interação do usuário (sem contar a espera da IA, limitada a 45 s).

## 2. Mapa de épicos (temas)

| # | Épico | Tema | Pergunta que responde | MVP? |
|---|---|---|---|---|
| E1 | **Leitura de Rótulo** | "Primeiro olhar" | *"Que vinho é esse e como devo tratá-lo?"* | ✅ |
| E2 | **Minha Adega** | "A cave de casa" | *"O que eu tenho e o que está no ponto?"* | ✅ |
| E3 | **O que Abrir Hoje** | "O sommelier à mesa" | *"Vou comer X, qual garrafa abro?"* | ✅ |
| E4 | **Fundação** | "A rolha" | Login, dados, qualidade | ✅ (mínimo) |
| E5 | Diário de Degustação | "Memória do paladar" | *"Gostamos daquele?"* | ❌ pós-MVP |
| E6 | Lista de Desejos / Compras | "Próxima garrafa" | *"O que comprar?"* | ❌ pós-MVP |

## 3. A Ficha do Vinho (objeto central)

Derivada da lista atual da PO (Keep):

> Château Labadie Médoc Cru Bourgeois (2020) | 💵 R$ 220–280 | 🎯 2026 (⏳ 2030) | 🍷 Decantar: 30–45 min | 🥩 Estrogonofe de carne, corte de novilho grelhado

| Campo | Exemplo | Origem |
|---|---|---|
| Nome do vinho | Château Labadie Médoc Cru Bourgeois | IA (foto) / manual |
| Safra | 2020 | IA / manual |
| Uva / tipo 🟡 | Blend bordalês, tinto | IA |
| País / região 🟡 | França, Médoc | IA |
| 💵 Preço médio no Brasil (faixa) | R$ 220–280 | IA — **estimativa** |
| 🎯 Ano ideal para abrir (início da janela) | 2026 (pode ser faixa: 2027–2028) | IA |
| ⏳ Guarda máxima segura | 2030 | IA |
| 🍷 Decantação | 30–45 min / "Não necessário" | IA |
| 🥩 Harmonização | Estrogonofe de carne, corte de novilho grelhado | IA |
| Quantidade de garrafas 🟡 | 1 | Usuário |
| Status | Na adega / Bebido (o ☐ do Keep) 🟡 | Usuário |
| Foto do rótulo | — | Usuário |

**Status de consumo (calculado):** comparando o ano atual com a janela:
- 🟢 **No ponto** — ano atual entre 🎯 e ⏳
- 🔵 **Aguardar** — antes de 🎯
- 🟠 **Abrir logo** — último ano antes de ⏳
- 🔴 **Passou do ponto** — depois de ⏳

## 4. Histórias de usuário

Formato: *Como … quero … para …* · Prioridade MoSCoW · Tamanho (P/M/G)

### E1 — Leitura de Rótulo ("Primeiro olhar")

**US-01 · Fotografar rótulo e receber a ficha** — Must · G
Como Anfitriã, quero tirar/enviar a foto de um rótulo e receber a ficha completa do vinho, para não precisar pesquisar garrafa por garrafa.
- "Ler rótulo" oferece **📷 Tirar foto** (abre direto a câmera traseira do celular) e **🖼️ Escolher da galeria**.
- **Dado** que estou na tela inicial, **quando** toco em "Ler rótulo" e tiro ou escolho uma foto, **então** vejo em até ~15 s nome, safra, preço médio BR, ano ideal, guarda máxima, decantação e harmonização.
- **Dado** que a foto está ilegível ou não é um vinho, **então** vejo uma mensagem clara e opção de tentar de novo ou digitar o nome.
- O preço é exibido como **"estimativa"** com a data da consulta.
- A ficha **não é salva automaticamente** (ver US-02).

**US-02 · Revisar e salvar na adega** — Must · M
Como Anfitriã, quero revisar/corrigir os dados antes de guardar, para que a adega não tenha erros da IA.
- Todos os campos da ficha são editáveis antes de salvar.
- Posso informar a quantidade de garrafas (padrão 1).
- Ao salvar, a garrafa aparece no topo da Minha Adega.
- 🟡 Se o mesmo vinho+safra já existe, o app pergunta se quero somar à quantidade.

**US-03 · Cadastrar pelo nome (sem foto)** — Should · P
Como Parceiro de Taça, quero digitar "Perez Cruz Gran Reserva Cabernet 2024" e receber a mesma ficha, para cadastrar vinhos que já não estão em mãos.

### E2 — Minha Adega ("A cave de casa")

**US-04 · Ver a adega em lista** — Must · M
Como Anfitriã, quero ver todas as garrafas em uma lista no mesmo estilo da minha nota do Keep, para bater o olho e saber o que tenho.
- Cada item mostra: nome (safra) · 💵 faixa · 🎯 ano ideal (⏳ guarda) · 🍷 decantação · 🥩 harmonização · selo de status.
- Ordem padrão: 🟠 Abrir logo → 🟢 No ponto → 🔵 Aguardar; 🔴 Passou do ponto aparece com destaque.
- Funciona bem na tela do celular (uso principal 🟡).

**US-05 · Marcar garrafa como bebida** — Must · P
Como Parceiro de Taça, quero marcar uma garrafa como aberta, para que a adega reflita o que ainda temos.
- Tocar no ☐ diminui a quantidade em 1; ao chegar a 0, o vinho vai para "Já bebemos".
- Posso desfazer imediatamente.

**US-06 · Ver detalhe e editar uma garrafa** — Must · P
Como Anfitriã, quero abrir uma garrafa, ver a foto e editar qualquer campo, ou excluí-la.

**US-07 · Importar minha lista do Keep** — Should · M
Como Anfitriã, quero colar o texto da minha lista atual e ver todas as garrafas importadas, para não redigitar nada.
- Aceita o formato `Nome (safra) | 💵 R$ x–y | 🎯 ano (⏳ ano) | 🍷 Decantar: … | 🥩 …`.
- Linhas que não puderem ser lidas aparecem para correção manual — nada é descartado em silêncio.

**US-08 · Buscar e filtrar** — Could · P
Filtrar por status (No ponto…), tipo e buscar por nome.

### E3 — O que Abrir Hoje ("O sommelier à mesa")

**US-09 · Perguntar qual vinho abrir para um prato** — Must · G
Como Anfitriã, quero escrever o que vou comer (ex.: "risoto de cogumelos") e receber qual garrafa **da minha adega** abrir, para acertar a harmonização sem pensar.
- Resposta com até 3 sugestões, ordenadas, **somente entre garrafas com quantidade > 0**.
- Cada sugestão traz: por que combina (1–2 frases), status de consumo e **quando decantar** ("abra às 19h20 se for jantar às 20h" 🟡).
- Garrafas 🟠/🟢 têm preferência sobre 🔵 Aguardar; se a melhor opção for 🔵, o app avisa ("ainda jovem, mas é o melhor par").
- **Dado** que nenhuma garrafa combina bem, **então** o app diz isso com honestidade e sugere o estilo de vinho ideal para comprar.
- Adega vazia → convite para cadastrar a primeira garrafa.

**US-10 · Abrir a garrafa sugerida** — Should · P
A partir da sugestão, um toque em "Vamos abrir esta" marca a garrafa como bebida (US-05).

**US-11 · Conversa de acompanhamento** — Won't (MVP)
"E se for com sobremesa?" — refinamento em chat. Fica para depois.

### E4 — Fundação ("A rolha")

**US-12 · Adega compartilhada do casal** — Must · M
Como casal, queremos acessar a mesma adega pelos dois celulares.
- Login com Google (link mágico fica para depois do MVP); ambos veem e editam a mesma adega.
- Cada adega é isolada: um usuário nunca vê garrafas de uma adega da qual não é membro.

**US-12b · Convidar amigos/família para terem a própria adega** — Should · M
Como Anfitriã, quero convidar amigos e família para usarem o app com a adega deles, para compartilhar a experiência.
- Convite por link; quem entra cria a própria adega (separada da nossa).
- 🟡 Pode-se convidar alguém para ser membro de uma adega existente (ex.: o outro membro de um casal).
- Uso de IA limitado por adega (ver US-14), para controlar custo com mais usuários.

**US-13 · Instalar como app** — Should · P
Como Anfitriã, quero um ícone na tela inicial do celular, sem passar por loja de apps (PWA).

**US-14 · Custo e privacidade sob controle** — Must · P (técnica)
Como responsável técnico, quero limitar o uso da IA e registrar custos, para não ter surpresa na fatura.

## 5. Fatiamento de releases

| Release | Conteúdo | Objetivo de aprendizado |
|---|---|---|
| **R0 — Prova de valor** | US-01 (sem salvar), US-09 com adega colada em texto | A IA acerta ficha e harmonização? |
| **R1 — MVP** | US-01, 02, 04, 05, 06, 09, 12, 14 | Casal usa no dia a dia |
| **R1.1** | US-03, 07, 10, 13 | Reduzir atrito |
| **R2** | US-08, E5, E6, US-11 | Engajamento |

## 6. Requisitos não-funcionais (para a arquitetura de testes)
- Toda resposta da IA é **estruturada (JSON validado)**; dado inválido nunca chega à tela nem à adega.
- A IA fica atrás de uma interface própria, para testes rodarem com respostas simuladas (sem custo, determinísticos).
- Cálculo de status (🟢🔵🟠🔴) e o importador do Keep são lógica pura, 100% coberta por testes unitários.
- Idioma: pt-BR. Moeda: BRL.

## 7. Perguntas abertas para a PO
1. ~~Público~~ → **Decidido (2026-10-04): nós + amigos/família.** Várias adegas isoladas, com convites.
2. Quantidade por garrafa importa (vocês costumam ter 2+ do mesmo vinho)?
3. O ☐ do Keep hoje significa "bebido"? Querem manter o histórico do que já beberam?
4. O preço deve refletir o que **vocês pagaram**, o mercado, ou os dois?
5. Brancos, rosés e espumantes entram (a lista atual tem só tintos)?
6. Na pergunta "o que abrir", deve considerar também vinhos **fora** da adega (sugestão de compra)?
