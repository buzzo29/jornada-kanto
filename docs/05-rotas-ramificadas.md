# Rotas Ramificadas — o mapa de escolhas de Kanto
*Jornada Kanto · Floresta ou praia? Cada perna da jornada vira uma decisão de build.*

---

## A ideia em uma frase

Hoje cada uma das 8 pernas tem **um pool fixo** de encontros. A proposta: antes de cada encontro selvagem, o jogador **escolhe entre 2 rotas** (às vezes uma 3ª rara aparece), e cada rota tem pool temático, faixa de nível, evento próprio e perfil de risco. O time que chega na Liga passa a contar a história do caminho escolhido — e "build" vira uma consequência natural do mapa, não de menus.

Por que funciona especialmente bem no jogo de vocês:

- O sistema de pools por perna **já existe** (`LEGS` no código) — rota é um pool com tempero, não uma mecânica nova;
- O ginásio seguinte é conhecido → escolher rota vira decisão **estratégica** ("Misty é água, vou pra rota elétrica") — premia conhecimento, como vocês pediram;
- A Pokédex é **permanente entre saves** e completar 149 libera o Mewtwo → espécies exclusivas por rota criam rejogabilidade real (ninguém completa a Pokédex numa run só).

---

## O mapa (fiel a Kanto, com as duas rotas por perna)

| Perna | Ginásio à frente | Rota A 🌲 | Rota B 🌊 |
|---|---|---|---|
| 1 | Brock (pedra) | **Floresta de Viridian** — insetos/planta (Caterpie, Weedle, Oddish; raro: Pikachu) | **Rota 22** — normal/voador (Rattata, Spearow, Mankey — o Mankey é a resposta ao Brock!) |
| 2 | Misty (água) | **Monte Lua** — pedra/fada (Geodude, Zubat, Clefairy; evento: **fóssil**) | **Rotas 24/25 (costa)** — água/elétrico (Bellsprout, Oddish, raro: Pikachu — pra bater a Misty) |
| 3 | Surge (elétrico) | **Caverna Diglett** — terra (Diglett, raro: Dugtrio — o counter do Surge mora aqui) | **S.S. Anne** — sem selvagens: **3 batalhas de treinador** com prêmios (pontos e um presente raro) |
| 4 | Erika (planta) | **Túnel de Pedra** — pedra/lutador, escuro (evento: travessia "ordem cega" com bônus) | **Desvio por Lavender** — fantasmas (Gastly, Cubone; evento: Torre assombrada) |
| 5 | Koga (veneno) | **Estrada Ciclável** — venenos rápidos (Grimer, Koffing, Doduo) | **Zona de Safári** — a rodada especial de captura (8 ofertas, raros, 30% de fuga) |
| 6 | Sabrina (psíquico) | **Dojo Lutador** — lutadores (Machop, Hitmonlee/chan à escolha — anti-Sabrina? não! quem sabe, sabe: é a escolha-armadilha clássica) | **Silph Co.** — o evento Rocket grande (2 batalhas; prêmio: Lapras de presente 🎁) |
| 7 | Blaine (fogo) | **Ilhas Seafoam** — água/gelo (Seel, Shellder, Staryu; raro: **Articuno** 5%) | **Mansão Pokémon** — fogo (Growlithe, Ponyta, Vulpix; raro: **Ditto** e diário do Mewtwo 👀) |
| 8 | Giovanni (terra) | **Usina de Força** — elétricos (Magnemite, Electabuzz, Voltorb; raro: **Zapdos** 5%) | **Victory Road** — pedra/lutador de elite (Onix, Machoke, Graveler; raro: **Moltres** 5%) |

*As aves lendárias saem do sorteio genérico da perna 8 e cada uma passa a morar na sua rota canônica (Articuno em Seafoam, Zapdos na Usina, Moltres na Victory Road) — capturar as três exige três runs com caminhos diferentes. Colecionador vai amar/sofrer.*

---

## As mecânicas por cima do mapa

### 1. A tela de escolha (conhecimento primeiro)
Duas cartas lado a lado, estilo retrô, cada uma mostrando: nome da rota, **2–3 ícones de tipo** do pool, nível de risco (🌤️ tranquila / ⚠️ arriscada) e um **rumor** ("Pescadores falam de um Pokémon raríssimo nas cavernas geladas…"). O jogador nunca vê a lista exata — vê o suficiente pra decidir com conhecimento, e o resto é descoberta.

### 2. Perfil de risco (estratégia + a sorte que vocês querem)
Cada par tem uma rota segura e uma arriscada:
- **Tranquila**: pool padrão, sem surpresas;
- **Arriscada**: ofertas com +1/+2 níveis e chance maior de raros, MAS com contrapartida — chance de emboscada Rocket (a da lista anterior), do encontro "fugir" ou de evento negativo leve.
O jogador escolhe sua variância. Encaixa direto no princípio "risco opt-in" da economia v2.

### 3. Exclusivos de rota (a Pokédex agradece)
~15 espécies só aparecem em uma rota específica (Pikachu na Floresta, Clefairy no Monte Lua, Growlithe na Mansão, Hitmonlee/chan no Dojo, os 3 lendários). Com a Pokédex permanente entre saves, isso transforma "zerar de novo" em "explorar o outro caminho" — rejogabilidade sem criar conteúdo novo, só redistribuindo o que existe.

### 4. Escolhas dentro da rota (micro-decisões memoráveis)
- **Fóssil no Monte Lua**: Omanyte ou Kabuto — escolha excludente clássica, entra no time na perna 5 "revivido";
- **Dojo**: vencer o mestre dá a escolha Hitmonlee OU Hitmonchan;
- **S.S. Anne / Silph Co.**: rotas de batalha (sem captura) com prêmio — pra quem quer pontos e desafio em vez de Pokémon novos. Times de batalha diferentes = builds diferentes de recompensa.

### 5. A rota dourada ✨ (sorte pura, rara)
~8% de chance por perna de aparecer uma **terceira carta brilhando**: a "Clareira Dourada" — pool com chance de shiny dobrada e uma oferta garantida acima da média. Aparece, o coração acelera, e é só isso — sorte no melhor formato: rara, positiva e impossível de farmar.

### 6. O diário da jornada
No fim (e no game over), uma tela mostra o caminho percorrido no mapa — "Floresta → Costa → S.S. Anne → …" — com o time final. É a foto que o jogador manda no grupo. Custo: uma tela de render; retorno: marketing orgânico entre amigos.

---

## Como isso conversa com o que já foi proposto

| Sistema anterior | Encaixe |
|---|---|
| Rival fica com os recusados | Continua igual — e agora o rival também "escolhe" a rota oposta à sua, tematizando o time dele |
| Emboscadas Rocket | Viram o risco das rotas arriscadas + o evento fixo da Silph Co. |
| Economia de habilidade v2 | Rotas não dão pontos — dão **opções**. O piso/teto da economia fica intacto; a rota muda o QUE você pode montar, não o quanto de poder bruto acumula |
| Zona de Safári / Torre de Lavender / fósseis | Deixam de ser eventos soltos e ganham endereço no mapa |
| Desafio diário com seed | A seed do dia fixa também as rotas douradas — todo mundo enfrenta o mesmo mapa |

## Implementação (mais barato do que parece)

1. `LEGS` deixa de ser `[pool]` e vira `[{routes: [{id, nome, tipos, pool, risco, evento?, raros?}]}]` — os pools atuais são o ponto de partida, divididos por tema;
2. Uma tela nova (`renderRouteChoice`) entre o pós-ginásio e o encontro selvagem — mesmo padrão das telas existentes;
3. `game.routeHistory` no save (array de 8 ids) — alimenta o diário da jornada e as conquistas ("Zere só por rotas arriscadas");
4. Exclusivos = espécie presente em um pool só — zero código novo, é curadoria de dados;
5. A rota dourada é um `if (rng() < 0.08)` adicionando a terceira opção.

Fase 1 enxuta pra validar a diversão: só as pernas 1, 2 e 7 ramificadas (floresta/rota-22, montanha/costa, gelo/fogo), sem eventos internos — dá pra jogar em uma semana de trabalho e sentir se o loop de escolha é gostoso antes de ramificar as oito.
