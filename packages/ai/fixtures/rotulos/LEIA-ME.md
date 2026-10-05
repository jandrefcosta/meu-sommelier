# Fotos para `pnpm eval:rotulos`

Coloque aqui fotos reais de rótulos (jpg, png ou webp) e um `gabarito.json` com o que cada foto deveria render:

    [
      { "arquivo": "labadie.jpg", "nome": "Château Labadie Médoc Cru Bourgeois", "safra": 2020 }
    ]

`pnpm eval:rotulos` mostra acerto de nome e safra, latência e custo para os modelos do `.env`.
`pnpm ai:gravar` faz o mesmo e salva cada resultado em `fixtures/gravadas/`.

Os dois chamam a IA real e têm custo.
