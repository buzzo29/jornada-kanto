# Jornada Kanto — memória do projeto

Jogo de desafio de ginásios estilo Gen 1, em arquivo único, com Firebase (Auth + Firestore +
Cloud Functions). Este arquivo é lido automaticamente pelo Claude Code — mantenha-o atualizado.

## Estrutura

```
public/index.html      → o jogo inteiro (dados + motor + telas + Liga). ~6 mil linhas.
functions/index.js     → Cloud Function que avança a Liga a cada minuto
firestore.rules        → regras de segurança
tools/                 → simuladores e testes headless (Node puro, sem navegador)
```

## ⚠️ A regra mais importante: o motor de batalha existe em DOIS lugares

`public/index.html` e `functions/index.js` têm cópias do mesmo motor: `SPECIES`, `TYPE_CHART`,
`calcDamage`, `doExchange`, `simulateGymBattle`, `makeSeededRng`, `encodeTeamCode`/`decodeTeamCode`,
`applyTeamBonuses`, `rolledMultiplier`, `firstStrikeChance` e a validação de time da Liga.

**Qualquer ajuste de balanceamento tem que ir nos dois arquivos.** Se sair de sincronia, cliente e
servidor simulam a mesma partida da Liga e chegam a resultados diferentes — o jogador vê um
vencedor na tela e o servidor grava outro. Enquanto os arquivos não forem unificados num módulo ES
compartilhado, trate essa duplicação como o risco número um do projeto.

## Arquitetura do cliente

- Estado global único (`game`) + `render()` que redesenha a tela inteira a cada ação.
- `render()` faz um `switch(game.screen)`; cada tela é uma função `renderXxx()` que devolve HTML.
- Autosave com debounce; só grava nas telas listadas em `SAFE_SAVE_SCREENS`.
- `serializeGame()` / `applySavedState()` são o contrato do save. **Campo novo no estado precisa
  entrar nos dois**, e `applySavedState` sempre usa default defensivo (saves antigos não têm).

## Regras de negócio

### Jornada
- 8 pernas, uma por ginásio. Cada perna começa numa **escolha de rota** (2 opções + 8% de chance
  de uma terceira "Clareira Dourada"). A rota decide o pool de encontros, o nível de risco e o
  evento do caminho. Ver `ROUTE_MAP`.
- A perna monta uma **fila de passos** (`buildLegSteps`) e `advanceJourney()` consome um por vez.
  A fila é montada **uma única vez**, em `chooseRoute`. Nunca reconstrua a fila dentro de
  `advanceJourney` — isso faz a perna inteira rodar de novo.
- Batalhas de evento (Rocket, rival, Jessie & James, Snorlax, torre, dojo, S.S. Anne, Silph) usam
  o mesmo motor dos ginásios via `startEventBattle()`. Os desfechos ficam em `EVENT_OUTCOMES`,
  indexados por id — **não use callbacks**, eles não sobrevivem ao save.
- 5 derrotas no mesmo ginásio = game over. Derrotas em eventos (`freeLoss:true`) não contam.

### Economia (a parte mais delicada — leia antes de mexer)
O princípio: **a derrota define o piso, o mérito e a sorte definem o teto.**

- Vitória vale de **+8 a +14** conforme desempenho, mais bônus de desafio declarado, aposta de
  MVP, maré de vitórias e roleta. Ver `computeVictoryRewards()`.
- Derrota **adianta** 5 pontos (empréstimo), **uma vez por ginásio**, descontados da próxima
  vitória. Não é uma vez por derrota: `game.losses` zera a cada ginásio, então "uma por derrota"
  permitiria 32 adiantamentos numa jornada e o empréstimo viraria doação.
- **Desmaio só rende nível em batalha vencida.** Esse era o canal escondido que fazia perder de
  propósito valer a pena (+6 níveis por derrota, fora da economia de pontos).
- Socorro da derrota é **não-numérico**: time do líder revelado, reordenar, +10%/+20%/+30% de HP
  temporário (expira ao vencer, não vale na Liga) e reforço de emergência da 3ª derrota em diante.
- Revanche encarece: +1 nível no time do líder a partir da **segunda** revanche, cap +3.
- Nível máximo por Pokémon: 55 (distribuição, doce raro, creche e bônus de desmaio, todos).

**Depois de qualquer mexida na economia, rode `npm run test:economia`.** Ele confirma que a ordem
Feeder < Mediano < Habilidoso < Mestre continua valendo. Se inverter, o exploit voltou.

### Motor de batalha
- Dano usa Atk/Def reais (não BST) e `speed` decide quem bate primeiro — de forma **probabilística**
  (`firstStrikeChance`), não determinística: o rápido leva vantagem real mas o lento não vira
  estátua. Quem desmaia antes de revidar não revida.
- Dual-type sorteia o tipo do golpe: 70% o mais eficaz, 30% o outro (`rolledMultiplier`).
- Bônus passivos do time do jogador: +1% de dano por insígnia (cap +8%) e +2% por tipo único no
  time (cap +12%), aplicados em `applyTeamBonuses` como `p.dmgBonus`.
- **Fadiga do vencedor**: quem já venceu confrontos na mesma batalha fica progressivamente mais
  frágil conforme o HP cai (`minDefenseFactor = 1 - wins*0.35`, piso 0.1). É a trava anti-snowball
  que mantém 6×6 disputado — não mexa sem rodar `npm run sim`.

### Liga
- Ciclos de 1 hora; cada inscrito é um documento próprio no Firestore (evita contenção).
- Níveis ficam **congelados** na Liga.
- Chaveamento por **divisões de força** (soma de níveis + BST/10), sorteio aleatório dentro da
  divisão. Antes era sorteio puro e novato caía contra 6 Dragonite na primeira rodada.
- Sobras que não fecham uma Liga de 8 são completadas com **fantasmas do rival** de cada jogador
  (time montado com os Pokémons que ele recusou na jornada). Bot não entra no ranking global.
- **Validação de integridade**: nível ≤ 60 por Pokémon e soma ≤ 360. Não é limite novo de jogo —
  o teto honesto é 55; a folga existe pra não punir saves antigos. Antes disso a função aceitava
  nível até 200 e 6 Mewtwo Lv.200 passavam.

## Segurança
- **Todo nome de treinador/rival que for pra `innerHTML` passa por `escapeHtml()`.** São texto livre
  do jogador e aparecem no chaveamento, no ranking e nos fantasmas. Sem escapar, um nome como
  `<img src=x onerror=...>` roda no navegador de todo mundo.
- `firestore.rules` ainda está permissiva demais em `leagues/*` e `leagueCycles/*` (escrita livre
  pra qualquer logado). Pendente do doc 01 da documentação.

## Ferramentas

```bash
npm run test:economia   # regressão da economia — Feeder < Mediano < Habilidoso < Mestre
npm run test:jornada    # 20 jornadas completas headless: nenhuma tela pode quebrar
npm run sim             # winrate por espécie + correlação BST/Speed
npm run sim:ginasios    # winrate de times aleatórios contra cada líder
npm test                # economia + jornada
```

Os scripts carregam `public/index.html` num sandbox Node (`tools/game-sandbox.js`), sem navegador e
sem Firebase. Se você adicionar uma função que os testes precisam usar, inclua o nome na lista
`EXPORTS` desse arquivo.

## Deploy
`firebase deploy --only hosting,functions` (e `--only firestore:rules` pras regras).
Faltam `firebase.json` e `.firebaserc` no repo — quem tiver localmente deve commitá-los.
