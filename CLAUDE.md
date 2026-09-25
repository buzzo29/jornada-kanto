# Jornada Kanto

Fangame de Pokémon Gen 1 em português, jogável no navegador. No ar em jornadakanto.com.
Dev: Matheus (Buzzo no jogo).

Este arquivo guarda **decisões e armadilhas** — o que NÃO dá pra deduzir lendo o código.
Estrutura de arquivos, dependências e o que cada função faz: leia o código, ele é comentado.

## ⚠️ ONDE PROCURAR: o registro mora em CINCO arquivos

| se você vai mexer em | leia |
|---|---|
| **dano, golpe, status, passiva, estágio, clima** | `docs/motor-de-batalha.md` |
| **log de batalha, cena, animação, selos** | `docs/batalha-na-tela.md` |
| **os 5 minigames, o mapa das Ilhas, a travessia, os rankings deles** | `docs/ilhas-laranja.md` |
| **item, preço, moeda, TM, HM, loja, mochila** | `docs/economia.md` |
| **liga, chaveamento, online, Torre, Ginásio da Cidade, painel** | `docs/ligas-e-online.md` |
| **jornada, rotas, Pokédex, save, conta, home, frontend** | **este arquivo** |

⚠️ **ELES SAÍRAM DAQUI EM 25/09/2026, POR MEDIÇÃO — e a razão importa:** este arquivo tinha chegado
a **1.360 KB (~544 mil tokens)** e é lido **INTEIRO em toda sessão**. Sobrava menos da metade da
janela pro trabalho, e a sessão passava a **comprimir no meio** — que é o retrabalho de verdade:
eu perco detalhe e releio o que já tinha lido. Hoje o fixo são ~310 KB.

⚠️ **O QUE TORNA ISSO SEGURO NÃO É O CORTE, É O GATILHO.** Cada capítulo deixou aqui um índice com
(a) uma linha **LEIA ANTES DE MEXER EM…** e (b) **a lista dos símbolos que só são explicados lá**.
A segunda metade existe porque gatilho por ASSUNTO falha quando o assunto não é óbvio — mexer no
`SAFE_SAVE_SCREENS` não parece "Ilhas Laranja", e há uma lição sobre ele lá. **Um `grep` que caia
aqui e não ache nada tem que ir pro capítulo.**

⚠️ **E A LISTA DE SÍMBOLOS DE CADA ÍNDICE É DOS MAIS CITADOS, NÃO DE TODOS** — medido, o
`PRO_FAIXAS` não está em nenhuma. Então a regra final é a mais simples: **um `grep` que não ache
nada aqui se repete em `docs/`**, e é lá que ele estará.

⚠️ **E A DIVISÃO FOI CONFERIDA POR CONTEÚDO, nunca por tamanho** (`tools/dividir-claude.js`): as
**90 seções** e as **599 subseções** do arquivo original estão todas presentes, **byte a byte**, e
nenhuma em dois lugares. Delta de tamanho não prova nada — um recorte pode levar metade de uma
subseção e a conta continua fechando.

---

## Regras de trabalho

- **Sempre medir antes de afirmar.** Este projeto tem um motor de batalha determinístico e
  simulável. Antes de mudar balanceamento, rode uma simulação (alguns milhares de batalhas) e
  mostre o número. Várias decisões aqui foram revertidas porque a simulação contradisse a intuição.
- **Nunca mudar balanceamento sem apresentar o impacto medido**, mesmo que o pedido seja direto.
  Fazer o que foi pedido E dizer o que aquilo custa.
- `pokemon-ginasio.html` e `index.js` têm **tabelas duplicadas** (SPECIES, EVOLUTIONS, TERRAINS,
  o motor de batalha). Ao mexer numa, mexer na outra e **verificar que ficaram idênticas**.
  Divergência aqui = mesma batalha com resultados diferentes no cliente e no servidor.
- Depois de editar o HTML, extrair os `<script>` e rodar `node --check`. O arquivo tem ~14k linhas
  e um erro de sintaxe quebra o jogo inteiro em silêncio.
- Comentar o **porquê**, não o quê. Os comentários deste projeto explicam decisões e bugs antigos;
  são eles que sobrevivem à troca de ferramenta ou de contexto.
- **⚠️ NÃO INVESTIGAR FLAKE ANTIGO** (a pedido, 25/09/2026: *"pode deixar de investigar esses flakes
  antigos então, hoje a mecânica de batalhas está boa"*). Trava que este arquivo já registra como
  flake conhecido — a do selo de crítico (17/09), a do `Charmeleon × Mankey` — **não se investiga de
  novo**: anotar que ela caiu e seguir. Uma dessas investigações custou **26 minutos** numa sessão,
  pra reprovar o que já estava escrito aqui.
  ⚠️ **O que continua valendo é o oposto disso: trava NOVA que cai, investiga-se sempre** — e a
  diferença entre as duas é se este arquivo já a nomeia.
- **⚠️ CONGELAR AS DUAS CÓPIAS ANTES de começar a mexer**, quando a mudança vai precisar de A/B de
  jornada. Medir contra o arquivo VIVO significa não poder tocar no repositório enquanto ele roda —
  e um `git stash` no meio de um A/B já o invalidou, custando **12 minutos** de medição refeita.
- **⚠️ O A/B DE JORNADA CUSTA ~12 MINUTOS E RODA UMA VEZ, NO FIM.** Rodá-lo no meio mede um build
  intermediário e ele tem que ser refeito. E ele só é necessário quando a **impressão do MOTOR**
  muda: se só o DIÁRIO mudou, é apresentação e não há dificuldade a medir.
  ⚠️ **O parâmetro é `--runs`, nunca `--n`** — o smoke IGNORA um `--n` e roda o padrão de 20
  jornadas. Em 25/09/2026 isso fez um A/B "de 12.800" medir **160 por lado** sem nada acusar: os
  dois lados leem o mesmo número errado, então o resultado sai plausível.
- **⚠️ UM A/B DE 8 BLOCOS AINDA DÁ 2,6σ POR ACASO — e isso foi medido em 25/09/2026.** O primeiro
  A/B dos terrenos de ginásio deu **+1,66 ponto, 2,6σ, 7 de 8 blocos**; o segundo, idêntico, deu
  **−0,27, 0,3σ, 2 de 8**. **Quando o A/B contradiz uma conta direta (aqui: quantos pokémon de cada
  lado o terreno beneficia), rodar o segundo é mais barato que acreditar no primeiro.**
- **⚠️ E A MEDIÇÃO PAREADA GANHA DA NÃO-PAREADA.** O smoke **não semeia o `Math.random`**, então
  cada lado do A/B roda jornadas diferentes; já uma medição de BATALHA (mesmo time, mesma semente,
  só o parâmetro muda) isola o efeito. Onde der pra fazer a pareada, ela é o número que vale.

## Deploy

- `firebase deploy` — regras → functions → hosting
- `firebase deploy --only hosting` — só o HTML
- `firebase deploy --only functions` — só o servidor
- `firebase deploy --only firestore` — só as regras
- Quando cliente e servidor mudam juntos, **subir os dois na mesma leva**.
- **O `index.html` vai com `Cache-Control: no-cache`** (a seção `headers` do `firebase.json`), e isso
  não é detalhe. O padrão do Firebase Hosting pra HTML é **`max-age=3600`**: sem a seção, quem já
  tinha a página aberta continuava com o jogo VELHO por até uma hora depois do deploy.
  Descoberto em 04/09/2026, e ele já tinha custado um relatório de bug: o jogador mandou print de um
  defeito que estava consertado, porque o navegador dele ainda servia a versão anterior. Como o jogo
  INTEIRO é um arquivo só, uma hora de cache é uma hora de correção que não chega.
  `no-cache` não quer dizer "não guarde": o navegador guarda e **revalida pelo ETag** a cada visita.
  O que muda é que o deploy passa a valer no próximo F5.
  **⚠️ ESTA LINHA DIZIA "o custo normal é um 304 vazio", E A MEDIÇÃO DERRUBOU ISSO (19/09/2026):**
  o Hosting **nunca** devolve 304 pra este arquivo. Testado com `If-None-Match`, com
  `If-Modified-Since` e com os dois juntos -- sempre **200 com 486 KB** (~1,1 s), e `X-Cache: MISS`
  em toda resposta. Ou seja **toda abertura do jogo baixa o arquivo inteiro**, e a revalidação
  barata que esta seção prometia nunca existiu. (Suspeita: o `Vary: x-fh-requested-host` da
  borda do Firebase. NÃO foi investigado até o fim -- o que está medido é o efeito.)
  Ver **PERFORMANCE: A GEOGRAFIA MANDA**.
- **Deploy que demora não é deploy que acabou.** As ~67 functions levam vários minutos e o hosting
  entra no fim da leva: enquanto ela roda, o que está no ar ainda é a versão anterior. Testar nesse
  intervalo devolve o comportamento velho -- foi exatamente o que aconteceu no print da Faixa.
  Conferir com o `Deploy complete!` e, na dúvida, comparar o arquivo no ar com o local
  (`curl -s https://jornadakanto.com/index.html | cmp - index.html`).
- **⚠️ E TODA PRÉVIA QUE FICAR NA RAIZ VAI AO AR JUNTO.** Descoberto em 24/09/2026, depois de um
  deploy: a `previa-confusao.html` que eu tinha deixado ali respondia **200** em
  `jornadakanto.com/previa-confusao.html`. Não é vazamento de dado (é uma tela do jogo desenhada
  fora dele), é **lixo publicado** — e o `hosting.ignore` ganhou `**/previa-*.html` por isso, que é
  a mesma rede que o `firestore.rules` já tinha.
  **O arquivo sai do ar no PRÓXIMO deploy**: cada `firebase deploy --only hosting` publica um
  instantâneo completo do diretório, então apagar aqui basta — não há o que remover na mão.
  ⚠️ **A lição vale pra o diretório inteiro:** o que serve pra MEDIR (as prévias, os relatórios) não
  pode morar na raiz sem entrar no ignore — e o `tools/` e o `CLAUDE.md` já estão no ar pelo mesmo
  motivo, esses de propósito.
- **`firestore.rules` é a fonte da verdade desde 30/08/2026**, quando o `firebase.json` ganhou a
  seção `firestore`. Antes disso ele não era publicado por nada e o console era quem mandava —
  então o arquivo derrapou até ficar **70 linhas atrás** da produção (47 contra 117). Publicá-lo
  naquele estado teria apagado a trava dos campos de especialidade (sem ela, uma linha no console
  declara o jogador especialista em todos os tipos), a trava do ranking da Trainers League, os
  `matchLogs`, os `neighborhoodGyms` e o `leagueTypes` fechado. Foi reescrito a partir do que
  estava no ar **antes** de ligar, e a publicação foi conferida linha a linha: só acrescentou o
  `globalBoss`, não removeu nada.
  **Publicar SUBSTITUI, não mescla.** Editar no console agora é editar do lado errado — o próximo
  deploy sobrescreve. Se acontecer mesmo assim, ler as regras no ar
  (`firebase_get_security_rules` pelo MCP) e trazer pra cá antes do deploy seguinte.
  O `hosting.ignore` passou a excluir o arquivo: o site publica a raiz do repo, e a cópia das
  regras não precisa ficar baixável em `jornadakanto.com/firestore.rules`.

---

## Motor de batalha

- Fórmula fiel à Gen 1, com dano calculado como fração da vida e reescalado. A base do dano é a
  mesma nas duas gerações, então isso também vale como Gen 2.
- **Especial é separado em Sp.Atk e Sp.Def (Gen 2)**, valores oficiais da Geração II na tabela
  `GEN2_SPECIAL`, idêntica nos dois arquivos, e ela é a **única fonte de atributo especial no
  jogo**. O campo `special` único da Gen 1 **não existe mais** — foi removido do `SPECIES` (Kanto e Johto), do `createInstance`, da migração de save e do fallback das `effective*` em
  30/08/2026. Não sobrou nada de Gen 1 em atributo. (A remoção não tocou em uma casa decimal:
  impressão do motor idêntica antes e depois. O fallback era código morto — só seria alcançado
  por instância de espécie desconhecida.)
  Não dá pra deduzir um campo do outro, e a intuição erra aqui: medido nas 150 de Kanto, o Special
  da Gen 1 é sempre **exatamente um dos dois** valores novos, nunca um meio-termo — em 39 espécies
  os dois são iguais, em **68 ele virou o Sp.Atk** e em 43 o Sp.Def. (Este arquivo afirmava o
  contrário, "virou o Sp.Def na maioria", até ser medido.)
- **`bstOf` é o BST oficial da Gen 2**, os seis atributos — o mesmo número que a ficha da Pokédex
  mostra ao jogador. Era a soma de quatro (hp+ataque+defesa+`special`), que ignorava a defesa
  especial E a velocidade. Ele serve só pra escolher os 5 que o rival leva entre os recusados;
  `rarityWeight` não existe mais no projeto (este arquivo dizia que `bstOf` alimentava a raridade
  dos encontros — não alimenta). Medido na troca: a identidade dos 5 escolhidos muda em **63%**
  dos casos, mas a força real do time do rival sobe só **1,2%** (BST médio 488,1 → 494,1), e em
  400 jornadas simuladas de cada lado a conclusão fica em **274 contra 271** — dentro do ruído.
  Ele escolhe melhor, não escolhe mais forte.
- **O CRÍTICO É DA GEN 3 desde 10/09/2026** — a "decisão em aberto" foi tomada, e com ela some o
  último desvio de Gen 1 do motor (o jogo já usava atributos da Gen 2 e golpes da Gen 3).
  **A Gen 3 abandonou a velocidade** e usa ESTÁGIOS de chance fixa, iguais pra todo mundo:
  `+0 = 1/16 (6,25%)`, `+1 = 1/8`, `+2 = 1/4`, `+3 = 1/3`, `+4 = 1/2`.
  **Só existem os DOIS primeiros aqui, e é decisão:** nada no jogo sobe estágio — não há Foco de
  Energia, Lente de Mira, habilidade nem item de crítico. Cadastrar os estágios 2 a 4 seria código
  que nunca roda, do tipo que fica anos no arquivo sem ninguém saber que está morto.
- **O efeito é ×2 EXATO** (a regra da Gen 2 à Gen 5), e não mais o nível dobrado — que dava **1,78×
  no nível 20 e 1,92× no 90**, porque o `+2` e os arredondamentos da fórmula comiam uma fatia.
- **OS OITO GOLPES DE CRÍTICO ALTO** (`GOLPES_CRIT_ALTO`, estágio +1 = 12,5%): Ataque Celeste,
  Aerojato, Golpe Cruzado, Martelo de Caranguejo, **Talho** (o `slash`, 22 espécies, o de peso
  real — ele se chamava "Corte" até 13/09/2026, quando o HM01 passou a ensinar o `cut` e o nome
  foi pro dono certo), Corte de Ar, Folha Navalha e Golpe de Karatê.
  **A lista NÃO foi escrita de cabeça:** o Bulbapedia não publica o conjunto da geração, só
  exemplos — ela saiu do `critRatio` do dado do Showdown com o mod da Gen 3, o MESMO caminho que
  gerou a base de golpes. **Atenção: o Ás Aéreo NÃO entra** (ele nunca erra, mas não é crítico
  alto), e essa foi a primeira coisa que a conferência contra o dado pegou.
  Ela é **DUPLICADA nos dois motores** e o teste compara.
- **O QUE MUDOU NA PRÁTICA:** a taxa média cai de **12,8% pra 6,25%** e **deixa de depender da
  espécie**. O Electrode criticava 27,3% e o Shuckle 1,0%; hoje os dois criticam igual, e quem
  carrega um dos oito golpes vai a 12,5%. Um Gyarados, que era 15,8%, virou 6,25%.
  **Custo medido: nada.** Conclusão da jornada **69,93% → 68,77%**, −1,16 ponto, **1,6σ** (10 blocos
  de 1.000 jornadas de cada lado). Menos crítico deixou o jogo levemente MAIS difícil, não menos —
  dentro do ruído, mas na direção de que o jogador aproveitava o crítico um pouco mais que os NPCs.
- **O SELO DE CRÍTICO VOLTOU** (no log e na linha do meio da batalha), e ele **já tinha saído daqui**
  por virar ruído numa linha que se lê de relance — está registrado mais abaixo, na seção do log.
  Voltou a pedido, e o motivo é outro agora: com ×2 exato e sem teto de dano, o crítico **decide
  confronto** — o relato que trouxe esta mudança foi justamente um Gyarados morrendo de vida cheia
  sem nada na tela explicando por quê.
  **Pra não repetir o erro ele é pequeno, sem cor forte e ANEXADO ao número** (`−415 de HP.
  CRÍTICO`): quem lê a linha vê o dano primeiro e o motivo depois, não uma etiqueta piscando na
  frente. O campo `c` do diário existia desde sempre e nunca era lido — mesmo caso do `dz`.
  **NA RECONSTRUÇÃO o selo é aproximado, e de propósito:** ela inventa os golpes a partir do HP e
  não sabe QUAL foi crítico, mas o diário sabe **quantos** foram e de **que lado** — o
  `marcarCriticos` põe o selo nessa quantidade nos golpes de maior dano daquele lado (o crítico
  vale ×2, então é a correspondência mais provável). Sem isso o selo sumia em **56%** dos confrontos
  com crítico, justamente os longos. O que é aproximado é a POSIÇÃO; o lado e a contagem são reais,
  e o teste cobra os dois.
- **Multiplicador de tipo: expoente 1.0** (`EXPOENTE_TIPO`), ou seja, a tabela oficial — 2× é 2×.
  Ele já foi `0.6` (comprimido: 2× virava 1,52×), pra tipo não virar sentença de morte num jogo
  onde não dá pra trocar de pokémon no meio do confronto. Voltou pra 1.0 em 30/08/2026, medido:
  **4,1% das batalhas mudam de vencedor**, taxa de vitória geral igual (50,7% → 50,5%) e a
  dificuldade dos ginásios praticamente não se move (maior variação: Erika +8 pontos, Sabrina −3).
  É o parâmetro mais sensível do motor: ele define o quanto o jogo é "sobre tipo" e o quanto é
  "sobre atributo". **Entra em DOIS lugares — o dano e a escolha do golpe** — e os dois têm que
  usar o mesmo valor: quando a escolha usava o cru e o dano o comprimido, o motor escolhia um tipo
  e aplicava outro, e cliente e servidor discordavam do melhor golpe em 4% dos confrontos.
- **Golpe teimoso (`IMUNIDADE_TEIMOSA = 0,25`)**: quando NENHUM tipo do atacante machuca o alvo,
  o melhor golpe sai com multiplicador 0,25 em vez do piso de 1 de dano. A constante depende do
  `EXPOENTE_TIPO`: com o expoente em 0,6 ela era 0,10 (que virava 0,25 depois da compressão). O
  que se quer manter é o EFEITO — o atacante sem saída tira ~15% da vida por golpe. É o que impede confronto
  matematicamente perdido — Hitmonlee (Lutador puro) contra Fantasma, Dugtrio (Terra puro) contra
  Voador: 25 espécies, 139 confrontos, ninguém com jogada possível, e aqui não dá pra trocar de
  pokémon no meio. **A imunidade continua absoluta quando existe alternativa**: o Raichu troca o
  Raio pelo golpe Normal contra Terra e não passa nem perto do teimoso.
  Medido: 139 confrontos impossíveis → 0; 1% das batalhas mudam de vencedor.
  Atenção: dar subtipo **Normal** a um Lutador NÃO resolve — Normal também é 0 contra Fantasma.
- **Imunidades valem 0 de novo** (eram 0,25). Voltou a ser fiel à Gen 1: Normal não acerta
  Fantasma, Elétrico não acerta Terra, Terra não acerta Voador. Medido na volta: **0,7% dos
  22.500 confrontos possíveis** ficam sem golpe útil (o motor tem piso de 1 de dano por golpe,
  senão dois imunes travariam o laço), **2,7% das batalhas mudam de vencedor** e a taxa de
  vitória geral quase não se move (51,4% → 51,1%).
  Quem mais perde com isso: Diglett/Dugtrio/Cubone/Marowak (Terra puro, 19 espécies voadoras que
  eles não alcançam), Raichu (14) e os Normal puros contra os três Fantasmas. O subtipo é o que
  salva o resto — 69 espécies têm um tipo alternativo pra recorrer.
  No log isso aparece como "**mas não teve efeito**", com o −1 do piso: sem essa frase o jogador
  vê um −1 solto e procura bug onde é regra.
- **A VELOCIDADE ESCALA COM O NÍVEL desde 20/09/2026, e é a FÓRMULA OFICIAL DA GEN 3:**
  `floor( (2×Base + IV + floor(EV/4)) × Nível / 100 ) + 5` — e como o jogo não tem IV, EV nem
  natureza, sobra `floor(2×Base × Nível / 100) + 5`. Ela é a mesma que a Corrida já usava.
  **⚠️ ATÉ AQUI ELA NÃO ESCALAVA, e era o último desvio de regra do motor**: um Jolteon Lv.5 e um
  Lv.99 devolviam **130 igual**. Passou despercebido porque a velocidade é o **único atributo que
  não entra numa fórmula** — os outros cinco entram no cálculo de dano, onde o nível já estava.
  Ela entra numa **COMPARAÇÃO**, e comparar dois valores de base ignora o nível por completo.
  **O que isso produzia:** um Jolteon **Lv.5** batia antes de um Snorlax **Lv.99** (130 contra 30;
  na Gen 3 é 18 contra 64), e um Raichu Lv.64 **empatava** com um Tentacruel Lv.80 (os dois base
  100) — o que fazia o desempate ser sorteado a cada troca e o log mostrar o mesmo pokémon atacando
  duas vezes seguidas. Foi esse o relato que trouxe a mudança. Na Gen 3 seriam 133 contra 165.
  **⚠️ O NÍVEL ENTRA ANTES DOS MULTIPLICADORES**, que é a ordem do original: a fórmula produz o
  ATRIBUTO, e paralisia (×0,25), estágio e os nossos shiny/terreno/fúria são modificadores DELE.
  Invertendo, o `+5` da fórmula seria multiplicado junto.
  **⚠️ E ELA SÓ É LIDA EM COMPARAÇÃO**, o que é o que torna a mudança contida: os três pontos do
  motor que a usam são a ordem da troca, a ordem do sorteio de especial e a do Remoinho. Nenhuma
  conta de dano a lê.
- **⚠️ E A VELOCIDADE NÃO ALIMENTA MAIS O CRÍTICO — esta linha dizia que sim, e estava caduca desde
  10/09/2026**, quando o crítico virou os estágios da Gen 3 (1/16 fixo, 1/8 nos oito golpes de
  crítico alto). Hoje o `chanceDeCritico` só olha o GOLPE. O mesmo texto vencido estava no
  comentário do `effectiveSpeed` nos dois motores, e saiu junto.
- **A especialidade vale 1,05× em todos os atributos, e agora tem selo.** Era **1,01×**, e a conta
  não fechava com o preço: 50 pokémon levados ao nível 65 são meses de jogo, e o retorno era **+1
  ponto de ataque** num Nidoking nível 60 (92 → 93). Os jogadores reclamaram que "não mudou nada" e
  estavam certos — medido, quem conquistava a especialidade ganhava **0,2 ponto** de vitória num
  time misto. Hoje ganha **0,9**, e um time inteiro do tipo vai de +1,45 pra **+7,1 pontos**
  (40,95% → 48,02%).
  Fica **abaixo do terreno (1,15) e do shiny (1,20)** de propósito: a especialidade cobre um TIPO
  inteiro do time, não um pokémon.
  **O CLAUDE.md dizia que o buff valia "~13 pontos percentuais"** — medido agora, é 7,1 no melhor
  caso possível (time todo do tipo) e 0,9 no caso real. O número velho vinha de outra época e
  sobreviveu à mudança do valor.
- **O selo 🎖️** aparece ao lado do 🌟 (shiny) e do 🔺 (terreno) nas CINCO telas de batalha: jornada,
  ginásio, torre, Rocket, liga assistida e online. O confronto passou a carregar
  `playerSpecialty`/`enemySpecialty`; no online, que desenha o time a partir do estado e não de um
  confronto, o servidor manda as especialidades dos dois lados no payload.
  **Metade da reclamação era isso**: sem selo, o jogador não tinha como saber que o bônus estava
  valendo — e com 1% ele também não sentia.
- **A raide do Mew era a ÚNICA batalha que não aplicava o buff.** O shiny valia (a flag vem na
  instância), a especialidade não. Ninguém tinha como notar, porque ela valia 1% e era invisível.
  `tools/test-especiais.js` passou a LER O CÓDIGO e falhar se alguma chamada de `simulateGymBattle`
  ou `simulateBossFight` não tiver um `applySpecialtyBuff` por perto. É chato e é o único jeito de
  pegar a próxima omissão — esta passou despercebida por semanas.
- **Todo modo aplica os mesmos buffs.** Shiny e especialidade valem em TODA batalha (liga, liga dos
  treinadores, ginásio do bairro, torre e online); terreno só existe onde há terreno escolhido
  (liga, liga dos treinadores e ginásio do bairro — na torre e no online não existe terreno).
  Um caminho que esquecia o buff já aconteceu: desafio do lobby criava batalha com `specialties: []`
  porque `joinBattleLobby` não gravava o campo. Medido em 02/09/2026, com o buff em 1,05: um time todo do tipo vale **+7,1 pontos** de
  vitória (40,95% → 48,02%) e um time misto, **+0,9**. "+1% em tudo" engana — em batalha parelha decide.
- Buffs: **shiny 1,20× e terreno 1,15×, nos SEIS atributos** — HP, Ataque, Defesa, **Ataque
  Especial, Defesa Especial** e Velocidade. Multiplicam entre si: um shiny no terreno do tipo dele
  fica 1,38× em tudo.
  **⚠️ ESTE ITEM DIZIA "ataque, especial, defesa, velocidade e HP"**, que é texto de quando a Gen 1
  tinha **UM** campo `special`. Ele sobreviveu à separação em Sp.Atk/Sp.Def (30/08/2026) e passou a
  deixar dois atributos de fora da lista — **e a mesma frase incompleta estava na TELA**, na caixa
  que explica o terreno ("+15% em todos os atributos (HP, Ataque e Defesa)"). Reportado em
  15/09/2026: *"verifique se a vantagem de terreno também aumenta em 15% os stats de ataque especial
  e def especial, porque isso não ta escrito no texto"*.
  **CONFERIDO NO MOTOR, e a mecânica sempre esteve certa:** o `withBuffs` é chamado pelas **SEIS**
  `effective*`, nos dois motores. Medido num Alakazam Lv.50 com a flag de terreno — **SpAtk 135 →
  155 e SpDef 85 → 98**, junto com HP 55→63, Atk 50→57, Def 45→52 e Vel 120→138. As razões ficam
  entre 1,140 e 1,156 só pelo **arredondamento** (`Math.round` por atributo), não por regra.
  **O QUE FOI CORRIGIDO FOI O TEXTO**, aqui e na tela. Custo medido a 320px: a caixa do terreno vai
  de **283 para 321px** (+38px) e a frase de 3 para 5 linhas — sem rolagem lateral.
  Houve uma fase em que foram só ofensivos (1,15 e 1,10); acabou, por decisão de design.
  O custo é conhecido e aceito: 1 contra 1 da mesma espécie, um shiny no terreno dele em nível 60
  ganha de um normal de nível 70 em 90% das vezes. O buff vale ~15 níveis.
- **O buff de terreno mexe no TETO de HP**, não só no dano — ele entra em todos os atributos, e o
  HP base é um deles. Um Gyarados nível 73 tem teto 490 fora d'água e 504 dentro. Onde o HP
  carrega de uma luta pra outra (Elite 4, `preservePlayerHp`), o que carrega é a **fração de
  vida**, nunca o número cru: cru, ele entrava na luta da Lorelei com 490/504, machucado sem ter
  apanhado, e na luta seguinte — sem o terreno — ficava com 504 de HP num teto de 490.
- Os buffs entram por `withBuffs()`, chamada pelas cinco `effective*`. **Existe uma cópia em cada
  arquivo e elas têm que ser idênticas, inclusive na ordem de arredondamento** (shiny → terreno).
  `applyTerrainBuff` só marca a flag — nunca mutar atributo, senão o bônus aplica duas vezes.
- **O Ditto ataca com o tipo de quem ele copiou** (`tiposProprios`/`ehDittoTransformado`). A tela já
  mostrava o sprite do adversário desde sempre; o golpe passou a acompanhar em 01/09/2026 — virou
  cópia de um Gengar, ataca de Fantasma. Copia **só o ataque**: os atributos (48 em tudo), a defesa
  e o tipo que ele APRESENTA continuam sendo dele. Copiar os atributos faria dele um segundo
  Gengar, e não é o que ele é.
  **SOMA os tipos do alvo aos dele, não troca** — e isso foi medido, não escolhido no gosto:
  trocando, ele passava de 151 pra **163** espécies contra as quais nunca ganha, porque o Normal
  dele é 1× em quase tudo e no ESPELHO um monte de tipo resiste a si mesmo (Fogo contra Fogo é
  0,5×). A mudança pioraria justamente o pokémon mais fraco do jogo. Somando: **16,8% → 22,1%** de
  vitória média no 1x1 contra as 249, e **15 confrontos impossíveis a menos**. Na jornada não se
  move (63,0% → 62,7%, 0,45σ): é uma espécie em 250.
  Os tipos copiados valem como **próprios** (STAB, sem o redutor de subtipo) e vêm **primeiro na
  lista de candidatos**, porque o `bestAttackType` guarda o primeiro de nota máxima: no empate ganha
  a cópia. Sem isso, contra um Charizard ele atacava de Investida — Voador e Normal dão o mesmo
  dano ali — e a transformação não aparecia na tela. Não custa um ponto de dano, só desempata a
  favor do que a tela está mostrando.
  O nome do golpe sai do `MOVE_BY_TYPE` (o `MOVE_OVERRIDES` do Ditto só tem Normal), e os 17 tipos
  têm nome lá — conferido no teste, senão a linha do log sairia sem golpe.
- Subtipos: 70 espécies atacam por um tipo alternativo quando rende mais dano. Sem STAB, com
  redutor 0,85. O Raichu entrou na lista quando a imunidade voltou a valer 0: Elétrico é o único
  tipo com imunidade cujo dono não tinha alternativa, e sem Normal ele ficava com 1 de dano por
  golpe contra qualquer pokémon de Terra.
- Teto de nível: **99** (`NIVEL_MAXIMO`). ⚠️ Ele se chamava `MAX_POKEMON_LEVEL` neste arquivo e o
  nome tinha caducado: até 17/09/2026 o 99 vivia escrito à mão no único lugar que precisava dele.

## Johto (#152-251) — em uso desde 30/08/2026

- As 100 espécies entraram nas tabelas EM USO (`SPECIES`, `GEN2_SPECIAL`, `EVOLUTIONS`), nos dois
  arquivos. Até então viviam em tabelas paralelas justamente pra não contar antes da hora.
  **A Pokédex foi a 250** — o #151 (Mew) continua de fora: é o chefe da raide e ninguém o captura.
  O pool da Torre (evoluções finais) foi de 81 pra **143**.
- Números reconstruídos dos dados do Pokémon Showdown aplicando os mods gen8→gen2 sobre os valores
  atuais. **Método conferido: bate 150/150 com o `GEN2_SPECIAL` de Kanto que já estava aqui.**
- **Sombrio e Aço entraram no `TYPE_CHART`**, com os valores da Gen 2 (o Aço ainda resiste a
  Fantasma e a Sombrio — isso só mudou na Gen 6). Acrescentar tipo NOVO não mexeu em nada do que
  já existia: nenhuma das 150 de Kanto é Sombrio ou Aço (o jogo usa a tipagem da Gen 1, então
  Magnemite e Magneton seguem só Elétrico), então toda linha nova só entra em confronto que
  envolve um pokémon de Johto. **Conferido: a impressão do motor não mudou.**
- **As três evoluções em conflito ficaram de fora**: Gloom, Poliwhirl e Slowpoke continuam virando
  Vileplume, Poliwrath e Slowbro. A tabela mapeia um destino só, e a chave repetida faria o segundo
  apagar o primeiro em silêncio.
  Bellossom, Politoed e Slowking chegam pela **tela de escolha** (`EVOLUTION_CHOICES`, ver a seção
  da bifurcação) — o `tryEvolve` intercepta antes de usar a tabela. Eles seguem também no pool de
  rotas, o que é de propósito: dá pra encontrar um selvagem sem depender de criar a linha inteira.
- **Armadilha que quase passou**: Espeon e Umbreon estavam na tabela de evoluções de Johto como
  destino do `eevee`. Ao fundir, o Eevee passou a evoluir sozinho pra Umbreon no nível 40 —
  atropelando a tela de escolha dele. Pego pelo `tools/test-johto.js`, que hoje trava isso.
- A conquista "Pokédex Clássica" (149 espécies) virou **"Pokédex de Kanto"**: com 250 espécies,
  "149" não significava mais nada. "Mestre Pokémon" passou a exigir as 250.
- `node tools/test-johto.js` cobre a fusão: as duas cópias iguais (comparando VALOR, não texto —
  os dois arquivos têm comentários próprios e listam em ordens diferentes), 152–251 sem buraco, os
  dois tipos novos completos, e as evoluções de Kanto intactas.

## Golpes especiais (autodestruição, sono, metrônomo, Disable e Recuperar)

São os **primeiros efeitos do jogo que não são dano** — até aqui todo confronto se resolvia por
troca de golpes e desempate. Entram no `doExchange`, nos DOIS motores, e o teste que garante que os
dois continuam idênticos é `tools/test-especiais.js` (300 batalhas com a mesma semente, comparadas
golpe a golpe). Ele tranca também as três frases exatas e que o Disable não entra na sequência
de golpes.

- **AUDITORIA DE 04/09/2026: sete espécies faltavam, e a de Hipnose era literalmente só a lista da
  Gen 1.** Um jogador reportou o **Politoed** (aprende Hipnose por nível na Gen 2) e pediu pra
  conferir o resto; as seis listas foram revistas move a move no Bulbapedia. Entraram:
  **Politoed, Noctowl, Yanma e Misdreavus** (Hipnose), **Tangela** (Pó do Sono, e essa era da Gen 1
  mesmo), **Smoochum** (Canto) e **Igglybuff** (Disable). Autodestruição, Recuperar e drenagem já
  estavam completas.
  `tools/test-especiais.js` passou a NOMEAR as sete: a próxima omissão tem que ser barulhenta, e
  uma contagem sozinha ("37 espécies") não diz QUAL está faltando.
- **As listas saem do aprendizado por NÍVEL da Gen 1/2**, não da "quem pode aprender de algum jeito".
  Autodestruição são **9** (Geodude/Graveler/Golem, Voltorb/Electrode, Koffing/Weezing,
  Pineco/Forretress). Sono são **37**, cada uma com o nome do golpe dela (`SONIFEROS` guarda o par
  espécie→golpe: Pó do Sono, Esporo, Hipnose, Canto, Beijo Adorável) — sem isso o Paras dormiria o
  adversário com "Hipnose" e quem conhece o jogo notaria na hora.
  Metrônomo são **6 desde 11/09/2026** (Cleffa, Clefairy, Clefable, Mew, Togepi, Togetic).
  Eram 4 (Togepi, Togetic, Cleffa, **Snubbull**), viraram 7 em 10/09 quando a decisão de deixar
  Clefairy/Clefable/Snorlax de fora — "espécies comuns em time de jogador e de líder" — foi
  revertida a pedido, e o Snubbull saiu. **O SNORLAX SAIU EM 11/09**, também a pedido: a lista era
  a alavanca que esta seção já apontava, e ela foi usada.
  Ver a seção **O METRÔNOMO SORTEIA E DEPOIS ESCOLHE**, que é onde a mecânica está descrita.
- **⚠️ O sono dá de 1 A 3 TROCAS livres desde 15/09/2026, 1/3 cada** (`SONO_EM_TROCAS`, hoje uma
  TABELA com peso — ver a seção **O SONO DURA DE 1 A 3 TROCAS**). O alvo apanha sem revidar e
  então acorda; a luta segue normal. **Tudo que este item diz abaixo sobre "uma troca" é a régua de
  09/09 a 15/09/2026**, e continua valendo como história: o efeito isolado hoje é +29,0 pontos, não
  +17,8. Como o Disable e a Recuperação, é `continue` e não
  `return true`: o confronto acontece inteiro.
  **Eram DUAS até 09/09/2026** (a mudança de 02/09 que tirou a morte instantânea). Virou uma a
  pedido — *"ao invés de dar 2 golpes em sequência, dê apenas 1 e depois volte a batalha como se
  fosse uma nova"*.
  **Medido com o sono FORÇADO (chance 100%)**, que é o único jeito de isolar o efeito: a 5% por
  confronto ele se dilui e some no ruído de qualquer amostra que caiba num teste. 1x1, 16
  soníferos × 8 adversários × 40 voltas: sem sono **23,0%** de vitória, com 2 trocas **52,8%**
  (+29,8), com 1 troca **40,8%** (+17,8) — ou seja, **uma troca livre entrega 60% do que duas**.
  **Na jornada não se move:** 76,15% → 76,81% de conclusão (8.000 jornadas de cada lado, +0,66
  ponto, **1,0σ**). Faz sentido — os líderes também têm sonífero, e o corte cai dos dois lados
  igual. (Os dois números estão altos porque a medição foi feita com o teto de dano desligado,
  que é o experimento em curso; o que importa aqui é a diferença.)
  **Quantas trocas livres SAEM na tela, medido:** antes eram 1× em 43%, 2× em 39% e 3× em 15%;
  hoje são **1× em 75,5%** e 2× em 24,1% — a segunda só quando o adormecido é o mais lento e o
  outro bate de novo na troca em que ele acorda. O log encurtou junto: o pior caso com sono vai
  de **6 linhas para 5**.
  **Mudou por reclamação dos jogadores, e a medição explicou por quê**: não era o NÚMERO que pesava
  (valia **+1,4 ponto** de vitória, contra +0,8 do Recuperar — nem de longe o mais forte do jogo),
  era a FORMA. Perder um pokémon inteiro pra um sorteio de 5%, sem jogada possível e sem sequer
  tomar um golpe, é ruim mesmo valendo pouco. Baixar a chance seria o remédio errado: o golpe ficaria
  mais raro e igualmente injusto quando saísse.
  **Medido depois:** o ganho cai de **+1,4 pra +0,7 ponto** (mesmos times dos dois lados, 8.000
  batalhas; o controle sem sonífero fica parado em 49,7%, o que valida a medição). Na jornada não se
  move: 60,8% → 60,2%, 1,0σ.
  Efeito colateral bonito: quem aproveita bem quase não perde poder (Gengar, rápido e forte, vai de
  +1,47 pra +1,31), e quem não aproveita perde muito (Paras, de +1,54 pra +0,53). O golpe passou a
  premiar quem consegue capitalizar em vez de ser um botão de deletar pokémon igual pra todo mundo.
- **Quem dorme não vira linha no log.** O golpe do adormecido não entra no diário — uma linha de
  "−0 de HP" faria o log dizer que ele atacou e não machucou, quando o que aconteceu foi ele não ter
  atacado.
- **A reconstrução chegou a contradizer o sono, e hoje não tem como.** Ela não conhece os golpes
  especiais — só interpola HP —, então ora começava pelo golpe de quem tinha acabado de dormir, ora
  esmagava os golpes livres de quem dormiu o outro num golpe só ("um golpe dele, dois dela",
  reportado duas vezes em 03/09/2026). Foram duas tentativas de remendo, e a segunda quebrou o
  moribundo em 23,7% dos confrontos.
  O conserto certo foi outro: **o log passou a mostrar o diário inteiro** (ver a seção do Log de
  batalha), e a reconstrução virou o fallback que ela sempre foi por escrito. Sem ela no caminho não
  há o que contradizer — e os remendos saíram.

- **Chance por CONFRONTO, não por golpe**: 15% autodestruição, **15% sono** (era 5% até
  15/09/2026 -- ver **E A CHANCE FOI A 15%**).
  **Só sai contra alvo com MAIS da metade da vida** (`BOOM_MINIMO_DO_ALVO = 0,5`, 02/09/2026).
  Explodir num adversário já machucado é trocar o pokémon inteiro por um abate que a troca de golpes
  ia entregar de graça — e isso acontecia de verdade, porque no laço de batalha o inimigo carrega o
  HP de um confronto pro outro. Medido: **9,7% das explosões** eram assim, e a trava as remove sem
  mexer no resto (taxa de vitória do time com um Golem: 60,7% → 60,5%). Quem decide é a SITUAÇÃO do
  alvo, não o sorteio -- a chance continua sendo 15%. O marcador é o próprio
  adversário (`active._especialContra !== enemy`) — oponente novo, confronto novo. Se fosse por
  golpe, um Geodude explodiria em ~40% dos confrontos e a lista viraria o jogo inteiro.
- **Metrônomo é 10% explosão / 10% sono / 10% anulação / 70% golpe comum** -- ele chama
  "qualquer poder existente no jogo", então cada efeito novo entra no bolo dele também, e o golpe comum sai com o **tipo
  sorteado** (`tipoDoGolpe`) em vez do melhor disponível. É o que faz dele uma aposta e não um
  upgrade: medido 1x1 contra Onix, o Togepi vai de 0% pra 26,3% de vitória — o resto do jogo
  continua usando `bestAttackType`, e o `tipoDoGolpe` só desvia pra quem está no `METRONOMO`.
- **Disable (`DISABLE`, 10%): 16 espécies**, e é o único dos quatro que **não resolve o confronto** —
  ele tira o melhor golpe do adversário e a luta acontece inteira, com ele mais fraco. O tipo que
  renderia mais dano contra QUEM anulou sai da escolha (`_anulado`, casado por identidade com o
  oponente: adversário novo, confronto novo) e entra o segundo melhor.
  **Só vale contra quem TEM um segundo golpe**: 157 das 250 espécies (62,8%). Quem é de um tipo só
  e sem subtipo — Onix, Hitmonlee — não tem o que anular, e inventar uma punição pra ele seria
  outra regra, não esta; o sorteio simplesmente não vale contra ele.
  A lista sai do aprendizado por nível, como as outras: Psyduck/Golduck, Kadabra/Alakazam,
  Slowpoke/Slowbro/Slowking, Grimer/Muk, Lickitung (Gen 1) + Jigglypuff/Wigglytuff,
  Venonat/Venomoth, Drowzee/Hypno (a Gen 2 deu Disable a eles). Vulpix, Ninetales, a linha do
  Nidoran, Seel, Kangaskhan, Horsea, Spinarak e Stantler aprendem **só por reprodução** e ficaram
  de fora. **O Mewtwo aprende nas duas gerações e mesmo assim não está na lista**: ele e o Mew são
  imunes ao bloco INTEIRO, então a entrada seria letra morta — o tipo de coisa que fica anos no
  código sem nunca rodar.
  `bestAttackType` e o Disable leem a MESMA lista de tipos (`tiposDeAtaque`): separadas, ele
  anularia um tipo que a escolha nem considerava.
  **Medido:** aparece em 8,7% das batalhas e em 1,0% dos confrontos, mas quando pega é pesado —
  1x1, o Slowbro vai de 20,2% pra 87,0% contra um Venusaur anulado, o Alakazam de 28,7% pra 73,3%
  contra o Gengar. Na jornada isso **não se move**: conclusão 62,1% → 62,8% em 20.000 jornadas de
  cada lado (1,3σ, ruído). Faz sentido — 1% dos confrontos, e cai dos dois lados igual.
- **A frase aparece NO MEIO DA BATALHA, não só no log**, na mesma linha onde se lê "Trocando
  golpes..." — é onde o jogador já está olhando, então não precisou de caixa nova. São três, e a
  do Disable começa pelo ALVO porque é o nome dele que a pessoa procura:
  *"Golem usou auto-destruição"*, *"Butterfree fez Arbok dormir"*, *"Gengar teve seu melhor ataque
  anulado por Alakazam"*. Elas vivem numa função só (`fraseDoEspecial`), lida pelo log E pelo aviso:
  montadas em separado divergiriam no primeiro ajuste de texto, que é exatamente o que já aconteceu
  entre o log e a animação.
  O **nome do golpe de sono entra só no log** ("dormir com Esporo"): ele é por espécie de propósito,
  mas o aviso se lê em um segundo e ali a frase curta é a que chega.
- **QUEM MANDA NA LINHA DE STATUS, passo a passo** (`passosDaAbertura`). São duas famílias, e a
  diferença é o que o confronto É:
  - **a autodestruição ocupa a linha o confronto INTEIRO** — ali não há luta depois, o confronto
    é aquilo (os dois caem no mesmo golpe);
  - **sono, cura, poção, drenagem, anulação e Despertar são ABERTURA**: valem os passos que a
    barra delas leva pra andar (a drenagem vale 2, que são as duas barras) e **cedem o lugar ao
    nome do golpe** assim que a luta começa.
  **O SONO ENTROU NA LISTA em 09/09/2026, junto com a troca livre virar uma só.** Reportado num
  Haunter × Dunsparce: a luta inteira só se lia *"Haunter fez Dunsparce dormir"* enquanto a barra
  do Dunsparce descia duas vezes, e o nome do golpe que batia nele — Devorador de Sonhos — nunca
  aparecia. **O log estava certo**, trazia os dois golpes com nome e selo; o defeito era só do
  aviso do meio da batalha. Com uma troca livre o confronto deixou de "ser" o sono, e a frase
  passou a ceder.
  Ele vale **2 e não 1 como a anulação** porque o sono **É um passo da animação**: o registro dele
  entra na sequência com dano 0 (barra parada), então a frase precisa cobrir o passo 0 (a pausa de
  leitura) **mais** o passo dele. Cede no golpe livre, que é o primeiro que mexe barra — e é
  justamente o golpe cujo nome foi pedido. Perfil trancado no teste: `EEggg`.
  **A anulação e o Despertar ficaram FORA dessa tabela até 09/09/2026, e sem entrada a frase vale
  pra SEMPRE.** Reportado num Venusaur × Muk: durante a luta inteira só se lia *"Venusaur teve o
  ataque Raio Solar anulado por Muk"* enquanto as barras desciam, e o nome de nenhum golpe
  aparecia. **O log estava certo** — ele monta a linha da anulação à parte e não passa por aqui; o
  defeito era só do aviso do meio da batalha. Elas são as únicas aberturas que **não mexem barra
  nenhuma**, e foi justamente por isso que passaram despercebidas: as outras quatro têm uma barra
  andando pra denunciar quantos passos elas precisam durar.
  `tools/test-especiais.js` tranca o perfil das cinco passo a passo (`EEEE` pro sono, `Egg` pra
  anulação) **e** que toda abertura esteja declarada na tabela — sem essa segunda parte, o próximo
  especial de abertura nasce com o mesmo defeito e ninguém percebe.
- **Pausa de 1s pra ler** (`PAUSA_LEITURA_ESPECIAL_MS`). Sem ela a frase some junto com o primeiro
  golpe, e num confronto resolvido por autodestruição — que dura um golpe só — ela mal pisca. Entra
  nas quatro telas de revelação, somada aos 550ms que já existiam antes do primeiro golpe.
  **No online ela não custa nada**: lá já existe uma parada de 1s (`ANUNCIO_MS`, o "Vai Fulano!") e
  o aviso ocupa o lugar dela, então o `ORCAMENTO_ANIM_ONLINE_MS` continua intocado. Os matchups do
  online vêm na perspectiva do A, e quem é o B **vira os lados do diário junto** — sem isso a frase
  troca quem anulou por quem foi anulado.
- **O Disable fica FORA da `sequenciaDoConfronto`.** Ele não tira HP e a luta continua depois dele,
  então viraria um passo de dano 0 na animação. (Ele também gastava uma vaga do `TETO_GOLPES`, o
  que jogava uma troca real de 2 golpes na reconstrução — esse motivo caducou em 03/09/2026, quando
  o teto saiu e o log passou a mostrar o diário inteiro; o primeiro continua valendo.)
  A linha dele é montada à parte e vem **antes** de
  tudo no log: a anulação acontece na abertura, e a luta que se lê embaixo já é a luta com o golpe
  anulado.
- **Recuperar (`RECUPERACAO`, 10%): 10 espécies, e acontece ANTES da luta.** O pokémon que sobreviveu
  ao confronto anterior entra machucado; se ele tem o golpe e está **abaixo de 70% da vida**
  (`CURA_MAXIMO_DO_HP`), se cura ANTES de o novo adversário atacar — e aí o confronto acontece
  inteiro, com ele cheio.
  Ela **não resolve o confronto**, igual ao Disable: é `continue`, não `return true`.
  **Já esteve no FIM do `doExchange`** (o vencedor se curava depois de ganhar). Era o mesmo número
  com metade da graça — a cura chegava quando a luta já tinha sido decidida. Mudou por feedback dos
  jogadores em 02/09/2026.
  A trava dos 70% existe porque com a vida quase cheia não há o que recuperar, e a frase anunciaria
  um efeito que mal se vê na barra.
  A lista sai do aprendizado por nível: Kadabra/Alakazam, Staryu/Starmie, Porygon/Porygon2, mais
  Corsola, Lugia, Ho-Oh e Celebi. **Recover não é TM em nenhuma das duas gerações e não sai por
  reprodução**, então a lista de "quem aprende por nível" é a lista inteira. O **Mewtwo** aprende e
  ficou de fora: ele e o Mew são imunes ao bloco inteiro, e ali seria letra morta.
  **Quem tem Disable E Recuperar** (Kadabra, Alakazam) cai na chance composta: o Disable é sorteado
  primeiro, então o Recuperar sai em 0,9 × 10% = 9%. Medido, 9,2%.
- **NA TELA: a frase primeiro, a barra depois, e a luta por último.** A cura é o PRIMEIRO passo da
  animação. O jogador vê o pokémon entrar machucado, lê a frase, vê a barra subir, e só então a luta
  começa. Medido no navegador (Alakazam entrando com 30% contra uma Rapidash cheia):
  `0ms` frase + 30% · `1650ms` barra em 100% · `2400ms` a frase sai e a luta começa · `4200ms` resultado.
  Três coisas fazem isso funcionar:
  - o motor grava **quanto** foi curado (`d` do registro), senão a animação não teria o que desenhar;
  - o passo mexe na barra de **quem curou** (as outras linhas dizem quem APANHA) e com valor
    **negativo**, porque os laços fazem `hp - amount` e o `hpBarTransitionMs` usa o módulo;
  - **o aviso sabe em que passo a animação está** (`avisoDoConfronto(m, passo)`): a frase da cura
    anuncia a barra que VAI subir, então ela sai assim que a barra subiu. Sem isso ela ficava na
    tela o confronto inteiro, ocupando o lugar do "Trocando golpes...". Autodestruição e sono são o
    contrário: ali o confronto INTEIRO é aquilo, e a frase acompanha até o fim.
  (A cura não gastava vaga do `TETO_GOLPES`, e quando o confronto passava do teto a reconstrução
  tinha de partir da vida CHEIA — senão a barra caía de um valor que a luta nunca teve. Isso caducou
  em 03/09/2026 junto com o teto: o log mostra o diário, e a cura está nele.)
- **⚠️ DRENAGEM DE ABERTURA (`ABSORCAO`) — ISTO É HISTÓRIA: ela foi REMOVIDA em 15/09/2026**, quando
  a drenagem passou a valer no GOLPE (ver a seção própria). O que este item descreve não acontece
  mais; o que ficou dele é só a apresentação, pra log velho. Era assim:
  **10%: 23 espécies, e acontecia ANTES da luta**, no mesmo lugar do Recuperar.
  O pokémon que sobreviveu ao confronto anterior entra machucado; se está **abaixo de 70%**
  (`CURA_MAXIMO_DO_HP`, a trava do Recuperar), ele tira uma fatia do adversário e põe em si — e só
  então o confronto acontece, inteiro. É `continue`, não `return true`.
- **A MESMA FRAÇÃO dos dois lados, mas cada um do PRÓPRIO teto** (`ABSORVER_MIN` 10% a
  `ABSORVER_MAX` 30%, sorteada a cada uso). Um Vileplume de 47% que drena 25% vai a 72%, e o
  Fearow cheio cai pra 75% — não é o mesmo número de HP nos dois, é a mesma porcentagem.
- **A trava dos 70% tem um segundo efeito aqui, e ele é o motivo de ela ficar:** com o teto de 30%,
  um pokémon abaixo de 70% **nunca passa de 100%** — a cura jamais é desperdiçada. Sem a trava, um
  pokémon cheio drenaria só pra machucar o outro, e a barra DELE não se moveria: um passo de cura
  zero na animação, que é o que este log evita em toda regra.
- **NÃO MATA**: o alvo fica com no mínimo 1 de HP. Todas as aberturas deste motor (Recuperar,
  Disable, poção) deixam a luta acontecer, e um efeito de abertura que resolvesse o confronto
  sozinho seria um confronto sem um único golpe na tela.
- **A LISTA SAI DO APRENDIZADO POR NÍVEL DA GEN 1/2**, conferida move a move no Bulbapedia — e a
  intuição erra duas vezes: **Kabuto e Kabutops** aprendem Absorb e Mega Drain por nível apesar de
  serem Pedra/Água, e o **Bulbasaur NÃO entra** (o que ele tem é Leech Seed, que é outra coisa).
  **Giga Drain ficou de fora porque na Gen 2 ele é TM19** — ninguém o aprende por nível.
  São três golpes: Absorver (9 espécies), Mega Dreno (5, que também aprendem Absorb e ficam com o
  nome do que ganham depois) e **Sanguessuga** (9, do Leech Life). Cada espécie guarda o NOME do
  golpe dela, como no `SONIFEROS`: sem isso um Zubat drenaria com "Absorver".
  No selo, **Sanguessuga é INSETO** e os outros dois são Planta — um Zubat drenando no verde de
  Planta estaria errado.
- **DUAS entradas no diário, uma por barra** (`absorb` + `absorbdano`), como a explosão: a primeira
  sobe a vida de quem drenou e a segunda desce a do alvo. **No log elas viram UMA linha só** — a
  segunda existe pro cálculo e pra barra, não pra leitura.
  Por isso o aviso do meio da batalha **dura DOIS passos** (`passosDaAbertura`): a cura e a poção
  mexem uma barra, a drenagem mexe as duas, e a frase sumindo no primeiro deixaria a segunda barra
  andando sem nada explicando.
- **Medido: não move a jornada.** 2.500 jornadas de cada lado, **67,8% x 68,2%** de conclusão
  (0,4σ, ruído). Faz sentido — ela vale 10% por confronto pras 23 espécies, e cai dos dois lados
  igual: os líderes também têm Oddish, Zubat e Paras.
- **Mew e Mewtwo são imunes** (`IMUNES_A_ESPECIAL`). O Mew é o chefe da raide global, com 25.125 de
  HP calibrados pra ~399 ataques: um Geodude nível 20 com 15% de chance de derrubá-lo num golpe
  acabaria com a raide da semana. O Mewtwo é o desafio de fim de jogo pelo mesmo motivo. Medido com
  a imunidade desligada: **472 explosões em 3.000 batalhas** contra o Mewtwo.
- **O nome do golpe especial sai no SELO DO TIPO**, igual aos golpes comuns (`seloDeGolpe`, e o
  `golpeSeloHtml` passou a usar a mesma função — uma forma só pro selo). O tipo vive no
  `TIPO_DO_ESPECIAL`, **só no cliente**, como o `MOVE_BY_TYPE`: o motor manda o que aconteceu, o
  cliente escolhe a palavra e a cor.
  **Pesquisado, e a intuição erra: autodestruição é NORMAL**, não Terra nem Pedra. Só os dois pós
  (Pó do Sono, Esporo) são Planta e a Hipnose é Psíquico; Canto, Beijo Adorável, Anulação e
  Metrônomo são Normal.
  No **aviso do meio da batalha** o nome sai em texto puro, sem selo: ali a frase se lê em um
  segundo e um selo colorido no meio dela é mais uma coisa pra o olho parar.
- **A ANULAÇÃO PASSOU A GRAVAR O GOLPE, não só o tipo (09/09/2026).** Ela gravava o TIPO (`a`) e o
  cliente virava em palavra pelo nome GENÉRICO daquele tipo — e com golpe escolhido isso nomeia um
  golpe que o pokémon **não carrega**. Reportado junto com o moveset dos NPCs: *"os pokémons que
  possuem disable não estão desativando um dos ataques que o pokémon possui, ele tá pegando um
  qualquer aleatório"*. Hoje o motor manda também o **id do golpe** (`am`) quando ele existe, e a
  frase sai com o nome dele; sem `am` (log velho, ou pokémon sem golpe escolhido) cai no nome do
  tipo, como sempre saiu.
  **A GUARDA do "só vale contra quem tem um segundo golpe" mudou junto**: com golpe escolhido o que
  conta são os TIPOS dos golpes que ele LEVA, não os tipos da espécie — dois golpes do mesmo tipo
  caem juntos, e aí a anulação ficaria sem segundo golpe pra oferecer, que é o caso que a regra
  existe pra evitar.
- **O Disable nomeia o golpe ANULADO, não a anulação**: *"Jynx teve o ataque Nevasca anulado por
  Venomoth"*. O que interessa é o que o pokémon PERDEU. Pra isso o motor grava o **tipo** anulado
  no diário (campo `a`) e o cliente vira em palavra pelo `nomeDoGolpe` — o mesmo caminho de todo o
  resto do log, e é o que evita mais uma tabela duplicada. O selo é o do golpe perdido, então o
  Nevasca sai no azul do Gelo e bate com o selo da linha onde a Jynx ataca com ele.
  Confronto gravado ANTES do campo existir cai na frase genérica ("seu melhor ataque"): log velho
  não pode sumir.
- **A ficha da Pokédex diz que especial a espécie tem** (`especiaisDaEspecie`), com o selo e a
  chance. É a única coisa que uma espécie faz em batalha que os seis números não contam — um
  Geodude e um Graveler de atributo parecido jogam diferente porque um deles explode, e sem isso o
  jogador só descobre perdendo. A chance vai junto porque é **por confronto**: só o nome deixaria
  ele achar que sai todo golpe. É lista porque dá pra ter dois (a Jigglypuff canta E anula).
  **E DESDE 11/09/2026 CADA LINHA SE TOCA e abre uma caixa explicando o que aquilo faz na partida**
  — ver a seção **A CAIXA QUE EXPLICA O ESPECIAL**, mais abaixo. É lá que mora a decisão de a
  explicação ser por EFEITO e não por nome.
  `tools/test-especiais.js` confere que todo golpe que o motor sabe gerar tem tipo declarado — sem
  isso o selo sairia num cinza genérico, e só no confronto que teve aquele golpe.
  (**O número "59 espécies das quatro listas" que estava aqui era de outra época** e envelheceu
  calado: são DOZE listas hoje, e **113 das 250** espécies têm pelo menos um especial — 9
  autodestruição, 43 sono, 17 anulação, 6 Metrônomo, 10 Recuperar, 2 Sino Curativo, 19 Fúria, 7
  Fúria do Dragão, 13 Dança da Chuva, 6 Remoinho, 4 Dança das Espadas, 3 Dança da Pluma e 1 Sketch,
  com sobreposição. O teste varre as listas em vez de contar, que é o que impede o próximo número de
  envelhecer do mesmo jeito.)
  **⚠️ ERAM 157 E ONZE LISTAS até 24/09/2026**, e as duas mudanças que derrubaram isso já estavam
  escritas aqui: a **drenagem** saiu da ficha em 15/09 (ela virou efeito de GOLPE) e a **confusão**
  em 24/09, pelo mesmo motivo — e ela levava **82 espécies** consigo, que é quase toda a queda.
- **A linha do log tem forma própria aqui.** A regra do log é "uma forma só" (ver a seção acima), e
  estes três são as **exceções**: não são dano, são o confronto inteiro decidido de uma vez, e o
  jogador precisa ler por quê. Um `−0` solto faria procurar bug onde é regra — o mesmo motivo do
  "mas não teve efeito" da imunidade. A explosão gera DUAS entradas no diário (`boom` + `boomself`,
  porque os dois caem) e o `passosHtml` desenha **uma linha só**: a segunda existe pro cálculo, não
  pra tela.
- **Custo medido na jornada: conclusão sobe de 58,3% pra 63,7%** (2.000 jornadas de cada lado).
  Sobe porque a autodestruição e o sono são atalhos que resolvem um confronto ruim — e o jogador
  encontra mais espécies dessas listas do que os líderes. Está dentro do que o jogo já tolera, mas
  é a maior variação de dificuldade desde o golpe moribundo. Se incomodar, o parâmetro a mexer é a
  chance da autodestruição (`CHANCE_AUTODESTRUICAO`), que é a que mais aparece.

## O RECUPERAR VIROU UM GOLPE DA TROCA (24/09/2026)

Pedido assim: *"a partir do momento que o pokemon que possui essa habilidade estiver com menos de
50% de hp, ele tem 10% de chance de trocar um golpe de ataque pelo recuperar e recupera todo o hp"*.

**⚠️ E A LEMBRANÇA DO PEDIDO ERRAVA EM DOIS PONTOS, o que muda o desenho:** ele não era *"menos de
30%"* — era **70%** (`CURA_MAXIMO_DO_HP`) —, então os 50% pedidos são **mais restritivos**, não
menos. E ele **já curava tudo**. As mudanças reais são três:

| | antes | agora |
|---|---|---|
| quando é sorteado | **ABERTURA**: uma vez por confronto | **a cada TROCA** |
| a guarda | abaixo de **70%** | abaixo de **50%** |
| o preço | **nenhum** — ele curava E atacava | ⚠️ **ele PERDE o ataque daquela troca** |

**⚠️ O TERCEIRO É O QUE EQUILIBRA O SEGUNDO, e é o que o Recover faz no jogo original: ele USA o
turno.** Medido antes de escrever uma linha: um confronto tem **1,96 troca de mediana** — então
perder o ataque é perder **metade** deles.

### O QUE FOI MEDIDO

| 1x1, as 10 espécies entrando machucadas, 3.000 confrontos de cada | antes | agora |
|---|---|---|
| confrontos em que ele cura | 7,6% | **10,7%** |
| ele vence | 47,4% | **48,6%** (+1,2) |

**NA JORNADA: +1,03 ponto, 1,9σ** — 54,88% → 55,91%, 8 blocos de 800 de cada lado (**6.400 de
cada**, o MESMO bot contra duas cópias congeladas, desvio tirado de ENTRE os blocos, **6 de 8
blocos** pro lado novo). No limite do ruído, e a direção faz sentido: a cura ficou 41% mais
frequente e cada uso passou a custar um golpe.

**A impressão MUDOU nos dois** (`e6cd16d15e0f/1e9b7214c627` para `ae3a573de09f/96b335858a1b`), que
é o que uma mudança de mecânica deve fazer.

### AS DECISÕES

- **⚠️ ELE ENTROU NA LISTA DAS CINCO COISAS QUE FAZEM ALGUÉM PERDER A TROCA** (sono, gelo,
  paralisia, confusão) — a mecânica já tinha o molde exato, e o `curaDaTroca` é a quinta condição
  do mesmo `if`. Não houve caminho novo a inventar.
- **⚠️ A CURA É APLICADA NA ENTRADA DA TROCA, e isso não é detalhe de ordem:** o `tetoNoAlvoCheio`
  olha o HP do ALVO, então curar pra 100% é o que ativa a trava de *"vida cheia não morre num
  golpe"*. Aplicada depois, ela não protegeria da troca em que acontece.
- **⚠️ O `rng()` SÓ É LIDO DE QUEM PODE CURAR.** Lido sempre, ele deslocaria a semente de TODA
  batalha sem ninguém que cure — a armadilha que o Remoinho, o gelo, a paralisia, a confusão e o
  TM43 já registram. As duas guardas (a espécie e o HP) vêm antes do dado.
- **⚠️ ELE E O SINO SAÍRAM DA FILA DE ABERTURA, e isso DEVOLVE CHANCE A QUEM VINHA DEPOIS:** o
  Kadabra e o Alakazam têm Disable + Recuperar, e o Recuperar saía em `0,9 x 10% = 9%` (medido,
  9,2%). Com ele fora, o Disable volta aos **10% cheios**.
- **A APRESENTAÇÃO VEIO DE GRAÇA:** a marca do diário é a mesma, o `passosDaAbertura` já tem
  `recover:1` (a pausa de 1,5s) e ele já lida com abertura fora do índice 0 — a lição que o sono
  custou em 10/09. **E log antigo continua legível.**

### ⚠️ E ELE CUSTOU UM DEFEITO MEU, QUE A TRAVA NOVA PEGOU

O `curaDe` (que grava no diário) roda **depois** de o dano da troca já ter sido aplicado — então o
campo `hp` gravava o **pós-golpe**. Medido: um Starmie de maxHp **340** curava pra 340 e o diário
gravava **263**. O campo é lido pela reconstrução e por toda conta que percorre o diário. Hoje ele
é capturado **dentro do `curaDaTroca`**, no instante da cura.

### ⚠️ E DUAS CONTAS DO TESTE ACUSAVAM O JOGO DE UM DEFEITO QUE ERA DELAS

A trava *"ninguém ataca depois de cair"* foi de **0 para 10 cadáveres em 4.000** — e o jogo estava
certo (medido: **zero** casos em que quem curou também atacou). Eram duas contas:

1. o acumulador do ganho de vida só conhecia o **dreno** — a **QUINTA** conta deste arquivo que
   copia a lista do `subiuAVida` à mão, a mesma lição que o `danoSemGolpe` já tinha custado;
2. **⚠️ e a pior:** um ajuste que punha o HP inicial no **pós-cura** — ele pressupunha que a cura
   era a PRIMEIRA coisa do confronto (ela era abertura). Com ela no meio, os golpes **anteriores**
   passavam a ser aplicados sobre o HP curado, o HP ficava negativo cedo e o scanner acusava de
   cadáver quem estava vivo. **A fúria continua nesse ajuste, porque ela É abertura.**

**E SEIS TRAVAS MEDIAM A REGRA ANTIGA** (*"com 69% ainda se cura"*, *"ela vem ANTES de qualquer
golpe"*, *"nunca os dois no mesmo confronto"*). Nenhuma foi afrouxada: elas viraram as da regra
nova, e entraram as que faltavam — **quem curou NÃO atacou naquela troca**, e o Recuperar **não
está mais** na fila de abertura.

- **Se um dia incomodar**, as réguas são o `CHANCE_RECUPERAR` (10% por troca) e o
  `CURA_MAXIMO_DO_HP` (50%) — e a segunda é a mais forte, porque ela decide **quantas trocas** são
  elegíveis (medido: 59,1% delas, com o pokémon entrando machucado).

## O SONO E A ANULAÇÃO VIRARAM GOLPES DA TROCA (25/09/2026)

Pedido assim: *"pegue todos pokemons que possui habilidade passiva de dormir e disable e ao invés de
ser somente no início da batalha, colocar uma chance a cada ataque para que ao invés de atacar, ele
possa colocar o adversario para dormir/desativar um ataque, tudo como ja funciona hoje, mas ao inves
de ser só no inicio da batalha, vai ser a qualquer ataque"*.

É o **mesmo molde do Recuperar**, feito no dia anterior — e é a terceira passiva a sair da fila de
abertura.

> **⚠️ UMA PARTE DISTO DUROU UM DIA: em 25/09/2026 o adormecido deixou de atacar na troca em que ele
> é dormido** — ver **QUEM DORME NÃO ATACA**, logo abaixo. Foi reportado com print (*"o dugtrio e o
> rhyhorn atacaram depois de dormir"*), e com ele saíram mais duas portas do mesmo defeito: um
> pokémon **dormindo** usando o Pó do Sono (854 em 16.023) e a ação de quem **caiu** na mesma troca
> (61 em 3.485). O que continua valendo desta seção inteira é o **preço do turno perdido**, que é o
> que equilibra as duas passarem a ser sorteadas a cada troca.

| | antes | agora |
|---|---|---|
| quando é sorteado | **ABERTURA**: uma vez por confronto | **a cada TROCA** |
| o preço | **nenhum** — ele dormia/anulava E atacava | ⚠️ **ele PERDE o ataque daquela troca** |
| quantas vezes por confronto | uma | **quantas o dado der** (o sono sai 2× em 1,4% deles) |

**⚠️ O SEGUNDO É O QUE EQUILIBRA O PRIMEIRO, e ele é o pedido ao pé da letra** (*"ao invés de
atacar"*). Sem ele o sono passaria de 16,5% pra 31,8% dos confrontos **sem custo nenhum** — e ele já
é a mecânica mais forte do jogo (+29 pontos de efeito isolado).

### O QUE FOI MEDIDO

| 1x1, 3.000 confrontos de cada lado | antes | agora |
|---|---|---|
| confrontos com sono | 16,5% | **31,8%** |
| trocas com o alvo dormindo | 5,7% | **15,8%** |
| **o sonífero vence** | 47,5% | **46,4%** |
| confrontos com anulação | 5,5% | **14,7%** |
| **o dono do Disable vence** | 52,3% | **52,0%** |

**⚠️ AS DUAS DOBRAM DE FREQUÊNCIA E NENHUMA DAS DUAS GANHA MAIS** — é exatamente o que o preço do
turno perdido compra.

**NA JORNADA: −0,42 ponto, 0,7σ** — 54,80% → 54,38%, 8 blocos de 800 de cada lado (**6.400 de
cada**, o MESMO bot contra duas cópias congeladas, desvio tirado de ENTRE os blocos, **5 de 8 blocos**
pro lado difícil). Ruído puro, e pela razão de sempre: **os líderes também têm Oddish, Paras, Venonat
e Slowbro**, então o corte cai dos dois lados.

**A impressão mudou nos dois** (`ae3a573de09f/96b335858a1b` → `64db1d5912f1/4a442b813ad9`), que é o
que uma mudança de mecânica deve fazer.

### AS DECISÕES

- **⚠️ AS DUAS GUARDAS NOVAS SÃO O QUE IMPEDE A MECÂNICA DE SE MORDER**, e sem elas ela vira trava:
  - **não dorme quem JÁ DORME.** ⚠️ E a pergunta não pode ser o `_dormindoPor`: o `acorda()` o
    decrementa na ENTRADA da troca, então na última troca de sono ele já está em 0 e o alvo parecia
    acordado — o dono o redormia **antes de ele acordar uma vez**. Quem responde é o `activeDorme`
    daquela troca;
  - **não anula quem JÁ ESTÁ ANULADO por ele.** Anular duas vezes não tem o que tirar.
  - ⚠️ **E A TERCEIRA NASCEU NO DIA SEGUINTE: quem está IMPEDIDO não age** (`podeAgirNaTroca`). As
    duas acima olham o ALVO; faltava olhar quem AGE — e sem ela um pokémon **dormindo** usava o Pó
    do Sono, medido em 854 trocas de 16.023. Ver **QUEM DORME NÃO ATACA**, logo abaixo.
- **⚠️ A GUARDA DO "SEGUNDO GOLPE" DO DISABLE VEM ANTES DO DADO.** Checada depois, o pokémon perderia
  o ataque **por nada** contra um Onix (que não tem o que perder). Na abertura isso não doía, porque
  lá ele atacava do mesmo jeito.
- **⚠️ O `rng()` SÓ É LIDO DE QUEM PODE AGIR** — a armadilha que o Remoinho, o gelo, a paralisia, a
  confusão, o TM43 e a cura já registram. As guardas (a espécie, o estado do alvo, o segundo golpe)
  vêm todas antes do dado.
- **⚠️ E OS DOIS CONTINUAM NA MESMA SEQUÊNCIA, com o sono primeiro:** a taxa composta de quem tem os
  dois (a Jigglypuff) continua sendo `(1 − 0,15) × 0,10 = 8,5%`. A regra não mudou, mudou o lugar.
- **O METRÔNOMO CONTINUA NA FILA DE ABERTURA** devolvendo `sono` e `anula`, então os dois ramos do
  `tentarGolpeEspecial` **não ficaram órfãos** — ele é *"qualquer poder existente no jogo"*, sorteado
  uma vez, e continua sendo abertura.
- **A APRESENTAÇÃO VEIO QUASE DE GRAÇA:** as marcas do diário são as MESMAS, o `passosDaAbertura` já
  tem `sono:1`, `semSono:1` e `disable:1`, e o `ehGolpeEspecial` já os conhecia. **E log antigo
  continua legível.**

### ⚠️ E ELE OBRIGOU A ANULAÇÃO A SAIR DO TOPO DO LOG

O CLAUDE.md registrava a razão de ela ficar fora da sequência: *"ele não tira HP e a luta continua
depois dele, então viraria um passo de dano 0"* **e** *"a anulação acontece na abertura, e a luta que
se lê embaixo já é a luta com o golpe anulado"*. **A segunda metade deixou de ser verdade.**

E não era só incoerência de leitura — eram **dois defeitos medidos**:

1. **tirar a linha do meio da sequência COLAVA os dois golpes em volta dela**: medido, a tela criava
   colagem que o diário não tinha em **7 casos de 40** (`p:100  e:disable  p:98` saía `p:100 p:98`),
   que é exatamente o que a trava da colagem existe pra impedir;
2. **na animação a anulação não tinha passo nenhum** — e o dono **PERDE o ataque** pra fazê-la, então
   o jogador via o pokémon parado sem nada explicando.

Hoje ela entra na sequência, no lugar dela. As três peças já estavam prontas (o `ehGolpeEspecial` já
a conhecia, o `passosDaAbertura` já tinha `disable:1`, o `linhaEspecial` já a desenhava), e o que
saiu foi a montagem no topo mais o `return ''` do `passosHtml`.
Medido depois: **colagem criada 7 → 0**, e a anulação aparece na sequência em **253 de 253**.

**⚠️ E A PAUSA DE ABERTURA FICOU SEM DONO NENHUM.** A anulação era a **última** que ainda a usava —
justamente porque ela era filtrada fora da sequência e o passo dela ERA o 0. Hoje o segundo de
leitura dela vem do passo, pela marca `leitura`, como o de todos os outros.

### ⚠️ E O DESPERTAR PASSOU A VALER O CONFRONTO INTEIRO

Pedido logo depois: *"O despertar vale pro confronto inteiro"*. **E ele nasceu de uma medição:** com
o sono sorteado a cada troca, o adversário rola o dado várias vezes — o item segurava o primeiro,
era gasto, e o próximo passava.

| Machop com Despertar × Jynx, 3.000 batalhas | segurou | **DORMIU** | linhas/batalha |
|---|---|---|---|
| o sono era ABERTURA | 14,6% | **0,0%** | 0,15 |
| o sono virou TROCA, o item se gastava | 25,3% | **1,9%** | 0,25 |
| **o item vale o CONFRONTO** | 25,6% | **0,0%** | 0,27 |

Ou seja: um item de **50 moedas** que existe pra que isso não aconteça deixava o dono dormir em 1,9%
das batalhas. Hoje ele volta a zero, e a linha extra no log custa **0,02 por batalha**.

- **⚠️ O ITEM CONTINUA SENDO GASTO UMA VEZ SÓ** — o que muda é que, depois de segurar o primeiro
  sono, ele segura os seguintes **até o fim daquele confronto**. Da segunda em diante quem segura é
  a marca.
- **⚠️ E A MARCA É CASADA COM O ADVERSÁRIO** (`_semSonoContra`), no molde do `_anulado` e do
  `_especialContra`: confronto novo, adversário novo, e ela não casa. Nos confrontos seguintes ele
  não tem mais item — a proteção vale só onde o item foi gasto, que é o que *"o confronto inteiro"*
  quer dizer.
- **⚠️ E A LINHA DO LOG SAI TODA VEZ, de propósito:** quem tentou dormir **PERDEU o ataque** daquela
  troca, e sem a linha o jogador vê o adversário parado sem explicação — o erro da especialidade de
  novo.

- **Se um dia incomodar**, as réguas são o `CHANCE_SONO` (15% por troca) e o `CHANCE_DISABLE` (10%) —
  e agora elas valem **por troca**, ou seja um confronto de 2 trocas dobra a chance efetiva de
  antes.

### ⚠️ E ELE DESENTERROU DOIS DEFEITOS DE CONTA NO TESTE, E ELES ERAM REAIS

Os dois estavam no arquivo há tempo e **passavam por acidente** — o sono virando golpe da troca
alongou os confrontos e os revelou:

1. **A CONTA DO CADÁVER INVERTIA O LADO DA QUEIMADURA.** O `q` do `queima`/`veneno`/`confuso` é de
   **QUEM PERDE** (não há causador na troca em que eles doem), e a conta tratava todos como "quem
   bate". Resultado: o dano da queimadura do ADVERSÁRIO era descontado do MEU pokémon, e um confronto
   longo o bastante chegava a zerar a barra na conta — *"atacando a zero"* num confronto em que o
   motor grava `p:−66{17}` com ele de pé.
   ⚠️ **E a conta IRMÃ (a da colagem, 950 linhas acima) JÁ TINHA a linha certa** — esta ficou pra
   trás. É a **SÉTIMA** vez que uma conta deste arquivo copia uma lista à mão, e o comentário do
   próprio `danoNoProprio` previa o sintoma com todas as letras.
   Medido: **0 em 8.327 confrontos antes, 3 em 8.450 depois**.
2. **A CONTA DA SOMA DE DANO NÃO SOMAVA O `dreno` NEM O DANO SEM GOLPE.** Ela só conhecia o
   DESEMPATE — e passava porque o Gastly daquele painel **não usava Comedor de Sonhos** enquanto o
   sono era abertura. Com o sono na troca ele passou a usar em **22 dos 40** confrontos, e a soma
   parou de fechar em 24 deles. É a **SEXTA** vez desta mesma lição (a quinta foi ontem, com a cura).

### ⚠️ E DEZOITO TRAVAS MEDIAM A FILA DE ABERTURA

Nenhuma foi afrouxada — elas passaram a ler o `doExchange`, e entraram as que faltavam (**quem dormiu
ou anulou NÃO atacou naquela troca**, a anulação **na** sequência, e a pausa vindo do passo dela). As
lições:

- **⚠️ O `seq.indexOf(objeto)` DEVOLVE −1:** a `sequenciaDoConfronto` **RECRIA** os objetos (a
  suavização reparte golpes, os tapas viram N passos). Com −1 a janela passava a ser o confronto
  INTEIRO, **sem nada acusar** — 6 de 40. Índice se acha pela **MARCA**.
- **⚠️ SEIS PAINÉIS ESTAVAM FORTES DEMAIS**, e os seis pelo mesmo motivo: com o dono perdendo o
  ataque na troca do sono, um adversário de nível alto o mata **ali mesmo**, antes de o sono render
  nada. O caso extremo: Butterfree Lv.45 × Snorlax Lv.**80** dava **243 confrontos com sono e ZERO
  linhas `dormindo`** — com a mecânica dando `{0:218, 1:58, 2:50}` num painel parelho. É a lição do
  *painel forte demais*, pela sexta vez neste arquivo.
- **⚠️ E A TRAVA DA BARRA DA CURA ACOMPANHAVA O HP ACUMULADO**, que a **suavização do log** altera de
  propósito (ela reparte golpes mantendo o total). Medido: ela acertava **94,7% antes desta leva e
  88,7% depois** — ou seja ela sempre foi um flake, e o comentário dela já registrava isso. Hoje ela
  lê o **PASSO** da cura e o `hp` que o motor gravou.
- **⚠️ E TRÊS INVARIANTES PASSARAM A SER POR PAR, não por confronto** (o Comedor de Sonhos, a linha
  *"continua a dormir"*, o despertar na tela): com o sono sorteado a cada troca, um confronto pode
  ter **vários** pares `sono → acordou`, e pode até abrir com um `acordou` de sono **herdado do
  confronto anterior** e receber um `sono` novo depois dele. Lendo o PRIMEIRO de cada um, a conta
  nunca fechava — 26 de 200 no despertar, 15 de 1078 no Comedor.
- **⚠️ E A TRAVA DO PEIXE DA PESCARIA TROCOU DE DONO:** o painel dela era o **Poliwag**, que está no
  `SONIFEROS` — ele passou a **dormir** o parceiro em vez de atacar, e a trava caiu pra 299 de 300
  com o código certo. Hoje o dono é o **Chinchou** (Faísca, não sonífero). É a mesma lição dos donos
  do multi-tapa: **cada golpe precisa de um dono que só tenha ELE**.
- **⚠️ E O PAINEL DA TRAVA DOS SELOS DA PESCARIA ERA SORTEADO, e ele estava a 3 eventos de falhar**:
  com o time Lv.55-70 o peixe morre em 1,93 troca e quase nunca ataca — medido, **8 confrontos com
  status em 2.500**, e a trava pede 5 (ou seja ~10% de falha por rodada). O sono comendo as poucas
  trocas do peixe (49 → 67) a empurrou pra **zero estável**. Hoje ele é dirigido.

**⚠️ E O FLAKE DO `Charmeleon × Mankey` CONTINUA** (1 rodada em ~4), agora **sem** a causa da
queimadura: medido, a taxa é **indistinguível entre os dois builds** (0 em 700 voltas de cada, no
painel da trava do selo). Ele é o mesmo que este arquivo nomeia desde 17/09.

## ⚠️ QUEM DORME NÃO ATACA: AS AÇÕES PASSARAM A RODAR NA ORDEM (25/09/2026)

Reportado com print, no dia seguinte ao sono virar golpe da troca: *"o dugtrio e o rhyhorn atacaram
depois de dormir, isso deveria ser impossivel"*. **E o print tinha DOIS casos, não um** — o mesmo
sintoma com causas diferentes, e é essa separação que organiza tudo aqui:

| no print | velocidade | o que aconteceu |
|---|---|---|
| **Rhyhorn 40** × Jumpluff 128 | o Jumpluff é **muito mais rápido** | ele dormiu primeiro e o Rhyhorn **ainda atacou**. ⚠️ Medido: **425 de 425** |
| **Dugtrio 162** × Jumpluff 128 | o **Dugtrio** é mais rápido | ele atacou **antes** do sono — o golpe é **legítimo** —, mas o log mostrava a linha do sono **na frente** |

### ⚠️ A CAUSA É UMA SÓ: AS AÇÕES RODAVAM PELOS DOIS LADOS ANTES DE A ORDEM EXISTIR

O `acaoDaTroca` era chamado pro `active` e pro `enemy` de uma vez, e o `activeFirst` — quem bate
primeiro — era decidido **trinta linhas depois**. Sem a ordem, não há como saber se o alvo já estava
dormindo quando chegou a vez dele.

Hoje a ordem é decidida **antes**, as ações rodam **nela**, e **quem é dormido antes da vez dele não
age nem ataca** — que é o que acontece no jogo original.

- **⚠️ A PERGUNTA É PELO `x:'sono'`, e não pelo `_dormindoPor`:** o `semSono` (o Despertar segurou) e
  o `disable` **não tiram o turno** do alvo — ele apanha e revida normalmente.
- **⚠️ E A VELOCIDADE PASSOU A SER LIDA ANTES DOS GOLPES**, o que é consequência disto e é **mais
  fiel** (no original a ordem do turno é decidida no começo dele): a paralisia aplicada **na própria
  troca** deixou de contar pra ordem dela. **Medido: a ordem inverteria em 1,12% das trocas**, e o
  `rng()` do desempate só é lido nos **1,08%** em que há empate.
- **A LINHA DA AÇÃO DO SECOND DESCEU** pra junto do `travadoDe(second)` e do `dormeDe(second)` — a
  ação **é a vez dele**, e a vez dele é depois do golpe de quem é mais rápido. É a metade do Dugtrio,
  e as duas linhas vizinhas já estavam ali desde 16/09 pela mesma razão.

**MEDIDO DEPOIS**, nos mesmos pares do print: o alvo mais lento atacando **425 de 425 → 0 de 563**, e
o golpe do alvo mais rápido vindo antes da linha do sono **0 de 993 → 789 de 789**.

### ⚠️ E O MESMO DEFEITO TINHA MAIS DUAS PORTAS — as duas achadas medindo, não por relato

#### 1) UM POKÉMON DORMINDO USAVA O PÓ DO SONO

As cinco guardas de *"perdeu a vez"* (`activeDorme || activeCongelado || activeTravado ||
activeConfuso || activeCura`) barravam **o GOLPE e não a AÇÃO**. **Medido no par Butterfree ×
Venomoth** (os dois soníferos): **854 trocas em 16.023 — 5,3%** com alguém dormindo agindo.

Hoje quem responde é o **`podeAgirNaTroca`**, e ele lê **a mesma lista** que barra o golpe: quem não
joga, não age. Depois: **0 em 10.302**.

- **⚠️ A TRAVA DISSO LÊ O CÓDIGO, nos dois motores**, e cobra que a guarda liste **as cinco**: sem
  isso a próxima condição que nascer entra no golpe, fica de fora da ação, e **só o painel que a
  produzisse acusaria**.
- **⚠️ E O NOME É `podeAgirNaTroca`, e não `podeAgir`:** o cliente já tem **dois** `podeAgir` locais
  (o do Resgate e o da Queimada). Eles não se sombreiam — os três são `const` dentro de funções
  próprias —, mas três funções com o mesmo nome é ruim de procurar, e este projeto já pagou uma
  colisão de verdade assim.

#### 2) ⚠️ QUEM CAIU NO GOLPE DO FIRST AINDA AGIA — e esta foi criada pela correção de cima

O `acaoDaTroca` **decidia e aplicava** na mesma linha, antes dos golpes. Então o `second` podia dormir
o adversário e **cair no golpe do first na mesma troca**. Isso é **anterior** — o que mudou é que, com
a linha dele no lugar certo, o log passou a mostrar **"X caiu / X fez Y dormir"**. ⚠️ **Deixá-la seria
uma regressão minha.**

**Medido: 61 de 3.485 ações (1,75%)** eram de quem já tinha caído.

O conserto é **separar decidir de aplicar**: o `acaoDaTroca` devolve o efeito num `aplica()`, o
`first` aplica na hora, e **o do `second` só vale depois do `segundoCaiu`**. Depois: **0 de 3.203**.

- **⚠️ E O PADRÃO JÁ ESTAVA NO ARQUIVO: os SEIS `tentar*` usam `(segundoCaiu || !primeiroAtacou) ?
  null`** — quem cai não sofre status. A ação só não estava nessa regra.
- **⚠️ E O DIÁRIO PASSOU A LER POR `first`/`second`**, não por `active`/`enemy`: o `activeAcao`/
  `enemyAcao` guardam a **decisão**, e a do second pode ter sido **descartada**.

### O QUE ISSO CUSTOU

**A impressão do motor MUDA nos dois** (`07728f31cb93/370db4d361fd` → `128473196c86/86697ceb8e91`),
que é o que uma mudança de mecânica deve fazer.

**NA JORNADA: −0,53 ponto, 0,6σ** — 54,09% → 53,56%, 8 blocos de 800 de cada lado (**6.400 de cada**,
o MESMO bot contra duas cópias congeladas, desvio tirado de ENTRE os blocos, **3 de 8 blocos** pro
lado do conserto). Ruído puro, e pela razão de sempre: **os líderes também têm Oddish, Paras, Venonat
e Jumpluff**, então o corte cai dos dois lados.

### ⚠️ E UMA TRAVA DE ONTEM PASSOU NA REGRA NOVA POR ACASO

A do `'os golpes livres sao do dono'` era **`doAdormecido <= 1`** — ela **TOLERAVA** o golpe do
adormecido em vez de exigir zero, então ela ficou verde com o conserto inteiro aplicado. É a **sexta**
vez que essa trava muda, e a quinta versão **durou um dia**.

Hoje ela é **`=== 0`**, e o invariante vale nos dois casos — quando o adormecido é o mais rápido, o
golpe dele sai **antes** da linha do sono, ou seja fora da janela.

**⚠️ E O PAINEL DELA (Paras 35 × Onix 89) SÓ EXERCITA O ALVO MAIS RÁPIDO** — o caso do Rhyhorn, que é
o defeito de mecânica, **nunca aconteceria nele**. Os dois casos ganharam painel **dirigido pela
velocidade**: Jumpluff 137 × Snorlax 41 (o dono mais rápido) e Vileplume 65 × Jolteon 161 (o alvo
mais rápido). Sem isso a trava passaria medindo o conjunto vazio.

**Conferido que os 6 defeitos religados acusam** (8 a 13 falhas cada).

## ⚠️ O NOME DO SHINY NÃO BRILHA — a estrela é a marca, e isso já foi testado (25/09/2026)

**O shiny é marcado por uma ESTRELA ao lado do nome** (`selo('shiny')`, em **35 pontos** do
arquivo), e é assim desde sempre. Em 24/09/2026 isso virou o **nome brilhando** a pedido
(*"consegue ao invés de exibir uma estrela, deixar o nome dele mais brilhante?"*), e em **25/09 foi
desfeito**, também a pedido: *"não tá legal não, volte como era antes com a estrela mesmo e esqueça
isso de deixar o nome brilhando"*.

**⚠️ ESTA SEÇÃO EXISTE PRA A IDEIA NÃO VOLTAR POR ESQUECIMENTO.** Ela foi tentada em **três voltas**
— halo âmbar, halo amarelo, miolo dourado com traço —, e cada uma foi recusada na tela. Os números
abaixo são o que se aprendeu, e eles valem pra **qualquer** texto brilhante que alguém proponha.

### ⚠️ POR QUE O HALO NUNCA RESOLVE: o `text-shadow` fica ATRÁS do glifo

Por mais forte que o brilho seja, **o miolo da letra continua sendo a `color`** — e no log o nome
já sai em **azul** (eu) ou **vermelho** (o adversário), que no fundo **creme** das caixas é escuro.
Foi exatamente esse o terceiro relato: *"tá muito preto dentro"*.

### ⚠️ E O MIOLO DOURADO NÃO LÊ NO CLARO — a tabela que fecha a questão

| miolo | creme (a caixa) | escuro (fora) | a cena (verde) |
|---|---|---|---|
| `#e8a600` | **2,05** | 7,26 | **1,05** |
| `#ffd84d` | **1,44** | 10,37 | **1,50** |
| `#ffe066` | **1,26** | 11,83 | 1,72 |

**Todos reprovam no AA (4,5) nos dois fundos CLAROS**, e não há tom dourado que passe ali e ainda
brilhe no escuro. A saída era um **traço escuro** com `paint-order:stroke fill` (no creme quem
desenha a letra é o traço, 13,67:1; no escuro é o miolo, 10,37:1) — funcionava, e mesmo assim foi
recusada. **A estrela resolve o mesmo problema sem nada disso.**

### ⚠️ A MÉTRICA DO MARCA-TEXTO, que vale pra qualquer halo

A primeira versão foi recusada com *"tá parecendo que o texto tá com um marca texto"*. O número que
define isso é a **tinta colada** — a soma dos alphas das camadas de `text-shadow` com blur ≤ 5px:

| | tinta colada | na tela |
|---|---|---|
| a de 24/09 (âmbar) | 0,95 | halo, mas alaranjado |
| **a recusada** | **2,00** | **bloco amarelo** |
| a última (miolo dourado) | 0,55 | halo, sem preencher o vão |

**Acima de ~1,0 o vão entre as letras preenche**, e é aí que vira marca-texto.

### ⚠️ E A LIÇÃO DE FERRAMENTA: desfazer isso custou um defeito que a sintaxe não pega

A reversão trocou `${nomeBrilhante(A,B)}` por `${A}${B ? ' ' + selo('shiny') : ''}` em 32 pontos —
e a primeira versão **não consumia o `}` que fechava a interpolação original**. Sobrava um `}` em
**toda linha**, e ele é **TEXTO dentro do template literal**: o `node --check` passa, a bateria
passa, e a chave aparece na tela depois de cada nome.

**Quem pegou foi a conferência BYTE A BYTE contra o arquivo de antes do brilho** (`bf40164^`), que
é a prova que vale numa reversão: **32 das 33 linhas com a estrela hoje são idênticas** (a menos de
espaço e aspas) a uma linha de lá. A única sem par é o card do parceiro da Pescaria, que **nasceu
depois** — não há forma de antes pra ele.

⚠️ **E `git revert` não servia:** os dois commits do brilho (`bf40164` e `84f3919`) o misturam com
mecânica de batalha (o Recuperar virando golpe da troca, e o *"quem dorme não ataca"*), que fica.

### O QUE FICOU NO CÓDIGO

- **A estrela está em 35 linhas**, o mesmo número de antes do brilho. Duas delas são **decorativas**
  (o prêmio das Ilhas e o *"Os cinco caíram!"* — **não há pokémon shiny ali**, a estrela é ícone).
- **No `fighterHtml` ela NÃO vai dentro do nome**: ela é um **selo grande** na fileira de selos do
  painel do lutador, ao lado do terreno (🔺) e da medalha (🎖️), nos **dois ramos** (a cena nova e o
  caminho antigo). Pôr dentro do nome seria errado — o `.battle-mon-name` é `overflow:hidden` com
  ellipsis, e a estrela seria a primeira coisa cortada.
- **No `status-row` ela vem DEPOIS do nível**, colada no 🔺 — é o único ponto fora do padrão, e a
  reversão mecânica quase o alinhou com os outros 31 por engano.
- **As travas não foram apagadas, foram VIRADAS**: as quatro que cobravam o brilho hoje cobram a
  estrela, sempre em **par** (a estrela aparece **E** o brilho não), mais uma varredura que proíbe
  `nome-shiny`/`nomeBrilhante` no arquivo inteiro. **Conferido: os 5 defeitos religados acusam.**

**NO MOTOR, NADA:** `MOTOR 128473196c86 / DIARIO 86697ceb8e91`, idêntico — o shiny é apresentação
inteira.

## A FRASE DO SONO NOMEIA O GOLPE, COM SELO (25/09/2026)

Pedida assim: *"quando um pokemon fazer o outro dormir, durante a batalha exibir na mensagem qual a
habilidade que fez dormir, por exemplo: 'Venosaur fez muk dormir com PO DO SONO (colocar o selo do
ataque)'"*.

**⚠️ O LOG JÁ DIZIA ISSO DESDE SEMPRE — o que não dizia era o AVISO DO MEIO DA BATALHA**, e a razão
estava escrita ali: *"o nome do golpe de sono entra só no log; o aviso se lê em um segundo e ali a
frase curta é a que chega"*. Ela vinha de uma regra geral boa — no aviso o texto é **puro**, porque
um selo colorido no meio é mais uma coisa pra o olho parar.

**⚠️ E ELA ERA A ERRADA AQUI, por um motivo que vale pro próximo caso:** nos outros ramos o golpe
justifica um **NÚMERO que já está na tela** (a queimadura, o veneno, a confusão), então a frase curta
basta. **No sono não há número nenhum** — a barra do adormecido fica **PARADA** —, e o golpe é por
ESPÉCIE (o Paras dorme com Esporo, a Jigglypuff com Canto, o Butterfree com Pó do Sono). Ele é a
única coisa que a frase tem a dizer além de QUEM dormiu.

- **⚠️ O RAMO DO SONO DEIXOU DE LER O `op`**, e é isso que faz o selo chegar: o `comGolpe` e o `selo`
  valem pra frase inteira, e respeitá-los ali deixaria o aviso sem selo justamente onde ele foi
  pedido. **Os outros ramos continuam lendo o `op`** — a regra geral não mudou, o sono é a exceção.
- **E COM ISSO AS DUAS FRASES FICARAM IGUAIS**: o log e o aviso saem do mesmo `fraseDoEspecial` e
  agora dizem a mesma coisa. Era justamente aqui que eles divergiam.
- **Confronto gravado antes do campo `g` existir cai na frase curta** — log velho não some nem sai
  com um selo vazio. Há trava.
- **Medido a 320px:** `Venusaur fez Muk dormir com [PÓ DO SONO]`, com o selo no verde de Planta, nos
  três fundos.

**NO MOTOR, NADA** (a frase é montada na tela; o diário já gravava o `g`), e **os 3 defeitos
religados acusam**.

## Golpes por nível (data/golpes.json) — a base da GEN 3 / FireRed

Base criada em 09/09/2026 e **trocada de geração no mesmo dia**: nasceu na Gen 2 e passou pra
**Gen 3 (FireRed/LeafGreen)** a pedido. Ela alimenta os dois golpes que o jogador escolhe.

- **250 espécies, 2.390 entradas (espécie × nível), 301 golpes distintos** (era 2.052 e 228 na
  Gen 2). Cada golpe traz nome, tipo, poder, PP e precisão **como eram na Gen 3**.
- **A FONTE DO APRENDIZADO MUDOU DE ARQUIVO, e isso é uma armadilha:** NÃO existe
  `data/mods/gen3/learnsets.ts` no Showdown — o mod da Gen 3 só traz moves/abilities/items. O
  aprendizado da Gen 3 vive no arquivo **principal** (`data/learnsets.ts`), na tag `3L<n>`. É
  exatamente o arquivo que a versão Gen 2 desta seção dizia "não servir sozinho, foi podado e só
  tem da Gen 3 pra frente" — agora é a faixa que interessa.
  O `3L` é a **geração 3 inteira**: o Showdown não separa FRLG de RSE. Pras 250 daqui os dois
  batem em quase tudo, mas onde divergirem o que está aqui é a união da geração.
- **A CADEIA DE MODS PARA NA GEN 3** (8→3, não 8→2). Sem ela o Tackle sairia 40/100 em vez de
  35/95 e o Crabhammer 100 em vez de 90. `tools/test-golpes.js` tranca esses dois.
- **O QUE A GEN 3 TROUXE:** 71 golpes novos (Garra de Metal, Ás Aéreo, Vento Prateado, Pulso de
  Água, Quebra-Telha, Rajada de Rochas, Cauda de Ferro, Onda de Calor...), 101 espécies ganharam
  golpe de dano e 18 perderam. **Um golpe só mudou de ficha: o Low Kick**, que na Gen 3 passou a
  ter poder por PESO — o Showdown grava isso como `basePower: 0`, que neste esquema significa
  "status". Ele saiu da lista de dano junto com outros **21 golpes de poder variável** (Flail,
  Guilhotina, Terremoto de Magnitude, Contra-Ataque, Bico Perfurante, Nível-dano como Investida
  Sísmica e Sombra Noturna): nenhum deles cabe num motor de poder fixo, e deixá-los entrar com um
  número inventado seria pior que deixá-los fora.
- **TODO POKÉMON BATE COM O PRÓPRIO TIPO** (pedido em 09/09/2026: *"o Bulbasaur é Grama e Veneno,
  porém no moveset dele não tem nenhum ataque que causa dano de veneno"* — e era verdade).
  Medido na base da Gen 3 crua: **51 espécies e 58 lacunas** (Veneno 12, Inseto 11, Voador 9,
  Terra 7, Água 6, Psíquico 5). A causa é que o jogo original resolve isso por TM — a Bomba de
  Lodo do Bulbasaur é a TM36 do FireRed —, e esta base só cadastra aprendizado por NÍVEL.
  **A regra é uma só, e nada foi escolhido à mão** (ver o passo 3 do `tools/gerar-golpes.js`):
  1. o candidato sai do que a espécie REALMENTE aprende na Gen 3 por qualquer via (nível, TM,
     tutor, reprodução) — isso cobre **44 das 58** lacunas com dado de verdade;
  2. entre os candidatos ganha o de poder mais **próximo da mediana da própria espécie**, não o
     mais forte: sem isso o Nidoking ganharia Terremoto (100) em vez de Tapa de Lama (20);
  3. o **nível** é o do golpe de poder mais parecido que ela já tem, com **piso de poder/2** (teto
     50). O piso existe por um caso concreto: o Abra não aprende UM golpe de dano por nível, então
     "o nível mais alto dele" é 1 — e a regra entregava um Psíquico de 90 a um Abra nível 1;
  4. onde a Gen 3 não oferece nada daquele tipo (**13 casos**), aí sim é invenção, e o candidato
     passa a ser tudo que existe na Gen 3 — nunca a tabela moderna. A primeira versão errou aqui e
     deu Ferrão Mortal (Gen 6), Marretada Colossal (Gen 8) e Feixe Duplo (Gen 9) ao FireRed,
     porque os mods **sobrescrevem valores e não apagam golpes que ainda não existiam**.
  **O DITTO É A ÚNICA EXCEÇÃO, e ela não é gosto:** ele ataca com o tipo de quem copiou, e essa
  mecânica vive no `bestAttackType`, que só roda quando o `melhorAtaque` devolve null — ou seja,
  quando ele NÃO tem golpe escolhido. Dar um golpe Normal ao Ditto desligaria a transformação em
  silêncio, e ela está medida (16,8% → 22,1% de vitória, 15 confrontos impossíveis a menos).
  Resultado: **57 golpes acrescentados em 50 espécies**, e a lacuna de tipo vai de 51 espécies
  para **uma** (o Ditto).
- **AS OITO QUE NÃO ATACAVAM VIRARAM UMA.** Kakuna, Metapod, Abra, Unown, Wobbuffet, Delibird e
  Smeargle ganharam golpe pela regra acima; sobra o Ditto. Quem conta "espécies sem golpe" em
  qualquer lugar do projeto precisa saber disso.
- **O PREÇO MEDIDO: a jornada concluída sobe de 66,23% pra 68,13%** (6.000 jornadas de cada lado,
  o MESMO bot contra as duas versões pelo `--html`) — **+1,90 ponto, 2,2σ**, ou seja fora do
  ruído, para o lado fácil. E ela afrouxa no **FIM**, não no começo: o Brock não se move (1.292
  contra 1.292 game overs), o Giovanni cai de **373 pra 311**, o 6º de 248 pra 221 e o 5º de 83
  pra 62. Faz sentido — cobertura de tipo e movesets melhores rendem mais quanto mais o time
  amadurece, o mesmo formato que a 4ª carta do encontro selvagem já tinha.
- **A COBERTURA, medida no motor** (o par automático, 250 espécies nível 50):

  | | Gen 2 | Gen 3 + cobertura |
  |---|---|---|
  | espécies com golpe escolhível | 238 | **245** |
  | tipos de ataque por espécie | 1,56 | **1,62** |
  | o par cobre pelo menos um tipo próprio | 80,7% | **88,2%** |
  | o par cobre TODOS os tipos próprios | 55,9% | **69,0%** |
  | confrontos sem golpe útil (o teimoso) | 0,9% | **0,7%** |
  | confrontos só com golpe resistido | 13,7% | **12,5%** |

  **Atenção ao que a regra promete e ao que ela não promete:** ela garante que o golpe do próprio
  tipo EXISTE na lista da espécie, não que o pokémon vai levá-lo — são dois slots, e quem escolhe
  é o jogador. Por isso "cobre todos os tipos próprios" é 69% e não 100%.
- **A STARMIE DO RELATO DE 09/09 SE RESOLVEU POR OUTRO CAMINHO.** A resposta registrada era "o
  Psychic que você espera dela é TM, e a base só tem nível" — continua verdade pelo nível, mas ela
  é Água/Psíquico e não batia com o próprio tipo, então a regra de cobertura lhe deu **Psíquico**.
- **AS NOVE DIVERGÊNCIAS VIRARAM SETE**, por dois motivos diferentes: `sono:yanma` caiu pela
  FONTE (o Yanma aprende Hipnose no 23 na Gen 3 — a lista à mão estava certa, o dado é que estava
  atrás), e `drenagem:exeggutor` caiu por ACRÉSCIMO NOSSO (o Giga Dreno que a cobertura de tipo
  lhe deu por acaso é um golpe de drenagem). `tools/test-golpes.js` fixa as sete.
- **A CATEGORIA físico/especial NÃO está no arquivo, e é de propósito.** Neste motor quem decide
  isso é o TIPO do golpe (`isSpecialType`, regra da Gen 1), não o golpe. Gravar a categoria moderna
  do Showdown (que é por golpe, da Gen 4 em diante) criaria uma segunda fonte de verdade
  discordando do motor. Golpe de status se identifica por `poder: 0`.
- **O CURSE FICA FORA DO TYPE_CHART, e está certo:** na Gen 3 ele ainda era literalmente SEM TIPO
  (`???`) — só virou Fantasma na Gen 5. Seis espécies o aprendem (Slowpoke, Slowbro, Slowking e a
  linha do Gastly). Ele é golpe de status aqui (poder 0), então não entra na escolha.
- **O `ratata` é o único id que não bate com o da fonte** (o jogo escreve com um T só desde
  sempre). O teste confere que ele veio: se o mapa do gerador se perder, é o primeiro a sair vazio.
- **A BASE AUDITOU AS LISTAS FEITAS À MÃO, e sobraram SETE divergências** (eram nove na Gen 2 —
  ver a nota da troca de geração, acima). As seis listas de golpe especial foram conferidas move a
  move no Bulbapedia em 04/09/2026. **Autodestruição (9/9) e Recuperar (10/10) batem 100%.**
  O resto:

  | divergência | o que a Gen 3 diz | veredito |
  |---|---|---|
  | Disable: **Igglybuff** | o bebê não aprende anulação; quem aprende é a Jigglypuff, no nível 14 | provável erro da lista |
  | Drenagem: **Exeggcute** | o que ele tem é Leech Seed | provável erro — foi a MESMA razão que já tirou o Bulbasaur |
  | Metrônomo: **Cleffa, Snubbull** | nenhum aprende por nível (a Clefairy aprende no 34) | **de propósito**: os 4 do metrônomo foram PEDIDOS, não tirados do aprendizado |
  | Sono: **Misdreavus** | não aprende Hipnose por nível | provável erro da lista |
  | Sono: **Vileplume, Bellossom** | como Vileplume/Bellossom só têm quatro golpes, todos no nível 1 | **discutível**: eles HERDAM o Pó do Sono do Gloom, que aprende no 18 |

  As sete ficam FIXADAS no teste: mudar qualquer um dos dois lados é barulhento, pra ninguém
  consertar a lista e esquecer a base (ou o contrário). **Nada foi corrigido no jogo** — o pedido
  era cadastrar, não mexer.
- **O arquivo fica em `data/`, e a raiz do repo é publicada** — quando um deploy subir, ele fica em
  `jornadakanto.com/data/golpes.json`. Isso é conveniente de propósito: são 149 KB, e o
  `index.html` já tem 1,17 MB. Quando a feature existir, o caminho barato é o cliente BUSCAR o
  arquivo em vez de inchar o HTML — e aí a base não precisa virar a sexta tabela duplicada.
- **O nome em PORTUGUÊS vive em `tools/golpes-pt.json`, e são 162** (159 da base mais os TRÊS de HM: o `cut`, o `surf` e o `fly`). O arquivo da base traz só o
  nome canônico em inglês — os nomes PT que o jogo já usava (`MOVE_BY_TYPE`, `MOVE_OVERRIDES`)
  são por TIPO e não por golpe, então a passada foi à mão, uma vez. A Gen 3 acrescentou **37**
  (Ás Aéreo, Vento Prateado, Pulso de Água, Quebra-Telha, Cauda de Ferro...). Golpe de dano sem
  nome ali sai no log e nas telas com o **id em inglês**, então o gerador de tabelas é quem tem
  que gritar se faltar.
- **⚠️ OS GOLPES DE HM SÃO ESCRITOS À MÃO NO GERADOR DE TABELAS** (`A_MAO`, em
  `tools/gerar-tabelas-golpes.js`) — são **TRÊS desde 16/09/2026**: o `cut` (HM01), o `surf` (HM03)
  e o `fly` (HM02).
  Eles são os ÚNICOS golpes da tabela `GOLPES` que não saem da base, e o motivo é um só: **HM ninguém
  aprende por NÍVEL**, e a base só cadastra aprendizado por nível — o gerador nunca os viu.
  **Sem essas linhas, regenerar as tabelas APAGA os dois em silêncio** e os HMs ficam sem nada pra
  ensinar. Eles saem fora do `GOLPES_IDS`, que é indexado pelo `APRENDIZADO`.
  `tools/test-inventario.js` **varre o `HMS`** em vez de nomear os dois: o próximo HM que nascer sem
  linha no `A_MAO` passa a ser barulhento sozinho.
- `node tools/gerar-golpes.js` regenera o arquivo (o cabeçalho dele traz os `curl` das fontes).

## ⚠️ O MOTOR DE BATALHA MORA EM `docs/motor-de-batalha.md`

**LEIA ESSE ARQUIVO ANTES DE MEXER EM DANO, GOLPE, STATUS, PASSIVA OU NO LOG DE BATALHA.** Ele é o
registro de 39 mecânicas medidas — e cada uma delas custou uma medição, um relato ou os dois.

O que está lá: os **golpes escolhidos** pelo jogador (o par vale **79 pontos** de taxa de vitória),
os **cinco status por ataque** (congelamento, queimadura, veneno, paralisia, confusão), os
**estágios de atributo**, o **Metrônomo**, a **Fúria** e a **Fúria do Dragão**, o **Remoinho**, as
duas **danças**, a **Dança da Chuva**, o **Sketch**, a **herança de aprendizado da linha**, a
**suavização do log**, o **moveset dos NPCs** e o fim do **golpe moribundo**.

⚠️ **ELE SAIU DAQUI EM 24/09/2026 por medição, não por gosto:** ele tinha **249 KB — 16%** de um
arquivo que é lido inteiro em toda sessão, e sozinho ele gastava ~65 mil tokens antes de qualquer
trabalho começar. O que ficou aqui são as **duas subseções que nunca foram de motor** (elas caíram
ali por sequência de dia): a rolagem de lista e as missões dos ninhos, logo abaixo.

## A LISTA FICA ONDE ESTAVA (18/09/2026)

Reportado assim: *"quando eu clico em um TM na lista de TMs na loja, se eu clicar no último da
lista, a lista volta para o topo automaticamente ... e veja se tem outros pontos que usam a lista
parecida que está assim também e arrume em todos"*.

**O `render` já preservava a rolagem da PÁGINA** -- o que faltava era a de **DENTRO**. Medido no
navegador, a 320px, com o último TM da lista: **906 → 0**. Hoje: **906 → 906**.

- **⚠️ NÃO EXISTE LISTA DE CLASSES NO MECANISMO, e é de propósito.** São **dez** contêineres que
  rolam por dentro hoje (a lista da loja e a da mochila, o miolo da loja, o ranking da Torre, as
  notificações e o corpo delas, os golpes da ficha, "Pokémons desta rota", as Variações do Unown,
  "Quem pode aprender") -- e uma lista à mão envelheceria na **próxima** que nascesse rolável.
  É a mesma armadilha da lista à mão do `passosHtml` (que deixou as três linhas do congelamento
  caírem no ramo do golpe comum) e do texto fixo do `obsDoGolpe`.
  **Quem rolou tem `scrollTop > 0`, e é só isso que se pergunta.**
- **A CHAVE é a classe MAIS a posição entre os irmãos de mesma classe** (`loja-lista#2`). Só a
  classe faria duas listas iguais na mesma tela trocarem de rolagem entre si; ela sobrevive ao
  redesenho porque o HTML é o mesmo.
- **SÓ QUEM ROLOU É GUARDADO.** Guardar tudo faria o repor escrever `scrollTop` em ~185 elementos
  a cada toque, e escrever `scrollTop` é mais caro que lê-lo.
- **⚠️ E SÓ NA MESMA TELA** -- quem responde é o `mesmaTela`, que já guardava a rolagem da página:
  os dois passaram a andar juntos. Trocar de tela tem que começar do topo.
- **⚠️ TROCAR DE PRATELEIRA VOLTA AO TOPO**, e é o contrário: ali a lista é **OUTRA**, e manter a
  rolagem largaria o jogador no meio de uma que ele nunca rolou. Quem escolhe um ITEM fica onde
  estava; quem troca de PRATELEIRA volta. Medido: **906 → 0**, e é o certo.

**CUSTO MEDIDO a 320px, na loja:** guardar **0,098ms** + repor **0,082ms** contra **4,44ms** do
`render` inteiro -- **4%**. E ele é proporcional ao número de elementos com classe (185 naquela
tela), não ao número de listas.

**CONFERIDO QUE NÃO É MOTOR, por DUAS impressões:** a do MOTOR e a do DIÁRIO são **idênticas** em
900 batalhas semeadas. É apresentação inteira.

`tools/test-inventario.js` tranca 13 pontas, e **a que importa é a da classe NOVA**: um contêiner
de uma classe que nunca foi cadastrada em lugar nenhum é preservado -- é ela que prova a cobertura
das dez de uma vez, e é a **única** que cai se alguém trocar o mecanismo por uma lista à mão
(conferido: 3 falhas). Mais as duas listas de mesma classe não trocando de rolagem, o `mesmaTela`,
o repor vindo depois do `innerHTML`, e as duas prateleiras zerando.

## AS MISSÕES DOS NINHOS SÓ COMEÇAM DEPOIS DA PRIMEIRA VISITA (18/09/2026)

Pedido assim: *"coloque que as missões dos ninhos, só irão começar a acontecer depois que o
treinador visita o ninho pela primeira vez"*.

**⚠️ ANTES ELAS CONTAVAM DESDE O PRIMEIRO GINÁSIO DA JORNADA**, e o número diz o tamanho disso:
medido em 2.000 jornadas com o bot, **19 terminavam com o Zapdos aceso e a Montanha tinha sido
visitada 5 vezes**. Ou seja, quase todas cumpriam a missão **sem nunca ter visto um ninho** -- e as
três são o oposto disso: a do Moltres pede um time montado de propósito, a do Zapdos uma sequência,
a do Articuno um pokémon guardado pra três confrontos. Elas só valem como desafio pra quem sabe que
existem.

- **A GUARDA MORA DENTRO DO `conferirNinhos`**, que é a porta única por onde um ninho acende --
  fechá-la por dentro é o que impede um chamador futuro de reabri-la sem ninguém ver. É a mesma
  decisão do `registrarSketch`, que aprendeu isso do jeito caro.
- **⚠️ E ELA SAI ANTES DO `passoDoZapdos`, que é o único dos três que ESCREVE.** Saindo depois, a
  sequência **acumularia no escuro** e o ninho acenderia na primeira batalha DEPOIS da visita -- ou
  seja, a missão teria sido cumprida antes de o jogador saber dela, que é exatamente o que o pedido
  tira. Medido com a guarda no lugar errado: a sequência chega a **3** sem nenhuma visita.
- **A MARCA É POSTA NA AÇÃO que alcança a tela**, não no `renderNinhos`: render é apresentação e
  acontece de novo toda vez que a tela é redesenhada (voltar de um modal, perder a batalha dos
  quatro). E **quem perde os guardiões não visitou** -- ele não chegou no ninho.

#### ⚠️ A VISITA É DA CONTA, NÃO DO SAVE -- e é aqui que a decisão está

**⚠️ E OS NINHOS ACESOS TAMBÉM, desde 22/09/2026** -- ver **AS TRÊS MISSÕES**, na seção da
Montanha Sagrada. O que continua no SAVE é a **sequência do Zapdos**, e por uma razão que vale
saber: na conta, três ginásios em três saves diferentes levariam o Zapdos.

O pedido diz *"o treinador visita o ninho **pela primeira vez**"*, e **a primeira vez é uma só na
vida do treinador**: por save, seria "a primeira de cada jornada". É a mesma leitura (e o mesmo
molde) do **HM01**, que nasceu por save e foi movido pra conta em 11/09/2026.

**⚠️ E NÃO É SÓ LEITURA DE TEXTO: por save a mecânica quase deixava de existir.** A Montanha sai
em **53,6%** das jornadas, e quando sai ela cai:

| onde a Montanha sai | quantas vezes | ginásios que sobram |
|---|---|---|
| trecho 6 | 42% | 3 -- o Zapdos cabe, no limite |
| trecho 7 | 31% | 2 -- **Zapdos impossível** |
| trecho 8 | 26% | 1 -- **Zapdos e Moltres impossíveis** (o Blaine é o 7º de Kanto, já passou) |

Ou seja: por save, o Zapdos ficava **matematicamente impossível em 58% das jornadas que TÊM
montanha** -- e em 46,4% ela nem aparece.

**O QUE A DECISÃO ENTREGA, medido** (uma jornada que vence os 8 ginásios com 3 de Planta no time):

| a Montanha sai no | 1ª jornada | 2ª em diante |
|---|---|---|
| trecho 6 | 3 ninhos | 3 |
| trecho 7 | 2 | **3** |
| trecho 8 | 0 | **3** |
| não sai | 0 | **3** |

**A descoberta acontece UMA VEZ, e dali em diante o jogo é o de sempre.**

- **⚠️ O CAMPO É NOVO, e não o `visitas`:** aquele tem nome enganoso -- ele conta **LENDÁRIOS
  RECEBIDOS** (quem o incrementa é o `entregarDaMontanha`) e serve só pra variar a semente dos
  guardiões. Lido como "já visitou", ele só viraria 1 **depois** do prêmio.
- **⚠️ A DEDUÇÃO VARRE A CONTA INTEIRA, e não só o save aberto** -- ela nasceu olhando só o save,
  e **o primeiro teste de verdade pegou o buraco**: reportado como *"eu derrotei o blaine com 3
  pokemons de planta e não ativou o ninho de fogo"*. Quem subiu a Montanha **ontem** e hoje
  começou uma jornada **nova** não era reconhecido, porque o save novo não tem progresso nenhum.
  A marca é da CONTA, então a pergunta também tem que ser: basta **um** save mostrar que a tela
  já foi vista. É a mesma razão pela qual o `repararEvolucoesAtrasadas` roda na HOME e não na
  abertura do save.
  São **quatro sinais**, e o quarto existe por um caso que os outros três não pegam: ninho aceso,
  sequência andando, lendário recebido (`visitas`) e **um lendário da Montanha no time**. O save
  que fechou os três ninhos teve as missões **reiniciadas** ao receber o prêmio -- o que apaga os
  três primeiros sinais --, então sem o quarto justamente quem completou tudo perdia a marca.
- **A varredura do relato não achou defeito na missão**, e vale registrar o que ela cobriu: as
  **24 espécies de Planta** do jogo contam (inclusive as de tipo duplo e as de Johto), o Moltres
  acende com 3, 4, 5 de Planta, com um ou dois deles **desmaiados**, com o time de 3, e com as
  formas base. Os únicos "não acende" são os legítimos: dois de Planta, o trecho 7 jogado em
  **Johto** (ali o líder é o Pryce), o ninho já aceso, e o contexto de Ginásio da Cidade sujo.
- **⚠️ O NINHO CHEIO NÃO REPETE A MISSÃO** (a pedido: *"depois de eu conseguir completar uma
  missão, não precisa mais exibir a mensagem dela, somente após resetar as missões"*). Ela já foi
  cumprida -- o que o jogador precisa saber ali é **quem está no ninho**, e a missão de volta faria
  a tela parecer que ainda há o que fazer. **Ela volta sozinha quando as três reiniciam**, porque
  aí o ninho esvazia: o texto sai do MESMO `n.missao` e não há um segundo estado pra manter.
  O CLAUDE.md dizia o contrário (*"o cheio conta a que foi cumprida"*) -- era o desenho de 17/09,
  e durou um dia.
  **Medido a 320px:** o modal do ninho cheio cai de **298 para 281px** e volta aos 298 depois do
  reinício, sem rolagem lateral.
- **O REINÍCIO DO PRÊMIO NÃO ZERA A VISITA**: ela é o CONHECIMENTO do jogador, não o progresso.
  Quem acaba de escolher um lendário está justamente na tela dos ninhos.
- **A gravação é best-effort**, como a do HM e a do rival padrão; e o campo entrou no
  `CAMPOS_DA_CONTA` -- sem isso o `resetGame` o apagaria ao abrir um save e as missões parariam
  de contar em silêncio.

**NADA MUDA NA TELA**, e é consequência: antes da primeira visita a tela dos ninhos nunca é vista,
e depois dela tudo é igual. **As duas impressões -- MOTOR e DIÁRIO -- são idênticas** em 900
batalhas semeadas; o servidor não conhece ninho nenhum.

`tools/test-jornada.js` tranca 37 pontas, e a que importa é a de **PONTA A PONTA**: ela vence os
guardiões de verdade pelo `continueAfterSpecial` e cobra que a tela dos ninhos seja alcançada, que
a chegada marque, e que dali em diante as missões contem -- todos os outros casos chamariam o
`visitarOsNinhos` na mão, e aí a marca podia estar no lugar errado com tudo verde.
Conferido que a bateria acusa com cada defeito religado: **5** falhas sem a guarda, **4** com ela
depois do `passoDoZapdos`, **2** com o reinício zerando a visita e **3** sem a dedução do save
antigo.

## Golpes de VÁRIOS TAPAS: os primeiros com mecânica PRÓPRIA (09/09/2026)

Até aqui todo golpe era um número: tipo e poder. Estes batem **de 2 a 5 vezes numa troca**, e são
os primeiros que mudam o que o motor faz, não só quanto ele tira. São **NOVE**, pedidos em três
levas, e todos com a MESMA distribuição — conferida na fonte golpe a golpe:

| golpe | poder | efetivo | espécies |
|---|---|---|---|
| Tapa Duplo | 15 | 45 | 13 |
| Arranhões Furiosos | 18 | 54 | 20 |
| Ataque Fúria | 15 | 45 | 17 |
| Soco Cometa | 18 | 54 | 4 |
| Canhão de Espinhos | 20 | 60 | 3 |
| Barragem | 15 | 45 | 2 |
| Míssil Agulha | 14 | 42 | 6 |
| Lança de Gelo | 10 | 30 | 1 (Shellder) |
| Rajada de Rochas | 25 | 75 | 6 |
| **Redemoinho de Fogo** | 15 | 45 | 10 |
| **Enrolar** | 15 | 45 | 11 |

**68 das 250 espécies (27%) têm pelo menos um deles**, contando as sobreposições (Rhyhorn e Rhydon
têm Ataque Fúria e Rajada de Rochas; Corsola tem Canhão de Espinhos e Rajada).
A **Lança de Gelo é a única com poder abaixo de 15** e a checagem dela na fonte pegou uma
armadilha: hoje ela é poder 25, mas **na Gen 3 era 10** — que é o que a nossa tabela já tinha, e
serviu de prova de que o gerador de golpes está lendo a geração certa.

- **Pesos oficiais, e são os da Gen 2-4** (fontes: `pokemondb.net/move/double-slap` e
  `/fury-swipes`): 2 tapas 3/8, 3 tapas 3/8, 4 tapas 1/8, 5 tapas 1/8 — média de **3,0 tapas
  exatos**. A Gen 5 mudou pra 1/3, 1/3, 1/6, 1/6 e **não** é a que vale aqui: a base de golpes do
  jogo é Gen 3 (FireRed).
- **`MULTI_GOLPE` é a SÉTIMA tabela duplicada** entre `index.html` e `functions/index.js`, e ela já
  provou que valia a pena ser tabela **duas vezes**: os Arranhões Furiosos entraram como UMA LINHA,
  e os sete seguintes como sete linhas — sem tocar no motor, na tela nem no log.
  **A distribuição é uma CONSTANTE compartilhada** (`TAPAS_2A5`) e não nove cópias do mesmo array:
  nove cópias divergiriam no primeiro ajuste, e é o tipo de erro que ninguém vê. Golpe com
  distribuição própria (o Chute Triplo bate 3 vezes com acerto crescente) ganharia o array dele ali
  e mais nada mudaria.
- **O MOTOR NÃO ESCOLHIA O GOLPE, e sem consertar isso a mecânica seria código morto.** O seletor
  (`melhorAtaque`) compara PODER, e o tapa vale **15** — perde pra qualquer coisa. Medido: um
  Clefairy com dois golpes usava o tapa em **0%** dos confrontos. O que eles valem de verdade é
  poder × média de tapas: **45** o Tapa Duplo e **54** os Arranhões Furiosos, e é isso que o
  `poderEfetivo` devolve pro seletor.
  **QUANTO ELE PASSA A SER ESCOLHIDO DEPENDE DO OUTRO GOLPE, e o CLAUDE.md dizia "99,8%" — errado.**
  Aquele número saiu de uma medição em que o pokémon carregava **só** o golpe múltiplo (`ataques`
  montado com `ataquesDisponiveis(instancia)`, que recebe `(especieId, nivel)` e devolve lista
  vazia se lhe passarem o objeto). Com um segundo golpe de verdade ao lado:

  | | ao lado do golpe MAIS FORTE do bicho | ao lado de um MEDIANO |
  |---|---|---|
  | Tapa Duplo | 4,2% | 35,3% |
  | Arranhões Furiosos | 5,7% | 81,8% |

  Ou seja: quem leva o Talho (70) junto quase nunca vê o golpe múltiplo sair, e quem leva um golpe
  médio vê o tempo todo. **Sem o `poderEfetivo` os mesmos pares dão 0% e 5,6%** — é ele que faz a
  mecânica existir.
- **⚠️ O PODER EFETIVO NÃO PODE ENCOSTAR NO DANO, e encostou — foi o defeito mais caro desta série.**
  O `avalia` do `melhorAtaque` devolve um objeto com `poder`, e **o `calcDamageNew` lê exatamente
  esse campo** (`const potencia = best.poder || MOVE_POWER`). Ao trocar `poder` pelo efetivo pra
  consertar a ESCOLHA, o dano foi junto: cada tapa saía com **45 em vez de 15** e ainda batia de 2 a
  5 vezes — a média de tapas contada **duas vezes**, ~9× o dano pretendido.
  Reportado em 09/09/2026 com log: uma **Clefable Lv.42** matou um Dunsparce de 270 de HP com
  **3 tapas** e um Eevee de 235 com **2**, enquanto a Folha Mágica dela (poder 60) tirava 88 no
  mesmo log. Reproduzido no motor: **97 de dano por tapa** contra o Dunsparce e **124** contra o
  Eevee; consertado, **37 e 50**.
  Hoje o `poder` é sempre o CRU (`GOLPES[id][1]`) e o efetivo entra **só na `nota`**, que é a
  comparação entre golpes. Conferido depois do conserto: uma troca de Tapa Duplo tira **232** e um
  Pancada (poder 40, mesmo tipo, mesmo STAB) tira **201** — a razão de 1,15 bate com os 45/40 que o
  poder efetivo promete. É esse o desenho.
  **A BATERIA INTEIRA PASSAVA COM O DEFEITO**, e vale saber por quê: nenhum teste olhava o DANO
  contra o poder, e a comparação dos dois motores não acusou porque o erro foi introduzido nos
  **dois ao mesmo tempo** — ela compara um com o outro, não com a regra. Hoje há duas travas: uma
  direta (`melhorAtaque(...).poder === GOLPES[id][1]`) e uma de COMPORTAMENTO (o dano de um tapa,
  comparado ao de um golpe de poder conhecido, tem que ficar muito mais perto da razão dos poderes
  CRUS que da dos efetivos). Conferido que as duas falham com o defeito religado.
  **A TELA DE ESCOLHA continua anunciando 15**, o poder cru. É a mesma ressalva que este arquivo já
  registra sobre STAB e subtipo ("Poder não é comparável entre dois golpes do mesmo pokémon"),
  agora com um caso a mais e mais grosseiro — e não foi mexida porque não foi pedido. Se um dia
  incomodar, o lugar é o `cartaoDeGolpe`.
- **A TELA AVISA: `* Golpe repete entre 2-5x`**, pedido junto com a terceira leva. Sem ela o número
  ao lado engana — ele é o poder de **UM tapa**, e o jogador compara um Míssil Agulha de 14 com um
  Talho de 70 sem saber que um dos dois sai de 2 a 5 vezes. É justamente essa a informação que
  decide a escolha.
  **Ela mora no `cartaoDeGolpe`, não em cada tela**: as três telas de golpe (capturou, quer trocar,
  aprendeu) dividem esse bloco, e escrever a frase em cada uma seria garantir que a próxima
  divergisse no texto — que é o que já aconteceu com elas antes de virarem uma cópia só. O pedido
  citava duas telas; ela sai nas três, e na terceira (a captura, onde se escolhe 2 entre N) é onde
  ela mais serve.
  **Sai da TABELA**, não de uma lista à parte: golpe novo no `MULTI_GOLPE` já ganha a observação.
  **Medido a 320px:** uma linha (167px numa coluna de ~180), custa **15px de altura por cartão**, e
  a tela do "quer aprender um golpe novo" fica em 651px, sem rolagem horizontal. O
  `text-transform:none` é obrigatório — o `.golpe-cartao-nome` é uppercase, e a frase em maiúsculas
  viraria um segundo título brigando com o nome do golpe.
- **UMA ENTRADA POR TAPA NO DIÁRIO, UMA LINHA SÓ NO LOG.** É a regra da drenagem (duas entradas,
  uma linha), e foi o pedido: na batalha o jogador lê *"Clefairy usou Tapa Duplo 1x"*, a barra
  desce, *"2x"*, a barra desce de novo; no log fica *"Clefairy atacou Miltank com Tapa Duplo 2x e
  tirou −151 de HP"*, com o total somado.
  A contagem vai **DENTRO do selo** do golpe, que é o mesmo selo do log e da batalha — no meio da
  luta ela é PROGRESSIVA (qual tapa está saindo) e no log é o TOTAL.
- **OS TAPAS PARAM QUANDO O ALVO CAI.** O 4º tapa não sai num pokémon que caiu no 3º — é assim no
  jogo original e é o que preserva o "todo pokémon responde pelo menos uma vez".
- **UM GOLPE DE VÁRIOS TAPAS ERA UM GOLPE SÓ PRO TETO** (`TETO_GOLPES`, história desde
  15/09/2026): só o primeiro tapa ocupava vaga. Sem isso um Tapa Duplo de 5 sozinho estourava o
  teto e jogava o confronto inteiro na reconstrução. E eles **se movem juntos** no reordenamento do moribundo — reordenar entrada a
  entrada partiria o golpe ao meio, com metade antes e metade depois do golpe que o derrubou.
- **ELES SOBREVIVEM À RECONSTRUÇÃO, e isso é o que faz a feature existir.** A reconstrução devolve
  golpes inteiros e não conhece tapa nenhum: medido, sem tratar isso os tapas só apareciam em
  **28,8%** dos confrontos — nos outros a luta passava do teto e o mesmo golpe às vezes contava e às
  vezes não, que é indistinguível de bug pra quem joga. Hoje o `expandirTapas` reparte o golpe
  reconstruído no número de tapas que SAIU DE VERDADE naquele confronto (lido do diário, não é
  sorteio novo) e a visibilidade vai a **100%**. O total não muda, então a soma das linhas continua
  fechando. Golpe pequeno demais pra repartir (menos de 1 de dano por tapa) fica inteiro — passo de
  dano 0 é o que este log evita em toda regra.
- **⚠️ ELE PASSOU A ACONTECER NO ONLINE E NAS LIGAS EM 16/09/2026**, junto com os golpes escolhidos
  chegando lá (ver a seção própria). Este item dizia que "não acontece", e a razão era a mesma de
  sempre: sem golpe escolhido o `lastMove` é null e o motor cai no de tipo. Medido na virada: o
  multi-tapa vai de **0 para 292** em 220 partidas de liga.
- **O PREÇO MEDIDO — na dificuldade, nada, nas três levas:** com os DOIS primeiros e o dano já
  consertado, **76,41% → 76,37%** (−0,04, **0,1σ**); com os **NOVE**, **76,50% → 77,01%** (+0,51,
  **0,8σ**) — 10 blocos de 1.000 jornadas de cada lado em cada medição. Nem com 27% das espécies
  tendo um deles a conta se move: o golpe só sai quando é a melhor escolha do bicho, e os líderes
  continuam no motor implícito de poder 60.
  **AS MEDIÇÕES ANTERIORES FORAM FEITAS COM O DEFEITO DO PODER e não valem** — este arquivo chegou
  a registrar "76,76% → 76,66%" e "76,51% → 76,38%". Elas davam ruído também, mas por acaso: um
  golpe 9× mais forte na mão do jogador E na dos treinadores selvagens se cancelava na conta.
  E aqui vale registrar o método, porque a primeira medição disse outra coisa: com o
  σ BINOMIAL o mesmo A/B dava "−1,39 ponto, 2,1σ", o que pareceria efeito real. **O σ binomial não
  serve pra este simulador** — jornadas dentro de uma mesma rodada compartilham estado, e o desvio
  entre blocos de 1.000 é 1,6 a 1,8 ponto contra 1,3 do binomial. A medição boa é em BLOCOS
  independentes, com o desvio tirado deles. (Este arquivo já tinha a pista: "o próprio simulador
  varia mais que isso — três amostras de 5.000 deram 66,2%, 67,6% e 68,3%".)
- **O PREÇO EM TEMPO É REAL, e é o que vale acompanhar:** cada tapa é um passo, e todo passo com
  nome de golpe leva a pausa de 1s (`PAUSA_ANTES_DO_GOLPE_MS`). Num time em que os SEIS levam o
  golpe, a batalha 6x6 vai de **38,8s para 49,1s** (+10,3s, **26%** mais lenta) e os passos por
  confronto de 2,57 pra 3,21. Com um só carregando o golpe o custo é ~1/6 disso. Se incomodar, o
  lugar de mexer é isentar o 2º tapa em diante da pausa — o nome já está na tela, só o número muda.
  (Medido com o defeito do poder dava +23,5s e 61%: o dano inflado alonga a barra, e a barra é
  metade do tempo do passo.)
- **A contagem de espécies está na tabela lá em cima**, e ela sai do `APRENDIZADO` — não de uma
  lista escrita à mão aqui, que envelheceria na primeira mexida na base de golpes.
  Duas coisas que a intuição erra: **Marill NÃO aprende Tapa Duplo** por nível na Gen 3 (foi o
  exemplo do pedido, e não acontece com ela), e a **Lança de Gelo tem UM dono só**, o Shellder —
  o Cloyster não a herda, ele aprende Canhão de Espinhos no 41.
- **TRÊS FALSOS POSITIVOS DO TESTE saíram junto, e vale saber por quê** — os três eram do jeito
  mais perigoso: intermitentes, ~1 rodada em 10, sempre num confronto diferente.
  1. **O scanner de cadáver ignorava a CURA de abertura**, então lia o pokémon com a vida de ANTES
     dela e acusava "atacou morto" quem tinha acabado de se curar (um Lugia que entrou com 32 e
     curou 279). Medido: 3 em 7.555 confrontos. Hoje ele aplica TODA entrada — e quando o campo
     `hp` existe é ele a fonte, porque é a vida que o motor gravou; só a reconstrução, que não o
     traz, cai na subtração.
  2. **A trava das trocas livres do sono não previa o revide na PRIMEIRA linha.** Quando a troca
     livre mata o adormecido ele revida, e o reordenamento põe o revide ANTES do golpe que o
     derrubou — aí o índice 0 já é do outro lado e a conta de trocas livres dá zero, sem defeito
     nenhum. Ficou visível quando o sono passou a comprar UMA troca.
  3. **O teste da linha de status pegava confronto com DOIS especiais** (cura *e* sono, por
     exemplo) e media o perfil do outro. Hoje ele exige confronto com um especial só.
  **A lição é a de sempre neste log: teste que amostra confronto aleatório precisa de invariante,
  não de contagem** — e os três só apareceram porque a mecânica nova mudou a semente e sorteou
  confrontos que nunca tinham sido sorteados.
- **`tools/test-especiais.js` VARRE A TABELA, não nomeia golpe** — golpe novo no `MULTI_GOLPE` já
  nasce coberto, e um que saia derruba o teste em vez de sumir em silêncio. Ele tranca: os quatro
  pesos de cada golpe, que o poder efetivo é 45 e 54 (e que TODO golpe da tabela vale mais que o
  cru), que a tabela é igual nos dois motores, que os tapas aparecem em 100% dos confrontos que os
  têm, que a frase numera cada um, que o log traz UMA linha com o total, e que nenhum tapa sai
  depois de o alvo cair. Cada golpe tem um DONO declarado no teste, e falta de dono é assertiva.
  **O dono leva o golpe múltiplo mais o MAIS FORTE que ele tem** — o caso duro. Emparelhar com um
  golpe fraco de propósito inflaria a amostra e provaria menos.

### TRÊS GOLPES BATEM SEMPRE DUAS VEZES (13/09/2026)

Pedido assim: *"quando um pokemon usar o ataque double kick, Bonemerang e o Twineedle, coloque pra
bater 2x, igual como os outros ataques já batem mais vezes"*. No jogo oficial eles não sorteiam
nada: são dois golpes, sempre.

- **FOI UMA LINHA DE TABELA, e isso era a previsão.** O comentário do `TAPAS_2A5` dizia: *"se um dia
  entrar um golpe com distribuição própria (o Chute Triplo bate 3 vezes com acerto crescente, por
  exemplo), ele ganha o array dele aqui e mais nada muda"*. Foi exatamente isso: nasceu o
  `TAPAS_SEMPRE_2 = [[2,1]]` e o motor, o log, a animação, o selo `2x` e o `poderEfetivo` saíram de
  graça.
- **14 ESPÉCIES**: Chute Duplo (8 — a linha do Nidoran, Hitmonlee, Jolteon), Ossomerangue (2 — Cubone
  e Marowak) e Agulha Dupla (4 — a linha do Caterpie e o Beedrill).
- **O PODER EFETIVO DOBRA**, que é o que os põe na disputa do `melhorAtaque`: o Ossomerangue vale
  **100** na comparação (50 × 2), que é o que ele tira de verdade. Sem isso um golpe de 50 perderia
  pra qualquer alternativa e a mecânica seria código morto -- a mesma razão pela qual o
  `poderEfetivo` existe.
- **⚠️ E O TESTE COBRAVA OS QUATRO PESOS DO 2-A-5 EM TODO GOLPE DA TABELA.** Isso era verdade
  enquanto todos dividiam a mesma distribuição e virou mentira no dia em que entrou um golpe com a
  sua. Hoje ele cobra que o SORTEIO bate com a tabela **daquele** golpe, que é a regra de verdade:
  um ajuste continua sendo pego e golpe novo com distribuição nova nasce coberto.
- **⚠️ O MÍSSIL AGULHA TROCOU DE DONO NO TESTE** (Beedrill → Qwilfish): o Beedrill também aprende a
  Agulha Dupla, e com o mesmo dono pros dois o teste mediria o golpe que o motor escolhesse, não o
  que ele quer cobrir. Cada golpe da tabela precisa de um dono que só tenha ELE.
- **⚠️ E ELES DESENTERRARAM UM FLAKE ANTIGO DO TESTE, que não é do jogo.** A conta de "uma linha por
  golpe" cortava o log por `' de HP.'` -- só que a frase de um especial não termina assim, e ficava
  **colada** na linha de ataque seguinte. Como a frase da CONFUSÃO nomeia o golpe que o pokémon usou
  EM SI MESMO (*"se acertou com Agulha Dupla"*), o pedaço colado casava com o nome e contava como
  mais uma linha. Dava 2 a 5 falsos positivos em ~590 confrontos e só aparecia com confusão no
  painel -- o tipo de teste que passa quase sempre. Hoje o corte é pelo próprio HTML
  (`<div class="mlog-passo">`), que é onde a linha de verdade começa. Quatro rodadas seguidas em
  zero. **O log sempre esteve certo.**

### OS DOIS DE PRENDER VIRARAM DE VÁRIOS TAPAS (14/09/2026)

Pedido assim: *"coloque que os moves fire spin e wrap, também ataquem de 2x a 5x igual outros
ataques desse estilo que já existem"*.

- **⚠️ NO JOGO OFICIAL ELES NÃO SÃO DE VÁRIOS TAPAS — são de PRENDER.** Lá o Fire Spin e o Wrap
  seguram o alvo por **2 a 5 TURNOS**, tirando uma fatia a cada um. Aqui eles viram 2 a 5 tapas na
  MESMA troca: **o número de vezes é o mesmo, e a distribuição também** — o que muda é caberem num
  confronto só, que é como este motor resolve tudo. Fica registrado porque a diferença some da tela
  e quem for conferir contra o jogo original vai encontrá-la.
- **FOI UMA LINHA DE TABELA CADA**, que era a previsão do `MULTI_GOLPE`: o motor, o log, a animação,
  o selo `Nx`, o `poderEfetivo` e a frase do cartão saíram de graça.
- Os dois têm **poder 15**, igual ao Tapa Duplo e ao Ataque Fúria — o efetivo vai a **45**.
  São **10 espécies** no Redemoinho (a linha do Charmander, Vulpix/Ninetales, Ponyta/Rapidash,
  Moltres, Flareon, Entei) e **11** no Enrolar (Bellsprout/Weepinbell, Ekans/Arbok,
  Tentacool/Tentacruel, Lickitung, a linha do Dratini, Shuckle).

**⚠️ O PREÇO MEDIDO, e ele é de UMA ESPÉCIE:** dos 21 que aprendem, só **5 levam** no moveset padrão
do nível 50, e só **2 usam** de verdade. O motor escolhe pelo dano, e o `poderEfetivo` de 45 ainda
perde pra quase tudo:

| | usa antes | usa depois | vitória |
|---|---|---|---|
| **Ninetales** | 0,0% | **96,6%** | 12,8% → **19,8%** (+7,0) |
| Shuckle | 0,0% | 10,3% | — |
| Dragonite, Dragonair, Lickitung | 0,0% | **0,0%** | não se move |

**NA JORNADA NÃO MOVE NADA: 58,54% contra 58,75%** — **+0,21 ponto, 0,2σ** (6 blocos de 800 de cada
lado, 4.800 jornadas de cada, desvio tirado de ENTRE os blocos; 2 de 6 blocos pro lado fácil, ou
seja ruído puro). Faz sentido: é uma espécie em 250, e ela cai dos dois lados da luta.

A Ninetales é o caso extremo pelo mesmo motivo do Shuckle no Rolamento: **o arsenal dela é fraco**,
então um golpe de 15 × 3 vezes ganha do que ela tinha. Quem tem Terremoto ou Hiper Raio não olha
para ele.

- **⚠️ OS DONOS DO TESTE PRECISARAM SER LIMPOS:** a **Rapidash** também tem Ataque Fúria e o
  **Shuckle** também tem Míssil Agulha — com eles, o teste mediria o golpe que o motor escolhesse e
  não o que ele quer cobrir. É a mesma lição que o Míssil Agulha já tinha custado quando trocou do
  Beedrill pro Qwilfish. Ficaram a **Ninetales** e o **Arbok**.

## ⚠️ A BATALHA NA TELA MORA EM `docs/batalha-na-tela.md`

**LEIA ESSE ARQUIVO ANTES DE MEXER NO LOG DE BATALHA, NA CENA, NA ANIMAÇÃO OU EM QUALQUER LINHA QUE
O JOGADOR LEIA DURANTE UMA LUTA.** É onde estão os defeitos mais reportados do projeto — quase todos
da forma *"o log diz uma coisa e a tela mostra outra"* —, e cada conserto tem a medição do lado.

⚠️ **A REGRA MAIS CARA DAQUI: nunca chamar `render()` durante uma animação.** Ele recria o
`innerHTML` e mata a transição CSS da barra de vida no meio; quem pinta durante a luta é o DOM.
Isso já custou defeito **cinco vezes** (o modal da contagem, os chips do revezamento, o mapa do
Resgate, o quadro vazio da Corrida e o GIF da Pescaria).

⚠️ **E A SEGUNDA: o log e a animação leem a MESMA lista** (`sequenciaDoConfronto`). Enquanto foram
montados em separado, o jogador via 3 golpes na tela e lia 7 linhas — reportado três vezes.

**O que está lá:** o **log de batalha** inteiro (a forma da linha, o diário, o que nunca vira linha, o
selo de crítico, a suavização, o card que abre e fecha), a **cena nova** com os cenários por
terreno e a chuva, o **nome do golpe durante a luta**, as **pausas** de leitura, os **cinco laços
de revelação** e o que cada um pinta.

**⚠️ E ESTES SÍMBOLOS SÓ SÃO EXPLICADOS LÁ** — um `grep` que caia aqui e não ache nada tem que
ir pro capítulo, e é essa lista que faz o gatilho valer quando o assunto não é óbvio:

`index.html` · `fighterHtml` · `passosVisiveis` · `crispEdges` · `simulateGymBattle` · `innerHTML` · `MORIBUNDO_TETO_NO_CHEIO` · `TETO_GOLPES` · `terrainBattleSceneStyle` · `doExchange` · `sequenciaDoConfronto` · `fraseDoEspecial` · `encerrarBatalha` · `passosDaAbertura` · `DESENHOS` · `virarMatchup` · `preservePlayerHp` · `currentColor` · `SONO_EM_TROCAS` · `buildAnimatedHitSequence` · `ORCAMENTO_ANIM_ONLINE_MS` · `logDaMinhaVista` · `pausaDaFaixa` · `obsDoGolpe` · `abrirConfronto` · `spriteComStatusHtml` · `CRIT_BASE` · `applyTerrainBuff` · `m.chuva` · `lastCrit` · `moveTeam` · `ehGolpeEspecial` · `passosHtml` · `Math.random`

*(4 seções, 118 subseções, 238 KB — saíram daqui em 25/09/2026 porque o CLAUDE.md é lido
INTEIRO em toda sessão, e ele tinha chegado a 1.360 KB.)*

## Bifurcação Kanto / Johto

- **Sete iniciais**: os três de Kanto, os três de Johto e o Pichu, agrupados por região na tela.
  Qualquer um atravessa qualquer caminho — a escolha de ginásio vem depois, e a cada trecho.
  `RIVAL_STARTER_COUNTER` e `STARTER_EVOLUTIONS` ganharam o triângulo de Johto.
  **Custo medido:** o sorteio de shiny corre POR INICIAL, então crescer a lista cresce a chance de
  aparecer um shiny na tela — de 3 pra 7 iniciais foi de **2,3% → 5,3%** no normal e de
  **9,1% → 19,9%** no difícil. O teto da
  artimanha (6 sorteios presos, 3 slots × 2 modos, sem jogar nada) vai de **13% pra 28%**. Se um
  dia isso incomodar, o conserto é sortear só entre os três da região escolhida — mas hoje a
  região só é escolhida DEPOIS do inicial.
- **As insígnias são a imagem real** em toda tela, inclusive na escolha de caminho e na vitória.
  Os caminhos do Bulbagarden Archives **não se inventam**: é um MediaWiki, e a pasta é o MD5 do
  NOME DO ARQUIVO — `md5("Zephyr_Badge.png")` começa em `4a`, daí `/thumb/4/4a/…`. As oito de
  Johto foram escritas de cabeça na primeira versão e **as oito deram 404 em silêncio**: o
  `onerror` do `badgeMarkup` caía no selo colorido e o jogo parecia funcionar.
  Pra conferir: `printf '%s' Nome_Badge.png | md5sum | cut -c1-2`. `tools/test-jornada.js` trava
  isso recalculando o MD5 das 16.
- A jornada continua com **8 etapas**, mas em cada uma o treinador escolhe entre o ginásio de
  Kanto e o de Johto daquela altura (tela `gymChoice`, "Qual ginásio vamos?"). A escolha decide o
  líder, a insígnia e **quais duas rotas** aparecem em seguida — por isso ela vem ANTES de
  `routeCards` ser calculado: as rotas de Johto não existem até a região estar decidida.
- `game.gymPath` guarda a região de cada etapa (`['kanto','johto',...]`). Save antigo não tem o
  campo: `regiaoDaEtapa` devolve `'kanto'` e a jornada dele continua idêntica ao que era.
  `GYMS` virou `KANTO_GYMS` + `JOHTO_GYMS`, e quem responde "qual ginásio agora" é `gymOf(etapa)`.
- **Os dois lados têm o mesmo número de pokémon e a mesma média de nível em cada etapa**, e os
  selvagens saem do mesmo `LEGS` — a escolha é de TIPO, não de dificuldade. `tools/test-jornada.js`
  tranca isso.
- **Parear nível e quantidade NÃO bastou** — as espécies têm forças muito diferentes. Medido com o
  smoke (`--regiao kanto|johto`, 1.200 jornadas de cada lado), a primeira versão dava **67% x 87%**
  a favor de Johto. Três ajustes fecharam a conta:
  1. **Falkner** não matava NENHUMA jornada, contra 60 do Brock. O primeiro ginásio é a peneira
     (ver a nota do Brock abaixo) e um Falkner de brinquedo tirava isso do caminho de Johto. O
     Hoothoot virou **Skarmory** — a Aço/Voador faz o papel de muralha que o Onix faz do outro
     lado, e o espelho fica bonito: no Brock o Bulbasaur passa fácil e o Charmander sofre, aqui é
     o contrário. (Noctowl foi tentado antes e não bastou: 100 de HP não compensam 50 de Defesa.)
  2. **Jasmine** matava 38 em 300, contra 0 da Sabrina — a Skarmory dela virou Magneton.
  3. **Clair** tinha um Dratini (300 de BST) no último ginásio da jornada. Viraram três Dragonair,
     como no jogo original. Uma versão com duas Kingdra foi longe demais (Johto caiu pra 52%).
  Resultado, com 1.500 jornadas de cada lado: **66,0% x 68,4%** — 1,4σ, dentro do ruído.
- 16 rotas de Johto (`JOHTO_ROUTE_MAP`), duas por etapa, seguindo o caminho real do Crystal até
  cada ginásio. Pools de 7 a 9 espécies misturando as duas gerações, como no original. Alguns
  encontros são piscadelas pro jogo: Lapras na Caverna União, Lugia nas Ilhas Redemoinho,
  Sudowoodo nas Rotas 36/37, o Gyarados do Lago da Fúria.
- 16 rotas de Kanto ganharam espécies de Johto onde cabiam (Ledyba na Floresta de Viridian,
  Heracross na Zona de Safári, Sentret na Rota 22, Houndour na Mansão…).
- **QUATRO INTOCÁVEIS: Mewtwo, Lugia, Ho-Oh e Celebi não aparecem como selvagem** (decisão de
  31/08/2026). Lugia e Ho-Oh eram raros de 5% no Caminho de Gelo e no Covil do Dragão e saíram;
  o Celebi nunca esteve em rota; o Mewtwo vem do desafio próprio. `ESPECIES_INTOCAVEIS` (os três
  que NINGUÉM captura) e `SEM_CAPTURA_SELVAGEM` (os três + Mewtwo) existem porque essa regra tem
  consequência em cascata:
  - **O desafio do Mewtwo abre com KANTO FECHADO** — as 149 de #001 a #149 (o #150 é o próprio
    Mewtwo, o #151 nem está no `SPECIES`). Era "toda a Pokédex menos o Mewtwo", o que com Johto
    virou 249 espécies — e três delas ninguém captura, então **a condição não fechava mais pra
    ninguém desde 30/08** e nada acusava, porque exige quase tudo. Kanto fechado é o marco que esse
    desafio sempre quis marcar, e Johto não entra na conta.
  - **"Mestre Pokémon" e "Pokédex de Johto"** passaram a cobrar o que dá pra ter, não o total da
    tela (que continua mostrando 250 — eles são entradas de verdade da Pokédex). Conquista
    impossível é pior que conquista nenhuma: ninguém consegue nem saber por que não acendeu.
  - **A conquista "Mar e Céu"** (capturar Lugia e Ho-Oh) foi removida no mesmo movimento — ela tinha
    nascido horas antes e a regra nova a tornou impossível.
  - **A Torre não sorteia nenhum dos quatro** pro time dos NPCs (`TOWER_EXCLUDED`): encontrar num
    andar comum um bicho que o jogador nunca vai poder ter esvazia o que eles são. Conferido: antes
    disso saíam mesmo — Celebi e Ho-Oh apareceram na torre gerada do dia.
  A oferta selvagem ainda tem uma rede de segurança: se um deles voltar pra um pool por engano, a
  tela troca por um pokémon do pool da etapa em vez de oferecê-lo.
- **Os seis lendários capturáveis são 5% por encontro, na única rota onde cada um mora.** Isso vale pras três
  aves de Kanto e pros cinco de Johto (as três bestas, Lugia e Ho-Oh) — `LENDARIOS` e
  `ehLendario()` existem pra que os oito sejam tratados igual. Medido: 4,95% a 5,21%.
  Duas coisas estavam erradas antes disso:
  1. **Um sorteio extra de 5% no trecho 8** dava uma ave qualquer, de quando as aves não tinham
     rota própria. Hoje têm, e ele SOMAVA com o da rota: Zapdos e Moltres saíam a **6,6%** por
     encontro, contra os 5% de todos os outros. Removido.
  2. **Os cinco de Johto não eram reconhecidos como lendários** e entravam no nível normal da
     etapa — um **Lugia nível 23**, um Raikou nível 20. Agora `nivelDeLendario(leg)` dá
     `min(50, teto da etapa + 12)` pra todos: os 12 vêm do que as aves de Kanto já faziam na
     prática (Articuno aparecia no nível 50 numa etapa cujo selvagem ia até 38).
  (Lugia e Ho-Oh saíram desta conta em 31/08/2026 — viraram intocáveis, ver acima.)
  **5% por encontro não é 5% por jornada**: cada lendário mora numa rota só, o treinador só faz um
  encontro por trecho e ainda escolhe entre duas rotas. Medido em 20 mil jornadas com escolhas
  aleatórias: **1,2% a 1,4% por lendário**, 9,8% de ver algum e **0,28% de ver dois**. Quem escolhe
  a rota de propósito chega a 2,5% por lendário. `tools/test-jornada.js` tranca os 5%, o nível, e
  que nenhum lendário apareça em duas rotas nem num pool (onde não haveria chance própria).
- **Todo lendário mora em trecho 7 ou 8, um por rota.** Antes Raikou saía no trecho 4, Lugia no 5 e
  Entei no 6 — e como lendário vem 12 níveis acima do teto do trecho, um Raikou nível 35 no trecho
  4 resolvia sozinho metade da jornada. Hoje: Monte Mortar (Raikou), Lago da Fúria (Suicune),
  Mansão Pokémon (Entei), Ilhas Seafoam (Articuno) no trecho 7; Caminho de Gelo (Lugia), Covil do
  Dragão (Ho-Oh), Usina (Zapdos), Victory Road (Moltres) no 8. Com todos em trecho 7-8, o
  `nivelDeLendario` bate no teto e os oito nascem no **nível 50**.
  `tools/test-jornada.js` falha se algum voltar pra trecho baixo ou se dois dividirem uma rota.
- Na tela de escolha de ginásio, o **tipo é o selo colorido** (`typePill`), não a palavra ao lado do
  nome — é o mesmo selo da Pokédex e da batalha, então se reconhece pela cor antes de ler. A
  insígnia fica grande à esquerda com o nome dela embaixo, o líder ao centro, e a contagem de
  pokémon saiu (não ajudava a escolher: os dois lados têm sempre o mesmo número).
  **Os dois caminhos do trecho aparecem DENTRO da coluna centralizada**, um por linha, embaixo da
  cidade. Como linha própria embaixo do corpo — a primeira versão — eles viravam um rodapé solto
  encostado na borda esquerda e a insígnia deixava de cobrir a altura do card. Um por linha, e não
  "A ou B" na mesma linha, porque a coluna tem 132px a 320px e a frase inteira mede ~200: quebraria
  no meio de um nome. Medido: o mais largo dos 32 caminhos ("Desvio por Lavender") dá 126px, todos
  cabem numa linha. `tools/test-jornada.js` conta as tags que fecham entre a cidade e os caminhos
  (1 dentro da coluna, 3 se voltarem a ser rodapé).
  **O nome do líder é centrado no CARD, não no espaço que sobrou dele.** Como a insígnia ocupa uma
  coluna à esquerda, centralizar dentro do que restava punha o nome 37px à direita do centro, e
  isso se vê a olho. O conserto é a margem espelho em `.gym-choice-info`: ela repete à direita a
  largura da coluna da insígnia mais o gap. Cada pixel dessa coluna sai do nome do líder — é por
  isso que ela é 58 e não 64: com 64, "Lt. Surge" quebrava em duas linhas a 320px.
- A tela que lista a Elite 4 usa a **fila sorteada**, não a de Kanto. O sorteio acontece ao ABRIR
  essa tela e não ao aceitar o desafio: ela ANUNCIA os cinco adversários, e sortear depois faria o
  jogador ler uma fila e enfrentar outra. As mensagens que diziam "recomeça da Lorelei" passaram a
  nomear o primeiro da fila dele.
- **O botão "Seu time" está nas TRÊS telas onde se decide alguma coisa sobre o time**: o encontro
  selvagem, a escolha de ginásio e a escolha de rota (`botaoSeuTimeHtml`). Nas duas últimas a
  pergunta é a mesma do encontro — "que tipo falta no meu time?" — e a resposta estava a duas telas
  de distância. O modal já é anexado pelo render principal, então serve em qualquer tela sem mais
  nada.
- Na tela do encontro selvagem: botão **"Seu time"** (modal com o time atual) e uma **lupa por
  pokémon**, que abre a mesma ficha de atributos da Pokédex. A lupa PARECE estar dentro do card,
  mas no HTML ela é **irmã** dele e volta pra cima por `position:absolute` — `<button>` dentro de
  `<button>` é HTML inválido e o clique de dentro se perde. De quebra ela sobrevive ao card
  desabilitado (o de quem já escolheu 2), e é justamente aí que dá vontade de consultar o terceiro:
  descendente de button desabilitado não recebe clique nenhum.
  O disfarçado (Ditto fingindo de Mew) não ganha lupa: a ficha lê o `SPECIES` de verdade e
  entregaria a pegadinha.
  **O nível fica na linha do NOME**, na fonte e na cor de lá. Passou uma versão com ele na linha de
  baixo, menor e azul, pra abrir espaço pra lupa — não é o mesmo texto e se nota na hora. O espaço
  sai mesmo é do card: a lupa come 46px e a 320px o nome comprido quebra de linha. Por isso o
  "— Lv.16" vive num `.wild-lv` com `nowrap` — a quebra cai ANTES do travessão e não no meio dele,
  senão sobra um travessão pendurado no fim de uma linha e um "Lv.16" órfão na outra.
- **Todo pokémon tem que ter como ser capturado.** Uma espécie que não está em rota nenhuma e não
  evolui de nada é uma vaga impossível na Pokédex — e a Pokédex completa é o que libera o desafio
  do Mewtwo. Quando Johto entrou, **17 não-lendários ficaram assim** (Pichu, Togepi, Togetic,
  Slowking, Bellossom, Politoed, Skarmory, Unown, Wobbuffet, Yanma, Gligar, Qwilfish, Shuckle,
  Remoraid, Octillery, Smeargle, Igglybuff) e nada acusava. Foram distribuídos pelas rotas onde
  aparecem no jogo original. As três bestas e o Ho-Oh entraram como raros de 5% (ver a nota dos lendários acima).
  Sobram **duas exceções legítimas, uma por região**: o Mewtwo (vem do desafio próprio, não de
  rota) e o Celebi (o "impossível" de Johto, como o Mew é o de Kanto). `tools/test-jornada.js`
  calcula o fecho transitivo das evoluções e falha se aparecer uma terceira.
- **Espeon e Umbreon dependem do RELÓGIO DO CELULAR**: dia das 6h às 17h59 traz o Espeon, noite das
  18h às 5h59 traz o Umbreon — a mesma faixa do Gold/Silver/Crystal. É a única mecânica do jogo que
  olha a hora. O relógio é o do aparelho e não o do servidor de propósito: quem joga às 22h no
  Brasil espera Umbreon, e um fuso escolhido por nós faria a tela discordar do celular na mão da
  pessoa. Dá pra adiantar o relógio e pegar o outro — é o mesmo "custo" que o jogo original tinha.
  As duas nunca aparecem juntas; as outras quatro opções (manter, Vaporeon, Jolteon, Flareon)
  continuam sempre disponíveis.
- **⚠️ O GINÁSIO NÃO SORTEIA TERRENO (25/09/2026)** — ver a seção **O TERRENO DO GINÁSIO É O
  PRÓPRIO GINÁSIO**, mais abaixo. Os **51 abaixo continuam valendo pra LIGA, o Ginásio do Bairro e
  a Trainers League**; o ginásio da jornada usa os 16 do `GYM_TERRAINS`, que é outra tabela.
- **Terrenos: 51, seis de CADA um dos 17 tipos.** A conta importa porque o terreno é sorteado da
  lista e quem for do tipo dele ganha 1,15× em todos os atributos (~15 níveis, ver acima) — um tipo
  com mais terrenos ganha o buff com mais frequência. A tabela tinha 39 terrenos, exatos 5 por
  tipo, e quando Sombrio e Aço entraram com Johto eles ficaram com **zero**: um Umbreon, um
  Houndoom ou um Steelix nunca ganhava bônus de terreno, em partida nenhuma, e nada no jogo
  indicava isso. Os 12 novos levam os dezessete tipos a 6 cada.
  `tools/test-terrenos.js` confere a contagem e que a tabela continua idêntica nos dois arquivos.
- **A dica do ginásio (`adviceTypes`) tem que ser verdade.** Ela é a frase "leve pokémon do tipo X",
  e o jogador tem 5 tentativas por ginásio — uma dica errada custa uma delas. A Jasmine dizia
  "Fogo, Lutador e Terra", copiado do time dela no jogo original: só que aqui os Magnemite/Magneton
  são **Elétrico puro** (tipagem da Gen 1, eles ainda não eram Aço), e Fogo/Lutador acertavam
  **1 de 5**. Virou só "Terra", que pega os cinco e ainda é imune ao ataque deles. O Pryce tinha o
  mesmo problema (Fogo 2/5, Pedra 2/5) e virou "Planta, Lutador e Elétrico".
  `tools/test-jornada.js` recalcula a cobertura das 16 dicas contra o TYPE_CHART.
- Evoluções que vinham de troca no jogo original seguem a regra que Kanto já usava: **viram nível
  40**. Vale pro Seadra→Kingdra, Onix→Steelix, Scyther→Scizor, Golbat→Crobat, Chansey→Blissey e
  Porygon→Porygon2, exatamente como Machoke→Machamp e Haunter→Gengar já faziam.
- **⚠️ O NÍVEL 40 É UM BALAIO DE TRÊS COISAS, e vale saber quais** — a regra acima é "o que NÃO
  evolui por nível vira 40", e com o tempo isso juntou métodos diferentes no mesmo número. Dos **30
  degraus** que moram lá: **14 são PEDRA** (as seis da Gen 1/2 — Lua 4, Folha 3, Água 3, Fogo 2,
  Trovão 1, Sol 1), **8 são TROCA**, **3 são AMIZADE** (Chansey, Golbat, Togepi) e **5 evoluem por
  NÍVEL mesmo** (Ponyta, Kabuto e Omanyte, que são 40 no original, mais o Voltorb e o Koffing).
  É esta a lista que sairia da tabela no dia em que as pedras entrarem — e o que mais pesa nesse dia
  **não é o encontro selvagem, é o `finalEvolutionOf`**: ele sobe pela tabela e monta o time do
  RIVAL e o pool da Torre. Medido, tirando os 14 degraus **22 espécies mudam de "evolução final"** e
  o pool vai de 138 pra 152 — o rival passaria a levar Vulpix em vez de Ninetales e Gloom em vez de
  Vileplume. Quem for implementar pedra precisa de uma lista de "final por pedra" à parte.
- **⚠️ O VOLTORB E O KOFFING ESTAVAM NO 40, e era erro de varredura** (corrigido em 14/09/2026): os
  dois evoluem por NÍVEL no original — **Voltorb no 30 e Koffing no 35** — e tinham sido varridos
  pro balaio junto com os de troca. Ficaram anos assim, e o achado saiu de contar quem SAIRIA do 40
  no dia das pedras, não de um relato.
  **O QUE MUDA NA PRÁTICA É UM LUGAR SÓ, e ele está medido.** As duas linhas moram em 4 rotas, e em
  3 delas a faixa de nível do trecho já resolvia igual:

  | rota (trecho) | antes | depois |
  |---|---|---|
  | Estrada Ciclável (5, Lv.23-28) | Koffing e Voltorb | **igual** — a faixa não alcança 30 nem 35 |
  | **Farol de Olivine (6, Lv.28-33)** | Voltorb sempre | **Electrode em 67% das vezes** (Lv.30-33) |
  | **Farol de Olivine** — o Weezing | saía em **Lv.42,5** de média | **Lv.37,5** (o piso caiu de 40 pra 35) |
  | Usina e Caminho de Gelo (8, Lv.50-55) | Electrode e Weezing | **igual** — já convertiam |

  O piso é o `EVOLVED_MIN_LEVEL`, que sai do próprio `EVOLUTIONS`: baixar o nível da evolução baixa
  junto o nível em que a forma evoluída pode aparecer selvagem.
  **⚠️ E ELE MEXE EM SAVE QUE JÁ EXISTE:** o `repararEvolucoesAtrasadas` roda no carregamento da
  HOME e conserta quem ficou pra trás quando a tabela muda — que é exatamente este caso. Quem tem um
  **Koffing Lv.35+** ou um **Voltorb Lv.30+** guardado vai encontrá-lo já evoluído, com a caixa de
  aviso da home explicando. É o mecanismo funcionando como foi desenhado (ele nasceu porque "toda
  vez que a tabela crescer, quem já passou daquele nível fica pra trás"), mas é bom saber antes.
  **Custo medido na jornada: 61,88% → 62,77%, **+0,90 ponto, 1,3σ** (8 blocos de 1.000 jornadas de cada lado, desvio tirado de ENTRE os blocos, 6 de 8 pro lado fácil) — dentro do ruído, e pro lado esperado: um Electrode no lugar de um Voltorb no 6º trecho é um upgrade, e o Weezing 5 níveis abaixo puxa de volta.**
  `tools/test-johto.js` **FIXA os cinco níveis** (30, 35, 40, 40, 40) e cobra que nenhum degrau por
  nível sobre no balaio do 40 — o próximo acrescentado "no 40 por padrão" passa a ser barulhento.
- **O `game.startersShiny` vazava entre saves** — e furava a trava anti save-scumming inteira. Ele
  é escrito só na criação do save, **não está no `serializeGame` nem no `freshGameDefaults`**, e o
  `applySavedState` não o toca. Então ele atravessava de um save pro outro, nos dois sentidos:
  criar no slot 0 em **difícil** (4× a chance), ver o shiny, ir pra home e abrir um save parado na
  tela `start` do slot 1 dava um inicial shiny num save **normal**, com o sorteio de outro slot —
  e o sorteio do slot 1 continuava intacto pra ser usado depois. Na direção inversa, depois de um
  F5 o campo sumia e um save que TINHA shiny guardado voltava sem estrela nenhuma.
  Conserto: `continueSave` recompõe pelo `startersSorteados` (que é da conta e sobrevive ao F5).
  Achado por revisão adversarial, não por teste — o defeito é anterior aos 6 iniciais, que só
  dobraram a superfície. Hoje `tools/test-artimanha.js` cobre os dois sentidos.
- **Seis bebês da Gen 2 eram becos sem saída**: Pichu, Cleffa, Igglybuff, Smoochum, Elekid e Magby
  entraram no `SPECIES` sem entrada no `EVOLUTIONS`. A causa foi o filtro da fusão, que só aceitava
  evolução cujo DESTINO estava em Johto — e esses seis apontam pra adultos de Kanto (Pikachu,
  Clefairy, Jigglypuff, Jynx, Electabuzz, Magmar). Togepi e Tyrogue, que apontam pra Johto,
  passaram. Entraram no **nível 20**: são evolução por amizade no original, e 40 (a regra da casa
  pro que não é por nível) seria tarde demais pra um bebê que nasce fraco.
- **`TYPE_COLORS` e `TYPE_NAMES_PT` ficaram pra trás** quando Sombrio e Aço entraram no
  `TYPE_CHART`: o selo de um Umbreon saía escrito "Dark", em inglês, num cinza genérico. Pior, o
  `englishTypeFromPortuguese` não achava "Aço", então o `pickGymTerrain` da Jasmine caía na rede de
  segurança e sorteava um terreno qualquer em vez de um do domínio dela. As **três** tabelas têm
  que andar juntas — `tools/test-terrenos.js` confere isso e mais: que o tipo de todo ginásio volta
  do português pro inglês e tem terreno próprio.
- **O mapa pintava a cidade errada.** Ele desenha cidades de Kanto mas colorizava o ponto com
  `gymOf(i)` — o líder realmente enfrentado —, então Pewter City aparecia com a cor da Insígnia
  Zéfiro quando o trecho 1 tinha sido jogado em Johto. Voltou pro `KANTO_GYMS` (a cor da cidade que
  está escrita ali) e ganhou um aviso dizendo quantos trechos foram em Johto, apontando pra trilha
  de insígnias, que é quem mostra o caminho real. Mentir em silêncio era pior que admitir o limite.
- **`gymChoice` entrou no `SAFE_SAVE_SCREENS`.** Sem isso a tela "Qual ginásio vamos?" não era
  ponto seguro de gravação: a insígnia recém-ganha ficava pendente enquanto o jogador pensava, e
  fechar a aba ali perdia a vitória.
- **A LUPA DA POKÉDEX está nas DUAS telas de escolha de evolução** (a bifurcação e a do Eevee),
  além do encontro selvagem. É a mesma pergunta — "qual dos dois é melhor?" — e nas telas de
  evolução ela pesa mais: ali **a escolha é definitiva**, e a resposta estava a duas telas de
  distância (sair, abrir a Pokédex, achar a espécie, voltar).
  A do Eevee entrou junto de propósito: as duas são a mesma decisão, e deixar só uma com o atalho
  seria a inconsistência que este projeto costuma evitar.
- **A lupa é IRMÃ do card, nunca filha** — `<button>` dentro de `<button>` é HTML inválido: o
  navegador "conserta" fechando o de fora e o clique de dentro se perde, com a tela continuando a
  PARECER certa. É a mesma armadilha do encontro selvagem, e `tools/test-jornada.js` tranca as duas
  telas (conferido que ele falha com a lupa aninhada).
  A moldura é a `.evo-linha`: mesma ideia da `.wild-linha`, com regra própria porque ali o card é o
  `.wild-card` e aqui é um `.btn` comum.
- **O preço, medido a 320px:** a folga de 46px da lupa custa **uma linha a mais em 2 das 5 opções**
  da tela do Eevee ("Manter como Eevee" e "Evoluir para Flareon" passam de 2 pra 3 linhas). As
  outras três já quebravam sem ela — os rótulos são frases, não nomes.
- **Três evoluções agora perguntam pro jogador** (`EVOLUTION_CHOICES`, tela `evoChoice`): Gloom vira
  Vileplume **ou** Bellossom, Poliwhirl vira Poliwrath **ou** Politoed, Slowpoke vira Slowbro **ou**
  Slowking, e o **Tyrogue vira Hitmonlee, Hitmonchan OU Hitmontop** -- o único com TRÊS destinos.
  A tela já montava um botão por destino, então três funcionou sem tratamento especial (só o texto
  passou a contar quantos são). No original quem decide é a pedra, o item de troca ou os atributos
  do bichinho; aqui não há nada disso, então decide o jogador, como já era com o Eevee.
  Efeito colateral conhecido do Tyrogue: `raizDaLinha` passa a tratar Hitmonlee, Hitmonchan e
  Hitmontop como a MESMA linha, então o encontro selvagem não oferece dois deles pro mesmo time --
  a mesma regra que já vale pra Slowbro e Slowking.
  O `tryEvolve` PARA no ponto de bifurcação e marca `pendingEvoChoice` — por isso um Oddish que
  chega ao nível 41 vira Gloom sozinho e só então pergunta. A entrada no `EVOLUTIONS` continua
  apontando pro destino de Kanto: é dela que `finalEvolutionOf` monta time de NPC (rival, Torre),
  onde não há ninguém pra escolher. O jogador nunca passa por ela.
- **A fila da Elite 4 é sorteada, posto a posto**: Lorelei ou Will, Bruno ou Koga, Agatha ou Bruno,
  Lance ou Karen. Cada posto de Johto tem o mesmo número de pokémon e a mesma média de nível do de
  Kanto — a escolha é de tipo, não de dificuldade.
  **Sorteada UMA VEZ e guardada no save** (`game.elitePath`). Refazer a cada tentativa transformaria
  perder-e-voltar num jeito de re-sortear até cair um caminho fácil, e apagaria o que o jogador
  aprendeu sobre a fila dele.
  O Koga aparece na Elite porque é o que acontece no jogo original: ele sai do ginásio de Fuchsia e
  sobe na Gen 2. **O Bruno está nas duas listas** (está nos dois jogos), então o sorteio nunca
  repete adversário: se ele saiu no posto 2 pelo lado de Kanto, o posto 3 fica com a Agatha.
- **Os 100 de Johto ganharam nome de golpe próprio** (`MOVE_OVERRIDES`). Sem isso caíam todos no
  `MOVE_BY_TYPE` e atacavam com o mesmo punhado de nomes genéricos. Pior: **Sombrio e Aço nem
  estavam no `MOVE_BY_TYPE`**, então `nomeDoGolpe` devolvia `null` e a linha do log saía sem golpe
  nenhum — "Umbreon atacou Gengar e tirou −40 de HP". As 250 espécies agora têm nome pra todo tipo
  que conseguem usar.
- **Johto NÃO tem subtipos, e isso foi medido, não esquecido.** As 70 espécies de Kanto com subtipo
  ganham um segundo tipo de ataque (com redutor 0,85) quando ele rende mais. Johto tem zero — mas a
  tipagem dupla nativa dele já compensa: num duelo de times só-Kanto contra só-Johto (evoluções
  finais, nível 70, 1.200 batalhas) **Kanto vence 51,4%**, dentro do ruído. E Johto tem MENOS
  confrontos ruins (12,4% contra 14,7%) e menos casos sem golpe útil (114 contra 195). Dar subtipo
  a Johto seria mexer em balanceamento sem problema medido pra resolver.
- **A ESPÉCIE TEM QUE BATER COM O NÍVEL** (`especieNoNivel`). Um Caterpie nível 17 não existe: aos
  7 ele virou Metapod e aos 10, Butterfree. O encontro sorteia a espécie do pool e o nível do
  TRECHO, e os dois discordavam — foi reportado com um Caterpie Lv.17 e um Weedle Lv.13 na mesma
  tela. A regra é a MESMA do `tryEvolve`, inclusive parando nos pontos de bifurcação (Gloom,
  Poliwhirl, Slowpoke) e no Eevee: escolher por ele ali seria tirar a escolha ANTES da captura.
  Aplicada num lugar só, depois da oferta montada, então pool, raros e pré-evolução de inicial
  passam todos por ela.
  O piso de nível (`EVOLVED_MIN_LEVEL`, que impede uma evolução de aparecer cedo demais) ganhou um
  TETO junto: sem ele o piso empurrava a espécie pra fora da própria janela — um Metapod, que existe
  do 7 ao 9, saía com nível até 10 num trecho de 3-6, e a regra acima o apagava do jogo virando
  Butterfree na hora.
  **O preço, medido: a jornada concluída sobe de 51,7% pra 58,5%** (5.000 jornadas de cada lado,
  6,8σ). É consequência direta e esperada — quem você captura agora é a forma evoluída, com os
  atributos dela, no mesmo nível. Não foi compensado em nada: se incomodar, os lugares de mexer são
  a faixa de nível dos trechos ou o bolo de derrota.
  **Oito espécies só moravam em rota de nível alto demais pra elas** e viraram buraco na Pokédex na
  hora em que a regra entrou (Porygon, Natu, Swinub, Houndour, Tyrogue, Smoochum, Elekid, Magby —
  um Elekid só existia na Usina, nível 50-55, ou seja, sempre Electabuzz). Cada uma ganhou uma casa
  onde cabe: Tyrogue na Rota 22, Smoochum no Monte Lua (que já é a casa dos bebês, com Cleffa e
  Igglybuff), Elekid na Rota 32, Natu na Rota 34, Houndour e Magby nas Rotas 36/37, Swinub nas
  Rotas 38/39 e Porygon na Silph Co. (onde o Porygon2 já morava).
  `tools/test-jornada.js` **passou a considerar o nível** na conta de "todo pokémon tem como ser
  capturado": estar num pool não basta mais — o teste calcula que FORMAS cada entrada consegue
  produzir dentro da faixa do trecho. Sem isso ele daria verde com os oito buracos abertos.
- **TETO DE 4 ROTAS POR LINHA EVOLUTIVA** (09/09/2026). A conta é da LINHA inteira, não da espécie:
  Magikarp em 4 rotas mais Gyarados em 4 davam **8** pra uma linha só, e era isso que enchia os
  times de Gyarados, Crobat e Onix. O pior caso era o **Zubat: 17 entradas** (Zubat 8 + Golbat 7 +
  Crobat 2). Hoje nenhuma linha passa de 4, e a distribuição é **56 espécies em 1 rota, 104 em 2,
  29 em 3 e 3 em 4**.
  **O rebalanceamento foi feito por ferramenta, não à mão** (`tools/rebalancear-rotas.js`): são 32
  pools e a conta é por linha, não por rota. Ela só REMOVE e só ACRESCENTA com afinidade de tipo —
  duas versões anteriores foram descartadas por isto: a que trocava (sai um, entra outro na mesma
  vaga) **oscilava**, 1.584 trocas sem convergir, e a primeira punha **iniciais em rota selvagem**
  (Totodile, Charizard) porque nada a impedia. Hoje ela só considera quem JÁ era selvagem.
  **Custo medido: nenhum.** Conclusão 64,8% → 65,0% (8.000 jornadas de cada lado, 0,3σ). Redistribuir
  não é o mesmo que afrouxar — o que muda é QUEM aparece, não quanto.
  **O que NÃO deu pra cumprir, e por quê:** o pedido também era "quem está em 1 rota vai pra 2".
  **50 espécies continuam em 1**, e é aritmética: uma linha com três formas presentes e teto 4 só
  consegue 2+1+1. São quase todas formas evoluídas (Machamp, Gengar, Kingdra, Tyranitar) — e elas
  continuam alcançáveis evoluindo, que é como o jogo original entrega a maioria delas.
  **E o piso de 12 por pool caiu junto**: os dois não cabem. Com o teto de 4, a média de pool foi
  de 11,8 pra **10,2** (menor 8, maior 17). Onde os dois pedidos colidiram, o teto de 4 ganhou,
  porque é ele que resolve o problema que foi relatado.
- **POOL NÃO É O QUE APARECE NA TELA, e o Covil do Dragão é o caso extremo.** Ele tinha 9
  entradas e entregava **6 formas**: no nível 50-55 o dratini e o dragonair viram os dois
  Dragonite, o magikarp e o gyarados viram os dois Gyarados, e o horsea e o seadra viram os dois
  Kingdra. Reportado em 09/09/2026 ("com apenas 6 espécies é muito pouco").
  Entraram **Lapras, Kabutops, Omastar e Qwilfish** -- os quatro cabem no teto de 4 da linha deles,
  são de Água (o tipo da rota) e combinam com uma caverna alagada e antiga. Agora são **10 formas**
  em 13 entradas. Custo medido: conclusão 64,8% → 65,1% (8.000 jornadas de cada lado, 0,5σ).
  **Quem contar rota por rota, conte FORMAS** -- e desde 15/09/2026 o JOGO conta: a tela
  "Pokémons desta rota" lista as formas, não o pool (ver a seção dela). Ainda ficam abaixo de 10: Dojo Lutador (7), Usina de
  Força (8), Estrada Ciclável (9) e Caminho de Gelo (9) -- as três primeiras pelo mesmo motivo, e o
  Dojo porque a lista de Lutadores do jogo acabou.
- **A OFERTA NÃO REPETE MAIS UMA LINHA QUE O TIME JÁ TEM — nem pela reserva.** Eram dois furos:
  o `semLinhaRepetida` escolhia o substituto olhando só pra oferta, e a reserva do
  `buildOfferFromPool` completava a oferta INTEIRA ignorando o time. Medido em jornada real:
  **2 ofertas em 5.009** traziam um repetido. Hoje o substituto olha o time e a reserva só entra
  abaixo de `MIN_OFERTA_SEM_REPETIR` (**3**) cards — resultado: **0 em 9.703**.
  O 3 não é gosto: com 2, o `tools/test-jornada.js` falhava no pior caso que ele já cobrava (time
  montado só com bichos da própria rota, 384 combinações) — 26 delas caíam pra duas opções. Na
  jornada real a diferença entre 2 e 3 é zero.
- **DEZ ROTAS GANHARAM POOL MAIOR (mínimo 12), e o preço foi medido: −4,5 pontos de conclusão.**
  Pedido em 08/09/2026, com o critério de que cada acréscimo tivesse relação com o TIPO da rota ou
  com a lore. Floresta Ilex (+Farfetch'd, o da missão do carvoeiro no Gold/Silver), Túnel de Pedra,
  Ilhas Redemoinho (+Mantine, que é Água/Voador — os dois tipos da rota — e o Remoraid, parceiro
  dele no original), Dojo Lutador, Farol de Olivine (+Chinchou, que vira **Lanturn**, o
  peixe-lanterna), Monte Mortar, Lago da Fúria, Usina de Força, Caminho de Gelo e Covil do Dragão.
  **O custo é grande e não é ruído: 69,4% → 64,9% de conclusão** (8.000 jornadas de cada lado,
  6,1σ), e ele é TODO da diluição — os três cortes pedidos junto (ver abaixo) valem +0,6, dentro do
  ruído. Quatro cartas sorteadas de um pool de 12 acham uma espécie específica muito menos que de
  um pool de 8.
  **E ele se concentra no ÚLTIMO ginásio**: os game overs no 8º vão de **267 para ~420** em 4.000
  jornadas, contra ±4 em todos os outros. Faz sentido — três das dez rotas são da etapa 8 (Usina,
  Caminho de Gelo, Covil do Dragão), que é a última captura antes do Giovanni/Clair: diluir ali é
  reduzir a chance de sacar o finalizador (Dragonite, Kingdra, Tyranitar).
  **A saída medida, se um dia incomodar, é a 5ª carta na etapa 8** (`offerCount` do `LEGS[7]`):
  ela devolve metade — game overs no 8º de 398 pra **334**, conclusão de 65,5% pra 66,5%. Não foi
  aplicada porque não foi pedida.
  **Cuidado ao contar: pool não é o que aparece na tela.** A regra de espécie-por-nível junta
  entradas diferentes na mesma forma — o Covil do Dragão tem **12 no pool e 9 formas distintas**
  (dratini e dragonair dão Dragonair, magikarp e gyarados dão Gyarados, horsea e seadra dão
  Kingdra). Dojo e Caminho de Gelo ficam em 10, a Usina em 11. Subir isso significa acrescentar
  ainda mais nas rotas da etapa 8, que é exatamente onde a medição diz que dói.
  **O Mareep ficou de fora do Farol de Olivine de propósito**: no nível 30 ele já sai Ampharos, e o
  Ampharos é o raro de 10% daquela rota — pô-lo no pool esvaziaria o prêmio dela.
- **O Monte Lua ficou só com os bebês** (Cleffa, Igglybuff, Smoochum): a Clefairy e a Jigglypuff
  adultas saíam ao lado dos próprios bebês. As duas evoluem no nível 20, acima da faixa da etapa 2,
  então quem as quer sobe o bebê. A Estrada Ciclável perdeu o raro Muk no mesmo pedido.
- **⚠️ O DUGTRIO SAIU DAS DUAS ROTAS EM QUE APARECIA (11/09/2026, a pedido), e a causa é o PISO.**
  Reportado como *"tire o dugtrio level 28 que aparece nas rotas iniciais"*. Medido, ele saía em
  duas, e as duas estavam erradas pelo mesmo motivo:

  | rota | faixa da rota | o Dugtrio saía em |
  |---|---|---|
  | **Caverna Escura** (Johto, trecho 1) — no pool | 3–6 | **Lv.26–29** |
  | **Caverna Diglett** (Kanto, trecho 3) — era o RARO | 13–17 | **Lv.26–30** |

  O `EVOLVED_MIN_LEVEL` não deixa uma forma evoluída sair abaixo do nível em que ela existiria, e o
  Diglett só evolui no **26** — então o piso empurrava a faixa inteira pra cima, como já tinha feito
  com o Pikachu antes do `SEM_PISO_DE_NIVEL`. **Não dava pra consertar o nível**: abaixo do 26 o
  Dugtrio não existe. E pôr ele no `SEM_PISO_DE_NIVEL` seria errado — aquela lista é curta de
  propósito, só entra quem é a forma COMUM da linha e ganhou um bebê depois.
- **⚠️ CONSEQUÊNCIA: o Dugtrio deixou de existir como SELVAGEM, e só se consegue evoluindo Diglett.**
  Ele continua no `WILD_POOL_LEG6`, mas isso **não é uma porta**: conferido, **todas as 32 rotas têm
  pool próprio**, então os `WILD_POOL_LEG*` nunca são usados no encontro — eles são fallback de uma
  rota sem pool, e não existe nenhuma. A entrada dele lá é letra morta.
  Isso é consistente com o resto do jogo (50 espécies estão em 1 rota só, e as formas evoluídas
  como Machamp, Gengar e Kingdra já são alcançadas evoluindo), e o teste de "todo pokémon tem como
  ser capturado" continua verde porque ele calcula o fecho das evoluções.
  Se um dia se quiser ele selvagem de novo, o lugar certo é uma rota de trecho **6 ou mais** (28-33
  pra cima), onde o Lv.26 do piso cabe.
- **A CAVERNA DIGLETT FICOU SEM RARO**, e isso é estado suportado: já havia três rotas assim
  (Estrada Ciclável, Ilhas Redemoinho e Dojo Lutador), e o `montaOfertaSelvagem` guarda
  `route.rare && route.rare.length`. O rumor dela continua verdadeiro sem ele — **o counter do
  Surge é o Diglett**, que está no pool. As duas rotas seguem entregando **9 formas distintas** cada
  (eram 10).
- **`SEM_PISO_DE_NIVEL`: quem pode aparecer abaixo do piso da própria evolução.** O piso
  (`EVOLVED_MIN_LEVEL`) é montado a partir do `EVOLUTIONS`, e a Gen 2 acrescentou BEBÊS a linhas
  que já existiam — o Pikachu virou "evolução do Pichu" dez anos depois de ser um pokémon de nível
  3 na Floresta de Viridian do jogo original. O piso então empurrava o raro dessas rotas pra 17
  níveis acima de tudo em volta: **Pikachu Lv.20–23 numa rota de 3 a 6**. Hoje o Pikachu (Floresta
  de Viridian, Rotas 24/25) e o Quagsire (Rota 32) saem na faixa da própria rota.
  A lista é curta de propósito: só entra quem é a forma COMUM da linha e ganhou um bebê depois.
- **O NÍVEL PODE SER DA ROTA, não da etapa** (`niveis` na entrada da rota, lido pelo
  `nivelSelvagem`). Era um `id === 'eevee' ? 45` repetido em dois pontos da montagem da oferta, e
  ele valia em QUALQUER rota — pôr um Eevee na Rota 34, que é de nível 13 a 17, daria um Eevee
  **nível 45** ali. Hoje: **30–35 na Silph Co.**, **45 na Mansão** (como sempre foi) e a faixa da
  etapa em qualquer outra rota, como todo mundo. O Eevee da Rota 34 entrou nesse pedido.
  Sobrou um `eevee ? 45` no fallback de oferta gravada ANTES de o nível existir no save
  (`confirmWild`): é código de dado antigo e não vale a pena mexer.
- **O tipo da rota PESA no sorteio do encontro** (`PESO_DO_TIPO_DA_ROTA = 2`): quem é do tipo dela
  entra com o dobro de peso no embaralhamento. É o que faz a rota fantasma parecer uma rota
  fantasma — medido no Desvio por Lavender (Fantasma/Terra, 3 do tipo num pool de 9): a oferta
  trazia **1,00** do tipo e em **23,5%** das vezes nenhum; agora são **1,42** e **9,3%**.
  Dobro de peso NÃO é dobro de chance: o sorteio é sem reposição e a oferta tem 3 vagas, então na
  média das 32 rotas a fatia do tipo vai de **68,8% pra 77,8%** da oferta. Rota que já é quase toda
  do próprio tipo (Seafoam, Lago da Fúria) não muda — não há do que tirar.
  **O preço foi medido e é real, não ruído:** a jornada concluída cai de **56,4% pra 54,0%**
  (5.800 jornadas de cada lado, 2,6σ). A causa é o time ficar menos variado em tipo, e são 8
  ginásios de tipos diferentes. Baixar o peso pra 1,5 **não devolve** isso (54,5%, dentro do ruído
  contra 54,0%): o custo vem de EXISTIR o viés, não do tamanho dele — por isso ficou em 2, que é
  onde o efeito se vê.
  Ninguém some da rota: a menor chance entre as 156 espécies em rota vai de 13,8% pra 10,1%, e o
  caso extremo é o Porygon (só mora na Usina, Elétrico): 29,9% → 16,5% por oferta.
  O sorteio com peso é o de Efraimidis-Spirakis (chave = `U^(1/peso)`, maior primeiro) — com peso 1
  pra todo mundo ele É um embaralhamento uniforme, então rota sem tipo declarado continua idêntica,
  e a semente anti-artimanha continua devolvendo a MESMA oferta (conferido).
- **A oferta traz QUATRO selvagens, não três** (`offerCount`, 02/09/2026). O jogador continua
  escolhendo até 2 — o que cresce é a ESCOLHA, não o time.
  **É a maior mexida de dificuldade desde os golpes especiais: a jornada concluída sobe de 60,51%
  pra 65,20%** (20.000 jornadas de cada lado, **9,7σ** — não é ruído).
  E ela não cai onde se imaginaria: **a peneira do Brock não se move** (1.381 contra 1.401 game
  overs em 6.000 jornadas), porque no primeiro ginásio o time ainda é o inicial mais um encontro e
  uma carta a mais não salva ninguém. Quem afrouxa é o FIM — **Giovanni vai de 615 pra 395** game
  overs, Koga de 199 pra 178. Faz sentido: escolher os 2 melhores entre 4 rende mais quanto mais
  tempo o time tem pra compor. Não foi compensado em nada; se incomodar, os lugares de mexer são a
  faixa de nível dos trechos e o bolo de derrota — os mesmos da regra de espécie-por-nível.
  O resto ficou parado, conferido nas 32 rotas: **nenhuma oferta fica curta** nem no pior caso
  (time com seis linhas da própria rota), os **lendários seguem a 5%** por encontro e a fatia do
  tipo da rota quase não se move (77,3% → 76,3%). O que sobe é a chance de cada espécie aparecer —
  o Porygon, que só mora na Usina, vai de 12,9% pra **16,3%** por oferta.
  Em 320px o quarto card não aperta nada (a lista é uma coluna, um card por linha): conferido no
  navegador, sem quebra de nome e sem rolagem horizontal, a página vai de ~963 pra 1.062px.
  O número vive **por etapa** no `LEGS`, e não numa constante: cada trecho já tem faixa de nível
  própria, então é ali que se mexeria se um dia um trecho precisasse de oferta maior que os outros.
- **A oferta nunca traz duas entradas da MESMA LINHA** (`semLinhaRepetida`, conferido no fim, depois
  de todo mundo passar). O `buildOfferFromPool` já cuidava disso no que ELE sorteia — o furo era
  quem entra DEPOIS dele: o **raro da rota**, a pré-evolução de inicial e a rede dos intocáveis
  reivindicam a vaga sem olhar pro resto. No Covil do Dragão (Kingdra e Dragonite como raros,
  Seadra e Dragonair no pool) um Seadra Lv.51 virava Kingdra pela regra de espécie-por-nível e a
  tela mostrava **dois Kingdra** — e, como `game.wildSelected` guarda o **id da espécie**, clicar
  num marcava os dois. Reportado em 01/09/2026.
  Medido antes do conserto: **8,2% das ofertas do Covil do Dragão**, 0,88% do jogo, em 9 rotas
  (Desvio por Lavender 3,4%, Rota 32 3,3%, Lago da Fúria 3,1%, Mansão 2,8%, Caverna Diglett 2,2%,
  Túnel de Pedra 2,1%, Estrada Ciclável 2,0%, Victory Road 1,1%).
  **Sai a entrada mais à direita, e não importa se é a comum ou a rara**: o que o raro promete é um
  Kingdra NA TELA, e com a repetida trocada o jogador continua vendo exatamente um — medido,
  71,5% → 72,2% de ofertas com Kingdra no Covil. Só sorteia quando ACHA repetida, então as ofertas
  que já estavam certas continuam idênticas semente por semente (a trava anti save-scumming
  continua valendo: `tools/test-jornada.js` confere as duas coisas em todas as 32 rotas).
  **A seleção por espécie continua como está** — ela funciona porque a oferta não repete linha. Se
  um dia alguém precisar mexer nisso, o campo é serializado (`wildSelected` está no save), então
  trocar pra índice quebra quem estiver com a tela do encontro aberta na hora do deploy.
- **O encontro selvagem nunca oferece uma linha que o time já tem.** Não é por espécie, é pela
  **raiz da linha evolutiva** — dois Magikarp viram dois Gyarados, e era assim que gente chegava na
  liga com o time duplicado. Um Gyarados no time também bloqueia o Magikarp.
  `raizDaLinha()` sobe até o começo da linha considerando o `EVOLUTIONS` **e** o
  `EVOLUTION_CHOICES`: sem a segunda parte, Slowbro e Slowking seriam linhas diferentes (têm finais
  diferentes) e o jogador ficaria com os dois. O mapa é montado uma vez e guardado — são 250
  espécies e isso roda a cada encontro.
  Tem **reserva**: se o filtro deixar a oferta curta (pool pequeno, time cheio de linhas dali), ela
  é completada ignorando o time. Uma tela de encontro com uma opção só é pior que oferecer um
  repetido. Medido no pior caso (time montado só com bichos da própria rota, 384 combinações):
  **nenhuma oferta ficou com menos de 3**.
- **O Pichu é o sétimo inicial**, fora do triângulo planta/fogo/água — o "de fora", como o Pikachu
  no Yellow. É o único que já nasce com evolução pra frente (Pichu → Pikachu → Raichu): começa mais
  fraco e cresce mais. O rival responde com o Totodile, o único dos outros que resiste a Elétrico.
- **O mapa passou a desenhar Kanto E Johto**, empilhadas: Kanto em cima (coordenadas intocadas) e
  Johto embaixo, deslocada em `JOHTO_OFFSET_Y`. **Por que empilhado e não lado a lado**, já que
  Johto fica a oeste: o jogo é jogado em retrato num celular. Lado a lado o viewBox iria a 620 de
  largura e, numa tela de 320, cada cidade e cada nome sairiam pela metade do tamanho. Empilhado, a
  largura continua 300 e cada região tem a mesma área que tinha sozinha. A silhueta já era
  assumidamente uma evocação e não o contorno exato; a posição relativa segue a mesma licença.
- **Nada na tela nomeia o líder de uma etapa antes da escolha.**  existe
  pra isso:  devolve 'kanto' como padrão (é o que mantém save antigo funcionando),
  então quem exibe precisa perguntar ANTES. Sem isso a abertura da jornada anunciava o líder de
  Kanto e o mapa já traçava a linha até a cidade dele — na tela ANTERIOR à da escolha, que virava
  encenação. Hoje a trilha mostra  e "escolha o caminho", o mapa não desenha trecho nem
  aponta cidade, e a tela do mapa diz os dois destinos possíveis.
  Cuidado ao comentar esse trecho: o comentário vai junto no HTML da página, então citar nome de
  líder ali faz um teste que procura nome de líder na tela acusar o próprio comentário.
- **Nada na tela nomeia o líder de uma etapa antes da escolha.** `etapaEscolhida(i)` existe pra
  isso: `regiaoDaEtapa` devolve `'kanto'` como padrão (é o que mantém save antigo funcionando),
  então quem exibe precisa perguntar ANTES. Sem isso a abertura da jornada anunciava o líder de
  Kanto e o mapa já traçava a linha até a cidade dele — na tela ANTERIOR à da escolha, que virava
  encenação. Hoje a trilha mostra `?` e "escolha o caminho", o mapa não desenha trecho nem aponta
  cidade, e a tela do mapa diz os dois destinos possíveis do trecho.
  Cuidado ao comentar esse trecho: o comentário vai junto no HTML da página, então citar nome de
  líder ali faz um teste que procura nome de líder na tela acusar o próprio comentário.
- **O traço segue as cidades que o treinador escolheu** (`jornadaDoTreinador()` lê o `gymPath`), e
  não uma jornada de Kanto que ele não fez. Quando a jornada troca de região, a linha atravessa de
  um continente pro outro — o zigue-zague É a jornada. As cidades não escolhidas continuam
  desenhadas, apagadas: um mapa que só mostra o caminho tomado esconde que havia outro.
  Cada ponto pinta a insígnia do PRÓPRIO ginásio, então nunca aparece Pewter City com a cor de uma
  insígnia de Johto (foi um defeito real, pego na revisão anterior).
  A ponte entre as duas — Rotas 26/27 e as Quedas Tohjo no original — fica sempre visível,
  pontilhada, pra explicar por que a jornada consegue pular de um continente pro outro.

### "POKÉMONS DESTA ROTA" (15/09/2026)

Pedido com print, apontando o espaço em branco no topo da caixa dos selvagens: *"crie um botão com
o texto 'Pokémons desta rota' e quando clicado, abre um modal exibindo todos os pokemons
disponiveis de capturar nessa rota. E para os pokemons que o treinador ja capturou, coloque aquele
símbolo de pokedex que ja existe hoje"*.

- **⚠️ A LISTA É DE FORMAS, NÃO DO POOL — e é essa a parte que a intuição erra.** Este arquivo já
  registrava a armadilha (*"POOL NÃO É O QUE APARECE NA TELA... conte FORMAS"*): a regra de
  espécie-por-nível converte a entrada do pool na forma que existe naquele nível, então **uma
  entrada entrega formas diferentes** conforme o sorteio e **duas entradas entregam a mesma forma**.
  O Covil do Dragão é o caso extremo: **15 entradas → 10 formas** (dratini e dragonair viram os dois
  Dragonair, magikarp e gyarados viram os dois Gyarados, horsea e seadra viram os dois Kingdra).
  Listar o pool cru mostraria nomes que o jogador **nunca** vai ver ali.
- **⚠️ A FAIXA DE NÍVEL PASSOU A MORAR NUM LUGAR SÓ** (`faixaDeNivelSelvagem`), e foi essa a única
  mudança em código de motor: quem SORTEIA (`rollWildLevel`/`nivelSelvagem`) e quem LISTA leem a
  mesma função. Duas cópias divergiriam no primeiro ajuste, e o sintoma seria o pior possível — a
  tela prometendo uma forma que o sorteio nunca entrega, ou escondendo uma que ele entrega.
  São três degraus: a faixa **própria da rota** (`route.niveis`, o Eevee 30-35 na Silph Co.), o
  **piso da evolução** (com o teto que impede o Metapod de sair no nível em que já seria Butterfree)
  e a faixa do **trecho**. **Conferido por impressão: o sorteio não mudou** — mesmo hash em 6.000
  sorteios semeados.
- **⚠️ E A VARREDURA ACHOU UMA FALTA DE VERDADE: a PRÉ-EVOLUÇÃO DE OUTRO INICIAL** (15% no trecho 5)
  **não está em pool nenhum** — ela é um sorteio à parte dentro do `montaOfertaSelvagem`. A Estrada
  Ciclável entregava Charmeleon, Ivysaur, Wartortle, Quilava, Bayleef, Croconaw e Pikachu que a
  primeira versão da lista não mostrava. Ela **respeita o inicial do jogador**: o sorteio nunca dá a
  evolução do próprio, e a lista também não.
- **⚠️ O DITTO DISFARÇADO FICA DE FORA, e é decisão.** Medido nas 32 rotas: onde ele é capturável de
  verdade — o **raro** da Silph Co., da Mansão e da Rota 34 — ele já entra e aparece. Nas **outras
  sete** (Seafoam, Usina, Victory Road, Monte Mortar, Lago da Fúria, Caminho de Gelo e Covil do
  Dragão) ele só existe como o disfarce de "Mew"/"Mewtwo", e ali listá-lo seria **a única tela do
  jogo que dedura a pegadinha** — a lupa do encontro já é escondida no disfarçado pelo mesmo motivo.
  E o erro seria duplo: a tela prometeria um "Ditto" que o jogador procuraria na oferta e nunca
  acharia, porque ali ele se chama Mew.
- **Os INTOCÁVEIS ficam de fora** pelo mesmo raciocínio: eles não estão em pool nenhum, mas o
  encontro tem uma rede de segurança que os troca — anunciá-los prometeria uma captura que não
  acontece.
- **A LINHA INTEIRA É O BOTÃO** e abre a **mesma ficha da Pokédex** que a lupa do encontro abre: a
  pergunta que se faz aqui é a mesma (*"esse cobre o tipo que falta no meu time?"*). É a regra da
  ficha do especial e da lista de notificações — mirar num quadradinho num celular é pedir erro.
- **⚠️ O CONTADOR E O NOME DA ROTA SAÍRAM EM 16/09/2026** (a pedido: *"tire os textos em azul"*).
  Eram as duas linhas azuis acima da lista, e juntas ocupavam 4 linhas de texto.
  O contador (*"12 pokémons aparecem aqui — 3 ainda faltam na sua Pokédex"*) estava registrado aqui
  como **"a razão de a tela existir"** — ele respondia *"vale a pena parar aqui?"* antes de o
  jogador ler a lista inteira. **Quem responde isso agora é a própria lista**, pelo selo da Pokédex
  e pela faixa verde de cada linha: a informação continua ali, só deixou de vir somada.
  O **nome da rota** era a informação mais redundante possível: este modal só abre **de dentro da
  tela daquela rota**.
  Há trava pros dois, pra a volta deles ser decisão e não descuido.

**A TRAVA QUE IMPORTA compara a lista com o que o encontro REALMENTE entrega:** ela roda **250
ofertas de verdade em cada uma das 32 rotas** e exige que nada saia fora da lista. Foi ela que pegou
a pré-evolução de inicial — nenhuma leitura do código teria pego, porque o sorteio dela mora longe
do pool.

### ⚠️ ELA VIROU LISTA, E O NÍVEL SAIU (16/09/2026)

Pedido junto com as linhas azuis: *"tire o Lvl 3-6 que aparece dentro dos cards, e diminua a altura
de cada card, para ficar parecendo mais uma lista"*.

- **O NÍVEL SAIU, e a razão estava na própria tela:** dentro de uma rota quase toda forma cai na
  **MESMA faixa**, então eram doze linhas escrevendo *"Lv.3–6"*. Ele era o que obrigava o nome a
  dividir a linha de cima — e é o que o layout de três tentativas (registrado abaixo como história)
  existia pra acomodar.
- **QUEM MANDA NA ALTURA É O SPRITE, não o texto** — e isso é o contra-intuitivo daqui. Baixar só o
  padding não faria nada: o sprite de 48px segurava a linha sozinho. Ele foi pra **34px**, que é a
  MESMA medida que o montador de time e a lista da Torre já usam (não é um número novo), e o padding
  vertical de 5 pra 2. **O card foi de 62px para 42px** e o conteúdo de uma rota de 14 formas, de
  1.038 para 842px.
- **⚠️ E O NOME CONTINUA EMPILHADO SOBRE OS TIPOS, o que NÃO custa altura:** as duas linhas de texto
  (14 + 2 + 12 = 28px) cabem **dentro** da altura que o sprite já impõe. Numa linha só o nome ficava
  com o que sobrasse dos selos — a 320px sobram **47px** quando a espécie tem dois tipos, e aí **8
  dos 14 nomes truncavam**, "Pidgey" e "Oddish" inclusive. Empilhado ele fica com os 116px inteiros
  e **nenhum trunca**.

**⚠️ E DOIS DEFEITOS PASSARAM POR UMA MEDIÇÃO SEM ACUSAR NADA. A marcação estava certa nas duas
vezes — o errado era a folha de estilo, e é por isso que as travas novas LEEM O CSS.**

1. **O sprite não encolheu**, porque `.rota-mon .sprite-img` tem a **MESMA especificidade** que o
   `.sprite-sm .sprite-img` da casa — e aquele é declarado **depois**, então ganhava o empate.
   O seletor foi a **três classes** (`.rota-mon .sprite-sm .sprite-img`), que vence independente da
   ordem. Nenhuma assertiva de HTML teria percebido: o card simplesmente não mudava de altura.
2. **⚠️ O NOME SUMIU DA TELA**, e este é o que vale guardar. O `flex:1 1 0` é do **EIXO do
   container**: com o `.rota-mon-info` virando COLUNA, base 0 passou a zerar a **ALTURA** do nome.
   Os selos de tipo continuavam aparecendo, então a lista parecia certa de relance.
   **E ele escapou de uma medição de verdade:** eu media `scrollWidth > clientWidth` pra achar nome
   truncado, e a LARGURA estava certa — 130px. O que estava zerado era a altura.
   **Medir a dimensão errada dá verde num defeito que se vê no primeiro print.**

**Medido a 320px depois de tudo, na Floresta de Viridian (14 formas):** card de **42px** uniforme,
**zero** nomes truncados, **zero** listas de tipo em duas linhas, sem rolagem lateral, e o modal
rolando por dentro (`max-height:85vh`) como a lista de golpes da ficha e o ranking da Torre.

**HISTÓRIA — o layout de quando o nível existia**, que custou três tentativas e fica registrado
porque a conta de largura continua valendo (o card mede só 208px a 320px):
  1. **nome e nível no mesmo span**: o `ellipsis` comia o NÍVEL — *"Gyarados Lv.50…"*, em 4 das 10
     linhas do Covil;
  2. **nível na linha dos tipos**: ele empurrava o segundo selo pra uma segunda linha, em **9 das
     10**;
  3. **nível numa coluna própria à direita**: a coluna roubava 50px e os tipos quebravam de novo.

## Equipe Rocket

### O CANTO DA JIGGLYPUFF ACONTECE NA TELA DE BATALHA (13/09/2026)

Pedido assim: *"hoje a tela troca diretamente para o log falando que a jigglypuff cantou e um
pokemon foi roubado, vamos melhorar porque ta confuso, deve aparecer a luta normal, e ai aparece a
mensagem durante a luta ... e fica essa frase na tela de batalha durante 5s, e só depois troca para
como é hoje"*.

- **A EMBOSCADA VIROU UMA FASE DA REVELAÇÃO** (`specialRevealPhase === 'rocketSleep'`), e não mais
  uma troca de tela. O confronto contra a cantora **entra em cena como qualquer outro** — os dois
  sprites, as duas barras e o placar de quantos estão de pé —, e a frase ocupa a linha onde os
  golpes são narrados. É o mesmo desenho das passivas: **o que acontece é contado ONDE acontece**.
  Antes o jogador via a luta e, sem transição nenhuma, uma tela dizendo que tinha perdido um
  pokémon.
- **SÃO 5 SEGUNDOS** (`ROCKET_SLEEP_AVISO_MS`), contra o 1,5s de uma passiva comum, e é de
  propósito: aqui **não há barra andando** pra dar o tempo de leitura — a frase É o evento inteiro,
  e ela carrega duas informações (todo mundo dormiu E estão roubando alguém).
- **AS BARRAS FICAM NO VALOR DE ENTRADA e ninguém aparece nocauteado**: ninguém apanhou, todo mundo
  dormiu. O placar (`3/3`) usa o número de ANTES pelo mesmo motivo. O que veio antes continua na
  tela e no log — o confronto que o jogador acabou de ver contra o outro pokémon da Rocket é real, e
  é ele que explica o Venusaur entrando machucado.
- **⚠️ O PASSO E O ÚLTIMO GOLPE SÃO ZERADOS JUNTOS.** O `specialLastHit` guarda o passo animado do
  confronto ANTERIOR, e a fase nova desenha o quadro do lutador — sem zerar os dois, ele sairia
  anunciando um golpe que ninguém deu. É o **golpe fantasma de 09/09/2026 entrando por uma porta
  nova**, e foi o teste que cobrou (ele conta `HitStep = 0` contra `LastHit = null`).
- **A FRASE VIVE NUMA FUNÇÃO SÓ** (`fraseDoCantoDaRocket`), lida pela tela de BATALHA e pela do
  RESULTADO. Montadas em separado divergiriam no primeiro ajuste de texto — é o que já aconteceu
  entre o log e a animação mais de uma vez neste projeto.
- **⚠️ E O NOME SAI DO CONFRONTO, não é "Jigglypuff" escrito à mão.** Quem canta pode ser uma
  **Wigglytuff** — as duas estão no `ROCKET_POOL` e as duas disparam a emboscada —, e a tela dizia
  Jigglypuff nos dois casos. Foi consertado junto porque é a MESMA frase que o pedido mudou.
- **O `cutIndex` continua sendo o `specialRevealIndex`**, e nada na fase nova encosta nele: é ele
  que o `triggerRocketSleepAmbush` usa pra cortar a luta. **Quem cantou se guarda ANTES do corte** —
  o confronto contra ela sai do `r.matchups` na linha seguinte, e é dele que sai o nome.
- **Se o jogador sair da tela nos 5 segundos** (um convite online aceito, por exemplo), a emboscada
  não acontece por cima do que ele foi fazer: o timer confere a tela e a fase antes de disparar.
- **Medido a 320px, no navegador:** a cena inteira fica em 399px, a frase em 4 linhas (58px), sem
  rolagem lateral.
- **O sandbox dos testes passou a ANOTAR o prazo de cada `setTimeout`** (`__timers`) — ele continua
  não rodando nenhum (as suítes dirigem os laços na mão), e é assim que dá pra cobrar "essa cena
  dura 5s" sem relógio.
- `tools/test-jornada.js` tranca a cena inteira com o sorteio da emboscada FORÇADO (a chance real é
  10%, e esperar por ela deixaria o teste dependendo de sorte de semente): que não troca de tela na
  hora, a frase palavra por palavra, os dois lutadores e as duas barras ainda desenhados, o placar
  de antes, o passo e o último golpe zerados, os 5s, a mesma frase na tela do resultado, o shiny
  sendo o roubado, e a Wigglytuff cantando com o nome dela. Conferido que ele acusa **11 falhas**
  com a troca de tela imediata de volta.

- **O resgate com o time cheio virava um LAÇO SEM FIM.** Se a Rocket rouba um pokémon, o treinador
  enche o time até 6 e só então vence o esconderijo, o resgatado não cabia — e voltava pro
  `stolenMon` "esperando uma vaga". Só que `stolenMon` pendente é justamente o que reabre o
  esconderijo (ver `proceedToGymApproach`): o jogador vencia a Rocket, não recebia o pokémon, e
  podia desafiar de novo, pra sempre. Reportado em 01/09/2026.
  Hoje ele espera num campo próprio (`resgatadoSemVaga`) e entra na hora de abrir a tela do **Prof.
  Carvalho** — a MESMA do encontro selvagem com o time cheio.
  **Por que um campo próprio e não empurrar direto pro time:** `specialResult` é ponto seguro de
  gravação, então um time de 7 seria GRAVADO ali. O smoke pegou isso na hora — ele tranca "time > 6
  fora da tela de release".
  `game.releaseDepois` diz pra onde voltar depois do Prof. Carvalho: o encontro selvagem segue pro
  Eevee/distribuição, o resgate segue pra chegada no ginásio. Ele é gravado no save porque
  'release' também é ponto seguro — fechar a aba ali não pode perder o caminho de volta.

## ⚠️ A LOJA, A MOCHILA, OS TMs E OS HMs MORAM EM `docs/economia.md`

**LEIA ESSE ARQUIVO ANTES DE MEXER EM ITEM, PREÇO, MOEDA, TM, HM OU NAS TELAS DA LOJA E DA
MOCHILA.** É o registro do que cada item custa e do que ele VALE — medido em pontos de taxa de
vitória —, e das travas que impedem o cliente de se pagar sozinho.

⚠️ **E ELE ALCANÇA COISA QUE NÃO PARECE "loja":** o item equipado entra no **motor** (o
`equiparItens` tem que ser chamado perto de toda batalha, e há trava lendo o código), os HMs
destravam **rotas da jornada**, os TMs mexem na **tabela de golpes** e no **pool do Metrônomo**, e o
re-sorteio pago mexe na **semente anti save-scumming** do encontro selvagem.

**O que está lá:** os **11 itens** e o que cada um vale medido, os **23 TMs** e os **3 HMs** (com a
condição de cada um e quem aprende), a **loja** e a **mochila** por dentro, o **re-sorteio pago**,
de onde vem **moeda** e o que ela compra, e o **aposentar o time**.

**⚠️ E ESTES SÍMBOLOS SÓ SÃO EXPLICADOS LÁ** — um `grep` que caia aqui e não ache nada tem que
ir pro capítulo, e é essa lista que faz o gatilho valer quando o assunto não é óbvio:

`doExchange` · `equiparItens` · `raizDaLinha` · `GOLPES` · `firestore.rules` · `rareCandies` · `GOLPES_IDS` · `finishBattle` · `melhorAtaque` · `p.item` · `index.html` · `tentarGolpeEspecial` · `wildRerolls` · `CAMPOS_DA_CONTA` · `game.team` · `EVOLUTION_CHOICES` · `formaNoNivel` · `A_MAO` · `APRENDIZADO` · `POOL_METRONOMO` · `calcDamage` · `cartaoDeGolpe` · `slotDaConta` · `calcMaxHp` · `pausaDaFaixa` · `simulateGymBattle` · `claimJourneyCoins` · `ganhouHmAgora` · `RECUPERACAO` · `Math.random` · `arrayUnion` · `consumeEquipped` · `quantoTenho` · `useRareCandy`

*(10 seções, 59 subseções, 242 KB — saíram daqui em 25/09/2026 porque o CLAUDE.md é lido
INTEIRO em toda sessão, e ele tinha chegado a 1.360 KB.)*

## O Prof. Carvalho aceita qualquer um, nos dois modos

- Time cheio + um selvagem novo obriga a mandar um embora, e **quem vai é escolha do jogador, sem
  régua** — no normal e no difícil.
- **Houve uma trava de 10 níveis no difícil** (`DIFERENCA_RELEASE_DIFICIL`, 03/09/2026): só dava pra
  dispensar quem estava perto do nível de quem tinha acabado de chegar, pra a troca não virar
  upgrade de graça (captura um selvagem forte, manda embora o coitado de nível 12). **Saiu a pedido
  no mesmo dia em que entrou.** O efeito medido nunca chegou a ser levantado; o que se sabe é o
  desenho: ela mordia justamente o time atrasado, que é quem mais precisa da troca.
- **Se um dia voltar, a VÁLVULA volta junto.** Se NINGUÉM do time passasse na régua ela não valia —
  senão o jogador ficava com 7 pokémon e sem saída, porque esta tela não tem como ser pulada.
  Acontecia de verdade: um lendário chega 12 níveis acima do teto do trecho, e num time atrasado
  todos ficariam travados. `tools/test-jornada.js` guarda esse caso (lendário Lv.50 num time de ~21)
  justamente pra uma volta sem válvula falhar em vez de travar o jogo em produção.
- **A regra viveria no `toggleRelease`, não só na tela.** O card apagado é a apresentação; a função é
  quem tem que recusar, pra valer se alguém a chamar por fora.

## +2 NÍVEIS NOS LÍDERES, DO 3º GINÁSIO EM DIANTE (13/09/2026)

Pedido em duas etapas. Primeiro *"aumente 2 level de cada pokemon de cada lider de ginasio"*; com a
medição na mão, *"deixa +2 só a partir do 3º ginásio então"*. São **60 pokémon** (30 em Kanto, 30 em
Johto); o 1º e o 2º de cada região voltaram ao nível original. As tabelas
(`KANTO_GYMS`/`JOHTO_GYMS`) vivem **só no cliente**, então é um lugar só.

**O PREÇO MEDIDO: a jornada concluída cai de 66,88% para 55,47% — −11,42 pontos, 18,0σ**, 8 blocos
de 1.500 jornadas de cada lado (**12.000 de cada**), desvio tirado de ENTRE os blocos, **8 de 8
blocos apontando pro mesmo lado**.

**⚠️ E A FORMA É O PONTO DA DECISÃO: o 1º ginásio NÃO SE MOVE.**

| ginásio | +2 em TODOS | +2 do 3º em diante |
|---|---|---|
| conclusão da jornada | 52,46% (**−15,31**) | **55,47% (−11,42)** |
| **1º** (a peneira) | 999 → 1.665 (**+67%**) | 1.098 → 1.090 (**parado**) |
| 5º | +30% | 550 → 825 (+50%) |
| 6º | +51% | 666 → 939 (+41%) |
| 8º | +39% | 1.641 → 2.438 (+49%) |

Poupar os dois primeiros devolve **3,9 pontos** de conclusão e, principalmente, **tira o aperto de
onde a jornada já morre mais**: no 1º ginásio o time é o inicial mais um ou dois encontros, e +2
níveis num time de três no nível 17-20 pesam muito mais que +2 num time de seis no nível 60.

- **⚠️ A MEDIÇÃO POR PAINEL FIXO NÃO SERVE AQUI, e quase enganou:** um time padrão de nível fixo
  contra cada líder satura em 100% em quase todos, e só a Sabrina mostrava queda (55,5% → 11,0%).
  O número honesto é o da JORNADA, que joga o time que o jogador realmente tem em cada altura. É a
  mesma lição do painel forte demais registrada na seção do Smeargle.
- **A paridade Kanto/Johto continua de pé** — o corte vale pros dois lados, e as oito etapas seguem
  com a mesma média de nível nas duas regiões (a escolha é de TIPO, não de dificuldade).
  `tools/test-jornada.js` cobra as oito, e cobra também que o 1º e o 2º continuam nos números
  originais: mexer num lado só quebraria isso em silêncio.
- **Se um dia incomodar**, a alavanca é a própria tabela, e a régua está aqui: o +2 é quase linear,
  então +1 custa aproximadamente metade.

## +1 NÍVEL NA ELITE 4 (13/09/2026)

Pedido junto do +2 dos líderes: *"aumente 1 level também de cada pokemon da elite 4"*. São os
**quatro membros de cada região** (5 pokémon cada, 40 no total). O **5º adversário — o rival —
ficou de fora**: o time dele é montado na hora pelo `buildEliteRivalTeam` a partir do time do
jogador, e ele não é da Elite 4.

- **O +1 VALE NOS DOIS LADOS.** A paridade Kanto/Johto é a regra desta tabela (mesmo número de
  pokémon e mesma média em cada posto), e mexer num lado só a quebraria em silêncio.
  `tools/test-jornada.js` já cobrava a paridade posto a posto; ganhou junto a **escada** — o posto 2
  não pode ficar mais fácil que o 1. Um número fixo ali envelheceria no próximo ajuste; a escada,
  não. Hoje: **58,0 → 59,6 → 60,0 → 61,0**.
- **⚠️ O PREÇO MEDIDO É GRANDE, e ele não é uma luta: é a FILA.** A Elite é um rush com o HP
  carregando entre as lutas (`preservePlayerHp`) e só **2 curas por vitória** — um nível a mais em
  cada um dos 20 adversários compõe ao longo dos quatro. Medido com times pareados e as mesmas
  sementes dos dois lados (1.200 filas por célula, o bot curando os dois mais machucados a cada
  vitória):

  | time | Kanto | Johto |
  |---|---|---|
  | ~62 | 20,0% → **15,8%** (−4,2) | 39,5% → **23,0%** (−16,5) |
  | ~66 | 58,3% → **46,0%** (−12,3) | 76,2% → **57,8%** (−18,3) |
  | ~70 | 91,2% → **87,4%** (−3,8) | 92,5% → **79,5%** (−13,0) |

  Repetido com outras sementes no nível 66: **−11,9 e −16,2** — estável.
- **⚠️ E A MEDIÇÃO ENCONTROU UMA ASSIMETRIA QUE JÁ EXISTIA: a Elite de Johto é mais FÁCIL que a de
  Kanto** (76,2% contra 58,3% no mesmo time), apesar de os níveis baterem posto a posto. A paridade
  da tabela é de NÍVEL, não de força efetiva — os times são de tipos diferentes. Não foi mexido
  porque não foi pedido, e fica registrado: quem for equilibrar isso um dia mexe nas ESPÉCIES, não
  nos níveis.
- **⚠️ ARMADILHA DA MEDIÇÃO, e ela me custou duas rodadas em zero:** com `preservePlayerHp` o motor
  **não enche a barra** -- quem enche é o `startEliteChallenge`, antes do rush. O `createInstance`
  devolve `hp:0/maxHp:0`, então um harness que não chame o `calcMaxHp` manda o time MORTO pra fila e
  mede 0% em qualquer nível. E sem as 2 curas por vitória o rush também é 0% pra todo mundo: é o
  painel degenerado da lição do Smeargle, por dois caminhos diferentes.

## A PRIMEIRA ROTA EXIGE UMA CAPTURA (13/09/2026)

Pedido junto: *"o jogador sempre é obrigado a escolher pelo menos 1 pokémon selvagem na primeira
rota que ele entrar, não pode enfrentar o primeiro ginásio apenas com o inicial ... abrir um modal
falando 'Para enfrentar o primeiro ginásio, você deve ter no mínimo 2 pokémons'"*.

- **VALE SÓ NO PRIMEIRO TRECHO** (`gymIndex === 0`). Dali pra frente pular continua valendo, e é
  escolha legítima — guardar a vaga pra uma rota melhor é jogo. O que não pode é chegar no Brock ou
  no Falkner com um pokémon só.
- **A CONTA É DO TIME, não da oferta** (`precisaCapturarNaPrimeiraRota`): quem chega ao primeiro
  trecho já com dois — um resgatado da Rocket, por exemplo — cumpre a regra e não é obrigado a
  capturar de novo.
- **A recusa é um MODAL, não uma linha de erro.** O botão fica no fim de uma lista de quatro cards,
  e uma frase embaixo dele passaria despercebida justamente por quem clicou sem escolher.
- **⚠️ O EFEITO DELA NÃO É MENSURÁVEL PELO SIMULADOR, e isso é honesto dizer: o bot SEMPRE captura**
  (`for(let i=0;i<Math.min(3, offers.length);i++) g.toggleWild(...)`), então a regra é no-op nas
  12.000 jornadas medidas. Os −11,42 pontos acima são inteiramente do +2. O valor dela é sobre o
  jogador humano que pulava.
- **O QUE ELA EVITA, medido no confronto** (Brock, 2.000 batalhas por célula, inicial sozinho contra
  inicial + um segundo dois níveis abaixo): **+3,8 a +4,9 pontos** de vitória na faixa em que a luta
  se decide (Lv.18 a 22), caindo pra +1,5 quando o inicial já está muito acima. Ou seja: ela ajuda
  exatamente quem estava prestes a perder.
  ⚠️ **Num painel de nível 14 os dois lados dão 0%** — outra vez o painel degenerado; o número só
  significa alguma coisa na faixa em que a batalha existe.
- **E A PRÓPRIA TELA CONTA A REGRA ANTES DO CLIQUE.** A frase dela prometia *"se não quiser
  nenhum, pode seguir em frente também"* — tela que promete o que o jogo recusa é pior que tela sem
  explicação: o jogador clica em Confirmar e leva um modal do nada. No primeiro trecho ela passou a
  dizer *"aqui você precisa levar pelo menos 1"*.
- `tools/test-jornada.js` tranca os quatro casos (não sai da tela sem escolher, a frase palavra por
  palavra, pular continua valendo fora do primeiro trecho, e quem já tem dois não é obrigado).

## Progressão da jornada

- Distribuição de níveis trava em **55**; acima disso só desmaio, Bônus de Kanto e Doce Raro.
- **Desmaiar dá +1 nível.** Isso já foi explorado: jogadores perdiam de propósito porque a
  distribuição tem teto e o desmaio não. Corrigido pelo Bônus de Kanto (abaixo), não removido —
  o desmaio ainda é a rede de quem está atrás.
- **E esse +1 pode ser o nível da EVOLUÇÃO — e não evoluía ninguém.** O pokémon caía, subia de
  nível e continuava na forma antiga. Quem evoluía o time era só o `confirmLevels`, no fim da
  distribuição de níveis, então na DERROTA a evolução acontecia uma tela depois (a distribuição vem
  logo em seguida) e na VITÓRIA só na etapa seguinte — **na do 8º ginásio, na Elite e no esconderijo
  da Rocket, nunca**: ali não existe distribuição nenhuma depois. Reportado em 08/09/2026.
  Hoje `evoluirQuemSubiuNoDesmaio` roda no MESMO lugar em que o nível é dado, nos **dois** caminhos
  de batalha (`finishBattle` e `finishSpecialBattle`). Deixar num só era garantir que o outro
  ficasse com o defeito — e a Elite, cinco lutas seguidas sem cura, é justamente o caminho especial.
  **É comum: 1.415 evoluções em 1.500 jornadas simuladas, tocando 75,4% delas** (1.110 na derrota,
  256 na vitória de ginásio, 49 em batalha especial).
  **Custo medido: dentro do ruído.** Conclusão 68,3% com a correção (10.000 jornadas) contra 67,4%
  sem ela (15.000) — +0,9 ponto, 1,5σ. E o próprio simulador varia mais que isso: três amostras de
  5.000 do lado SEM deram 66,2%, 67,6% e 68,3%. A direção é a esperada (evoluir uma etapa antes só
  ajuda), o tamanho não é mensurável aqui.
- **A evolução é anunciada LOGO DEPOIS DO LOG**, na tela de evolução de sempre: o jogador lê o log,
  aperta continuar, vê quem evoluiu, e só então segue. Sem evolução nenhuma ele vai direto pro
  destino, sem tela a mais.
  Uma caixa dentro da tela de resultado seria uma segunda apresentação pro mesmo evento — e deixaria
  a **bifurcação** (Gloom, Poliwhirl, Slowpoke, Tyrogue) sem tela pra escolher: caixa não escolhe.
  **Quem guarda pra onde ir é o `evolucaoDepois`**, uma CHAVE no save e não a função — a tela de
  evolução é ponto seguro de gravação, e função não sobrevive ao save. É o mesmo desenho do
  `releaseDepois`. Ela nasceu no fim da distribuição de níveis, onde o destino é sempre o
  `teamOrder`; por isso ele era fixo até agora.
  Tem rede pro F5: se o destino é o fluxo da batalha especial e o `specialBattle` não sobreviveu ao
  recarregamento (ele não é salvo), o destino é descartado e a tela cai onde as outras telas
  especiais já caíam. A evolução em si não se perde — ela é aplicada no time no instante em que o
  nível sobe; o que se perde é o anúncio.
- **O sprite do log NÃO acompanha a evolução**, de propósito: a batalha que o log conta aconteceu
  com a forma antiga, e a nova é anunciada na tela seguinte.
- `tools/test-pos-batalha.js` tranca isso, e `tools/smoke-jornada.js` **aperta o botão de verdade**
  (`seguirDoResultado`) em vez de chamar o destino direto — sem isso o bot pularia a evolução e a
  medição não teria como enxergar a mudança.
- **ERAM TRÊS OS CAMINHOS QUE SUBIAM NÍVEL SEM EVOLUIR, não um.** O desmaio foi o primeiro; a
  varredura dos saves de produção (08/09/2026) mostrou os outros dois, e são eles que explicam a
  maioria dos casos presos:
  - **O Bônus de Kanto** (`showJourneyEnd`, +4/+3/+2/+1 no time todo). Ele é a **última coisa que
    sobe nível na jornada** — depois dele não existe distribuição nenhuma, então a evolução que não
    saísse ali não sairia nunca. Era assim que um Pupitar terminava a jornada no nível 59 sem virar
    Tyranitar. Hoje ele roda o `tryEvolve` e sai pela tela de evolução (`evolucaoDepois: 'journeyEnd'`).
  - **O Doce Raro** (`useRareCandy`, no SERVIDOR). O save é escrito lá e **pode nem ser o que está
    aberto** no cliente, então quem evolui tem que ser o servidor: `evoluirNoSave`, espelho do
    `tryEvolve`, parando na bifurcação igual. Não dá pra deixar o cliente consertar depois — a
    repropagação das inscrições de liga (`atualizarInscricoesComTime`) acontece dentro da mesma
    função e levaria a **espécie velha** pro chaveamento.
    `tools/test-especiais.js` compara os dois motores em **24.750 casos** (250 espécies × 99 níveis,
    7.684 com evolução): no que cada um vira e nos seis atributos da forma nova.
- **A VELOCIDADE FICAVA PRA TRÁS EM TODA EVOLUÇÃO DO JOGO** — e era o único dos seis atributos que
  ficava. O `effectiveSpeed` lê `p.speed`, o valor da **instância** (escrito pelo `createInstance`),
  não o da espécie; o `tryEvolve` atualizava tipos, HP, ataque, defesa e os dois especiais, e
  esquecia esse. Todo pokémon que evoluiu neste jogo lutava com a velocidade da forma anterior: um
  Crobat a 90 em vez de 130, um Steelix a 70 em vez de 30.
  **Atinge 107 dos 112 degraus de evolução (96%)**, desvio médio de 20,8 pontos, pior caso 70
  (Sentret 20 → Furret 90). **101 degraus aceleram** (+20,5 em média) e só **6 desaceleram** (−25,0),
  então o efeito é quase todo a favor do jogador — e a velocidade não decide só quem bate primeiro:
  ela decide quem abre o confronto (e ⚠️ **a versão antiga desta linha dizia "a taxa de crítico",
  o que venceu em 10/09/2026** — hoje o crítico é por estágio e não olha velocidade).
  **Custo medido: +1,0 ponto de conclusão** (68,6% contra 67,6%, 12.000 jornadas de cada lado,
  1,6σ) — dentro do ruído do simulador, e para o lado fácil, que é o esperado.
  Achado varrendo os saves de produção, não por teste. Hoje `tools/test-pos-batalha.js` confere os
  **seis** atributos em 7.684 evoluções.
- **O REPARO DOS SAVES QUE JÁ ESTAVAM PRESOS** (`repararEvolucoesAtrasadas`). Fechar a torneira não
  conserta o que já vazou: medido antes das correções, **22 pokémon presos em 17 saves de 15
  treinadores** (1.103 pokémon em 194 saves) — Scyther Lv.62, Golbat Lv.68, Onix Lv.60, Pupitar
  Lv.61. **14 dos 17 saves estão em `journeyEnd`**, com a jornada terminada: ali não roda
  distribuição de níveis nunca mais, e aqueles pokémon ficariam errados pra sempre.
  Roda no carregamento da **HOME** (`loadSaveSlots`), não na abertura do save: o montador da Torre e
  do Ginásio da Cidade escolhe pokémon de QUALQUER save sem abrir nenhum — consertar só o save
  aberto deixaria a lista de lá mostrando a forma velha.
  **E ele não é só pro passado.** A tabela de evoluções já ganhou entradas depois de saves
  existirem — as evoluções por troca viraram nível 40, Johto entrou em 30/08 — e é isso que explica
  16 dos 22 casos (scyther, golbat, onix, seadra, chansey, todos de nível 40). Toda vez que a tabela
  crescer, quem já passou daquele nível fica pra trás; com o reparo isso se conserta sozinho em vez
  de virar um relato daqui a um mês.
  **A BIFURCAÇÃO fica de fora**: escolher Vileplume ou Bellossom por alguém, num save que ele nem
  abriu, seria decidir a coisa mais definitiva do jogo no lugar dele. Ele decide na tela de escolha,
  na próxima distribuição daquele save.
  **O `caughtSpecies` é devolvido ao que era** depois de cada save: o `tryEvolve` chama `markCaught`,
  e ali não há save carregado — a Pokédex de um save receberia espécie de outro. O `permanentPokedex`
  da CONTA continua recebendo, que é o certo: o jogador tem mesmo o bicho evoluído.
  **E o jogador é avisado**, numa caixa na home: um Scyther que vira Scizor troca de tipo
  (Inseto/Voador → Inseto/Aço) e de atributos, e achar que o pokémon sumiu é pior que o defeito.
  A trava do teste **lê o código** e falha se o `loadSaveSlots` parar de chamar o reparo — os casos
  chamam a função direto e passariam com ela órfã (conferido). É a mesma trava que já existe pro
  `applySpecialtyBuff` e pro `equiparItens` nas chamadas de batalha.
- **Bônus de Kanto**: ao vencer o Giovanni, +4/+3/+2/+1/0 níveis pro time todo conforme as derrotas
  totais (0-5 / 6-10 / 11-15 / 16-22 / 23+). Inverte o incentivo: hoje quem farma derrota termina
  ABAIXO de quem joga limpo.
- **O limite de 5 derrotas é POR GINÁSIO**, não da jornada. O contador zera a cada vitória.
  (Errei isso numa simulação e conclui que o jogo era impossível.)
- Perder um ginásio dá +5 níveis pra distribuir (3 no modo difícil). É mecanismo previsto, não
  punição: sem ele, ~100% das jornadas morrem no Brock.
- **O bolo é do TIME; cada pokémon recebe no máximo metade dele.** Bolo 5 = teto 3 por pokémon.
  Fonte de confusão recorrente — a mensagem na tela diz os dois números.

## Anti save scumming

Duas artimanhas medidas e fechadas — em ambas o jogador reiniciava até vir shiny:

- **Encontro selvagem**: saía do save na tela do encontro e voltava, e a rota sorteava tudo de novo.
  A oferta agora vem de uma **semente presa ao contador de encontros do save**
  (`wildEncounterSeq`, na semente junto com slot, rival, inicial e rota). Sair e voltar — ou matar o
  app antes da gravação chegar — devolve a MESMA oferta; só sortear de novo consumindo o encontro.
  `goToWildEncounter` **troca `Math.random` por um rng semeado** durante a montagem (`finally`
  restaura): `buildOfferFromPool`, `rollWildLevel` e `currentShinyChance` sorteiam por dentro e não
  recebem rng por parâmetro. Tudo ali é síncrono, então nada mais do app cai na janela.
  A gravação imediata continua, mas virou conveniência — a defesa é a semente.
- **Iniciais**: apagava o save e criava de novo até um dos iniciais vir shiny. O resultado agora
  fica **na conta, por slot E por modo** (`startersSorteados`, chave `"slot:modo"`), sobrevive ao
  delete, e só é liberado quando aquele slot ganha a **1ª insígnia**. O modo entra na chave porque
  o difícil tem 4× a chance — sem isso dava pra sortear no difícil e recriar no normal levando o
  shiny.
  Sobra uma franquia de sorteios sem jogar: **um por slot, por modo** -- com 20 slots, 40. Ela
  cresce com o número de slots por construção (um slot é uma jornada), e recarregar cada um custa
  uma tentativa de verdade. Quem joga limpo não perde nada: a chance por jornada continua a mesma.
  (Este arquivo dizia "teto de 6 (3 slots × 2 modos)" -- número de quando o teto era 3.)
  **A conta mudou quando os iniciais passaram de 3 pra 6** (Johto entrou na tela): o sorteio corre
  por inicial, então a chance de ver um shiny foi de **2,3% pra 5,3%** por tentativa no normal
  (9,1% → 19,9% no difícil), e o teto da artimanha de **13% pra 28%**. Se incomodar, o conserto é
  sortear só entre os três da região escolhida — mas hoje a região só é escolhida DEPOIS do inicial.

**A TRAVA SOLTA QUANDO A TENTATIVA CONTA — e o GAME OVER conta** (`encerrarTentativaDoSlot`, chamado
na 1ª insígnia e nas 5 derrotas). Isso vale pras DUAS coisas presas ao slot: o sorteio dos iniciais
e a **geração**, que entra na semente do encontro selvagem. Sem a geração, a semente era
slot+rival+inicial — e como o nome do rival hoje já vem preenchido com o padrão da conta, recriar no
mesmo slot repetia **encontro por encontro** a jornada anterior. Quem tomava game over antes do
Brock revivia a mesma jornada, com os mesmos iniciais e os mesmos selvagens em cada rota.
O game over ficava de fora porque a trava foi escrita pensando em quem apaga o save pra rolar o dado
de novo — e quem perde 5 vezes não está fazendo isso: a jornada dele acabou. Abusar disso de
propósito custa jogar o trecho inteiro e perder cinco batalhas, ordens de grandeza acima dos dois
cliques que a trava existe pra impedir.
A geração é **congelada no save** (`saveGen`) no momento em que ele nasce: a que muda é a do slot, na
conta, pro PRÓXIMO save. E ela avança por `increment` no Firestore, não gravando o número lido —
duas abas do mesmo jogador não podem se atropelar aí.

`tools/test-artimanha.js` cobre as duas travas, e o game over ponta a ponta: perde a 5ª batalha de
verdade, cai no game over, e o teste confere que a trava soltou dos dois lados.

## Modo difícil (`gameMode: 'hard'`)

- Bolo de vitória pela metade **a partir do 3º ginásio**. Os dois primeiros ficam normais porque
  reduzir desde o início matava 100% das jornadas no Brock (medido).
- Derrota vale 3 desde o 1º ginásio. Custo medido: 14% morrem no Brock, conclusão cai de 29% → 24%.
- 50% dos pokémon dos líderes vêm shiny. **Efeito mecânico pequeno** — é sinalização visual.
- **Chance de shiny selvagem 8× (1/16)** desde 09/09/2026 — era 4× (1/32). Vale também para os
  iniciais. O sorteio é **por pokémon**, e a oferta tem quatro, então o que o jogador sente é bem
  maior que o número de um:

  | | 1/32 (antes) | 1/16 (agora) |
  |---|---|---|
  | por pokémon | 3,13% | 6,25% |
  | pelo menos um na oferta de 4 | 11,9% | **22,8%** |
  | pelo menos um na jornada (32 sorteios) | 63,8% | **87,3%** |
  | na tela dos 7 iniciais | 19,9% | **36,3%** |

  **Custo medido na dificuldade: quase nada, e por um motivo interessante.** Com o bot padrão
  (que escolhe por tipo e BST, ignorando shiny) a conclusão vai de 21,2% pra 22,8% — +1,6 ponto,
  1,9σ. Com um bot que **prefere shiny**, como um jogador de verdade faria, ela vai de 22,6% pra
  22,8%: **+0,2, ruído puro**. A explicação é que pegar o shiny custa deixar de pegar o pokémon
  melhor da oferta, e o 1,20× quase empata com essa troca. O que a mudança compra não é
  dificuldade, é **frequência de encontrar**.
  (`tools/smoke-jornada.js` ganhou `--dificil` por causa desta medição: sem ele o bot só joga no
  normal, e uma mudança que só existe no difícil fica invisível.)
- **COMEÇAR NO DIFÍCIL CUSTA 🪙 10** (09/09/2026). Quem cobra é o servidor (`payHardMode`), pelo
  mesmo motivo de tudo que mexe em moeda: o campo está na trava do `firestore.rules`, e cliente
  escrevendo moeda é chance de shiny à vontade — exatamente a artimanha que a semente do encontro
  existe pra fechar. O valor vive nos DOIS lados (`MOEDA_MODO_DIFICIL`): o cliente precisa dele pra
  desabilitar o card, o servidor é quem cobra. `tools/test-artimanha.js` lê o servidor e confere
  que os dois números são o mesmo.
  **Cobra primeiro, cria depois** — a mesma ordem do re-sorteio pago. E a cobrança acontece no
  `confirmNewSaveName`, não no `pickGameMode`: cobrar na escolha faria quem desiste na tela do nome
  do rival pagar por uma jornada que não existe.
  **Consequência que vale saber: conta nova começa com ZERO moedas**, e insígnia paga 5. Ou seja, o
  difícil só abre depois de **duas insígnias no normal**. É um gate de fato, não só um preço.
  **E ele fecha uma brecha de graça:** apagar e recriar atrás de um inicial shiny agora CUSTA. O
  sorteio já era congelado por slot+modo (ver `startersSorteados`), então recriar devolvia os
  mesmos iniciais; agora, além de não adiantar, sai 10 moedas por tentativa. Com o difícil em 1/16
  a tela dos sete iniciais mostra shiny em 36,3% das vezes, então essa trava passou a valer mais.

## A porta dos modos de campeão (as 8 insígnias)

Pedida em 12/09/2026: *"caso a conta não tenha nenhum time vencedor das 8 insígnias, coloque uma
mensagem de erro quando o treinador clicar para entrar no ginásio da cidade, ligas clássicas e
batalhas onlines ... e não deixe entrar"*.

- **Os três JÁ recusavam — mas lá dentro.** Cada um tinha a própria frase ("Você precisa de um time
  com as 8 insígnias pra desafiar", "...pra se inscrever"), e ela só aparecia depois de abrir a
  tela, esperar a **geolocalização** no caso do Ginásio, e montar o picker vazio. Agora a recusa é
  na porta, com uma frase só (`AVISO_SEM_CAMPEAO`).
- **⚠️ A PERGUNTA VIVIA COPIADA EM CINCO TELAS** (`s && s.team && (s.badgeCount||0) >= 8`) — e uma
  delas **não pedia o `team`**: um save com as 8 insígnias e sem time passava no Ginásio da Cidade
  e era recusado nas outras. Hoje é o `savesCampeoes()`, num lugar só, e o `team` faz parte da
  pergunta: o que estes modos precisam é de um TIME pronto, não de um troféu.
- **⚠️ A PORTA SÓ BLOQUEIA DEPOIS QUE OS SAVES CARREGAM, e isso não é detalhe.** O `game.saveSlots`
  nasce com 20 nulos e só é preenchido pelo `loadSaveSlots`, que é assíncrono e começa DEPOIS do
  primeiro desenho da home — sem a guarda, quem clicasse nessa janela levava a mensagem **sendo
  campeão**. Errar pro lado de DEIXAR ENTRAR é o certo aqui: a janela dura alguns centésimos, os
  três modos continuam recusando lá dentro, e o contrário é trancar a porta na cara de quem tem o
  time. Quem responde é o `saveSlotsCarregados`, e ele **entrou no `CAMPOS_DA_CONTA`** — sem isso o
  `resetGame` o apagaria ao abrir um save e a porta pararia de bloquear em silêncio.
- **A mensagem fica na HOME, colada nos botões que a provocaram** — num rodapé ou no topo o jogador
  não liga uma coisa na outra. Ela é do CLIQUE e não do estado da conta: `openSaveSelect` a limpa,
  senão ela continuaria na tela depois de o jogador ir conquistar a 8ª insígnia.
- **Os botões continuam clicáveis**, e foi o pedido: *"coloque uma mensagem de erro quando o
  treinador clicar"*. Um botão apagado não diz por quê — e o que falta aqui é justamente saber o
  que fazer pra abrir aquilo.
- **⚠️ A TORRE DOS TREINADORES FICOU DE FORA**, porque o pedido nomeia três modos. Ela monta time a
  partir dos saves campeões do mesmo jeito, então hoje uma conta sem campeão entra lá e encontra o
  montador vazio. **Fica FIXADO no teste** (a porta está em exatamente três lugares, e a Torre não
  é um deles) pra o dia em que isso mudar ser uma decisão e não um descuido.
- **Medido a 320px, no navegador:** a caixa da mensagem mede **84px**, o texto cai em 2 linhas, ela
  fica logo acima da fileira de modos e não há rolagem horizontal.
- `tools/test-inventario.js` tranca os cinco cenários nos TRÊS modos: conta vazia, save com 3
  insígnias, save com as 8 **sem time**, save campeão (entra e sem mensagem) e saves ainda não
  carregados (não bloqueia) — mais a mensagem na home, a posição dela e a limpeza ao voltar.

## ⚠️ AS LIGAS E O ONLINE MORAM EM `docs/ligas-e-online.md`

**LEIA ESSE ARQUIVO ANTES DE MEXER EM LIGA, CHAVEAMENTO, INSCRIÇÃO, BATALHA ONLINE, TORRE OU
GINÁSIO DA CIDADE.** É o registro da máquina de ciclos (que é genérica por `typeId` e resolve
sozinha, sem cron dedicado), e dos defeitos que ela já teve em produção — inclusive dois que
mataram as duas ligas por um `undefined`.

⚠️ **E ELE ALCANÇA O MOTOR:** a liga é resolvida pelos DOIS motores (o cron e o navegador de quem
assiste), então **uma divergência de uma linha entre `index.html` e `functions/index.js` faz a
mesma partida terminar diferente** — e o jogador só descobre quando perde uma final.

**O que está lá:** a **Liga Clássica** e as customizadas, a **Liga Pro** (o time sorteado), a **Trainers
League**, o **chaveamento com BYE**, a **Batalha Online** confronto a confronto, a **Torre dos
Treinadores**, o **Ginásio da Cidade**, o **montador de time**, o **painel de admin** e a
**performance** (a geografia do Firestore).

**⚠️ E ESTES SÍMBOLOS SÓ SÃO EXPLICADOS LÁ** — um `grep` que caia aqui e não ache nada tem que
ir pro capítulo, e é essa lista que faz o gatilho valer quando o assunto não é óbvio:

`drawCycle` · `MAX_GOLPES` · `isAccountActiveInLeague` · `advanceCyclePhases` · `cycleId` · `ensureRegisteringCycle` · `typeId` · `proFaixa` · `dividirEmChaves` · `coinsPaid` · `computePlacement` · `resolverTimeDosSaves` · `claimJourneyCoins` · `DUPLICATE` · `leagueCycles` · `cycleDocRef` · `REGULAR_LIGA_SIZE` · `leagueTypeId` · `accountLeagueSlots` · `ReferenceError` · `recordLeagueChampionWin` · `CRIT_BASE` · `matchKey` · `watchLeagueMatch` · `registrantCount` · `adminListTrainers` · `startAfter` · `montadorDeTimeHtml` · `monId` · `leaderUid` · `setNeighborhoodGymDefense` · `resgatandoConquistas` · `serializeGame` · `towerGetToday`

*(16 seções, 98 subseções, 175 KB — saíram daqui em 25/09/2026 porque o CLAUDE.md é lido
INTEIRO em toda sessão, e ele tinha chegado a 1.360 KB.)*

## Slots de save

- **São 20** (`MAX_SAVE_SLOTS`, 03/09/2026 — eram 10). O número é espelhado no servidor em DOIS
  lugares, e os três têm que andar juntos:
  `TRAINERS_LEAGUE_MAX_SAVE_SLOTS` (o servidor não carrega o `index.html`, só o valor) e
  **`MAX_BATTLE_CODES`**, que corta a lista de times elegíveis da batalha online. Esse último é o
  que morde em silêncio: o cliente manda todos os times e depois escolhe **por índice** nessa lista,
  então com o corte em 10 quem tem time no slot 12 nunca conseguiria escolhê-lo — e a lista que a
  tela desenha vem de lá, então ele sumiria sem explicação.
- **Custo medido antes de subir** (o mesmo jogo rodando com os dois tetos):
  - **Banco: praticamente zero.** Quase todo caminho lê `collection('saves').get()`, que cobra por
    documento devolvido — quem tem 1 save custa 1 leitura, com teto 10 ou 20. Subir o teto não custa
    nada até alguém criar save de verdade. Um save cheio tem ~2,9 KB, então 20 saves são ~59 KB por
    conta; o limite de 1 MiB do Firestore é por DOCUMENTO e cada save é um documento.
  - **Tela: dobra pra quem enche.** Home com 20 saves contra 10: 51 → 94 KB de HTML, 552 → 1.052 nós,
    66 → 126 sprites, 2.307 → 4.117px de altura, e **3,8ms → 7,0ms** pra desenhar (mediana de 20
    desenhos). Continua dentro dos 16ms de um quadro, mas o `render()` recria o `innerHTML` inteiro a
    cada toque e a home é a tela que mais redesenha.
  - **Conta nova:** 20 cards vazios de 41px = 1.570px, ~2,8 telas a 320×568. É o preço de ter os
    slots à mostra; se um dia incomodar, o lugar de mexer é `renderSaveSelect` (mostrar só o próximo
    slot vazio, por exemplo).
  - **O montador de time não sente:** vai de 60 pra 120 elegíveis, mas ele é paginado de 10 em 10 —
    são 6 → 12 páginas, sempre 10 linhas desenhadas.
- **A trava anti save-scumming continua valendo igual, e é por SLOT.** Cada slot guarda o próprio
  sorteio de iniciais e a própria geração de encontros; a franquia de "primeiras olhadas" sem jogar
  cresce com o número de slots por construção, porque um slot é uma jornada. No difícil ela já era
  ~89% com 10 slots e vai a ~99% com 20 — não é brecha nova, é o mesmo teto arredondado.
  (O CLAUDE.md dizia "teto de 6 sorteios (3 slots × 2 modos)": era um número velho de quando o teto
  era 3. Com 10 já eram 20; com 20 são 40.)

## Home

### OS SLOTS SE ORDENAM PELA MÉDIA DO TIME (24/09/2026)

Pedido assim: *"no home, de para ordernar os slots que tem um time, pela média de level do time"*.
São **duas** ordens — a de sempre (por slot) e a nova —, e o botão fica na linha do `SEUS TIMES`.

- **⚠️ A MÉDIA MORA NUMA FUNÇÃO SÓ** (`mediaDoTime`), e ela tem **DOIS leitores**: a estrela do card
  e a ordem. Escrita nos dois, elas divergiriam no primeiro ajuste — e o sintoma seria o **pior
  defeito possível numa ordenação**: o card mostrando um número e a lista ordenando por outro, ou
  seja *"ela fica errada sem nada estar errado"*, e o jogador sem ter como saber qual dos dois está
  certo. **⚠️ E ISSO SÓ SE PROVA LENDO O CÓDIGO** — hoje as duas contas dão o mesmo número, então
  comparar a estrela com a `mediaDoTime` passaria com a conta duplicada. É a mesma técnica que a
  conta da Pokédex e o asterisco do cartão de golpe precisaram.
- **DECRESCENTE**, que é a régua do montador (*"quem monta time pra lutar procura o mais forte
  primeiro"*) — é a única que responde à pergunta que essa ordem existe pra responder.
- **⚠️ OS VAZIOS VÃO PRO FIM SOZINHOS, e isso não precisou de guarda:** slot sem save tem média
  **ZERO**, e zero é menor que qualquer time.

#### ⚠️ E A GUARDA QUE EU PUS EM CIMA DISSO ERA LETRA MORTA — mas tirá-la PELA METADE contradiz

O comparador nasceu com um `if(ca !== cb) return ca ? -1 : 1; if(!ca) return a - b;` na frente da
média. **Medido: os 20 slots saem na MESMA ordem com e sem ela** — ela não mudava o resultado de
nada, porque a média zero já resolve.

**⚠️ O QUE É PERIGOSO É O MEIO-TERMO:** deixar o `if(!ca) return a - b` **sem** o `if(ca !== cb)` em
cima — que é o que alguém faria "simplificando" o comparador sem medir. Aí ele fica
**CONTRADITÓRIO**: medido num painel de 4 times entre 16 vazios, **30 dos 190 pares passam a dizer a
MESMA coisa nos dois sentidos** (`cmp(a,b)` e `cmp(b,a)` os dois negativos).

**⚠️ E ISSO NÃO DÁ ERRO NENHUM — o resultado continua saindo CERTO.** O TimSort do V8 compara numa
ordem que mascara a contradição; a ordem que sai passa a depender do motor. Foi exatamente assim que
a conferência de acusação achou o caso: o defeito religado **não movia uma linha do resultado**, e
nenhuma das treze asserções de ordem pegava.

**A trava que separa *"a ordem está certa"* de *"a ordem está certa POR ACASO"* é a da
ANTISSIMETRIA**: para os 190 pares, `cmp(a,b)` e `cmp(b,a)` têm que ter sinais opostos, e o
comparador só pode empatar consigo mesmo. Ela é a única que acusa o meio-termo, e é ela que impede
que alguém o reintroduza.

**⚠️ E EU INVERTI A CONCLUSÃO NO CAMINHO, o que vale registrar:** medi um comparador **sem** a guarda
e atribuí os 30 pares contraditórios **a ela**, quando eles eram da **ausência parcial** dela — e
cheguei a escrever isso no comentário do código. Foi a conferência de acusação que desfez:
religando a guarda inteira, a trava **não acusou** (ela é consistente), e foi esse mudo que apontou
o erro da leitura. **Um "mudo" na acusação é tão informativo quanto uma falha.**

#### O BOTÃO

- **⚠️ SÓ APARECE COM DOIS TIMES OU MAIS**: com um save só, ordenar não ordena nada — a mesma regra
  que esconde a paginação do montador quando há uma página só, e a do "pular a tela de golpes" de
  quem tem 3 ou menos disponíveis.
- **⚠️ ELE NÃO USA O `.btn` DA CASA:** aquele é botão de AÇÃO, `display:block;width:100%` — ele
  **esticaria pra a linha inteira** e empurraria o rótulo `SEUS TIMES`. É a armadilha que o card do
  parceiro da Pescaria já custou, e o mesmo raciocínio que tirou o `.btn` das abas do ranking e das
  prateleiras da loja.
- **ELE ACENDE quando a ordem é a média**: sem isso as duas se leem iguais e o jogador não sabe em
  qual está.
- **⚠️ O AMARELO DO ATIVO É OPACO, e isso foi medido:** a `.home-section-row` fica **FORA de
  qualquer `.box`**, sobre o fundo escuro da página — com o `--yellow` em alpha, o que aparecia por
  baixo era o escuro, e o `--ink` em cima dele dava **1,00:1** (ilegível). Opaco ele dá **11,21:1**.
  É a mesma família do `--cream` e do `--yellow-soft` fantasmas, agora por transparência em vez de
  variável inexistente.
- **A estrela é a MESMA do card da média** (o `STAR_SVG`), que é justamente o que ele ordena.
- **⚠️ `homeOrdem` ESTÁ NO `CAMPOS_DA_CONTA`** — sem ele, abrir um time e voltar pra home
  **desfaria a ordenação**, e ir e voltar de um save é justamente o que mais se faz nessa tela.
  E ele **NÃO vai pro banco**: o `serializeGame` é uma lista de permissão, e isto é estado de ABA.

**Medido a 320px, no navegador:**

| | docW | botão | contraste | ordem dos quatro times |
|---|---|---|---|---|
| **POR SLOT** | 305 | 75×24px | 5,02:1 | 42, 71, 58, 63 *(a de sempre)* |
| **POR MÉDIA** | 305 | 88×24px | **11,21:1** | **71, 63, 58, 42** |

**Zero nomes truncados** e sem rolagem lateral nos dois.

**No motor, nada:** `MOTOR 2d6a83f24cf1 / DIARIO 72e61601d1fb`, idêntico em 900 batalhas semeadas.

`tools/test-inventario.js` tranca 26 pontas: a média (o arredondamento, o save sem time), **a
estrela LENDO a função** (pelo código), a ordem por slot saindo byte a byte como antes, a por média
com os vazios no fim, ninguém sumindo nem repetindo, o empate desempatando pelo slot, **a
antissimetria nos 190 pares**, o botão nos quatro estados, e o campo atravessando o `resetGame` sem
ir pro banco. **Conferido que os 8 defeitos religados acusam.**

### O BOTÃO DE ATUALIZAR, QUANDO SAI VERSÃO NOVA (13/09/2026)

Pedido assim: *"caso algum usuário esteja jogando em uma versão que não é a mais atual, aparecer um
botão de 'Atualizar para versão mais recente'"*.

- **O QUE ISSO RESOLVE NÃO É O CACHE — esse já estava resolvido.** O `index.html` vai com
  `no-cache`, então quem ABRE a página depois de um deploy já pega a versão nova. O buraco é a **aba
  que ficou aberta**: o jogo é um arquivo só, a pessoa deixa o jogo aberto o dia inteiro e continua
  jogando o código velho até dar F5. Isso já custou um relatório de bug — o jogador mandou print de
  um defeito que estava consertado (ver a seção de Deploy).
- **⚠️ A IMPRESSÃO É O ETag DO PRÓPRIO `index.html`, e é por isso que NÃO existe número de versão.**
  O Firebase Hosting devolve um ETag que é o SHA-256 do conteúdo — conferido em produção antes de
  construir em cima: ele é estável entre requisições e só muda quando o arquivo muda. Um
  `VERSAO = '1.2.3'` escrito à mão seria mais uma linha pra lembrar em todo deploy, e **esquecer
  significaria o aviso nunca aparecer, em silêncio** — que é a pior forma de um aviso falhar.
  A pergunta é um `HEAD`: não baixa os 1,2 MB, só os cabeçalhos. O `Last-Modified` é a rede de
  segurança se um dia a hospedagem parar de mandar ETag.
- **⚠️ A MINHA VERSÃO É A PRIMEIRA QUE EU VI, e nunca é atualizada depois.** É isso que faz a
  comparação significar *"saiu coisa nova DESDE que eu carreguei"*. Atualizando-a, o aviso sumiria
  sozinho na pergunta seguinte. Sobra uma janela minúscula: se um deploy cair entre o carregamento
  da página e a primeira pergunta, esta aba adota a versão nova como a dela e não avisa. **O erro é
  pro lado de NÃO avisar**, que é o certo — um aviso falso mandaria o jogador recarregar à toa.
- **SEM REDE NÃO SE AFIRMA NADA**: falha de fetch ou resposta ruim não acendem o botão. É um aviso;
  ele não pode atrapalhar a home.
- **⚠️ O BOTÃO SÓ EXISTE NA HOME, e isso não é onde ele coube — é onde ele é SEGURO.** Recarregar no
  meio de uma jornada jogaria fora a tela em que a pessoa está (uma escolha de golpe, uma
  distribuição de níveis); na home não há nada em curso e o save já está gravado.
- **`location.reload()` basta.** Com `no-cache` o navegador revalida pelo ETag, e o service worker do
  jogo é passa-direto (ver `sw.js`, que é sem cache de propósito). Um `?v=` na URL resolveria o mesmo
  e deixaria lixo na barra de endereço de quem instalou o atalho.
- **O aviso vem ANTES DE TUDO na home**, inclusive do aviso de evolução em atraso: o que está velho
  aqui é o JOGO INTEIRO, e qualquer coisa que a pessoa faça na versão antiga pode ser um defeito já
  consertado.
- **`versaoNova` está no `CAMPOS_DA_CONTA`**: ele é da ABA, não do save. Sem isso, abrir um save e
  voltar pra home apagaria a marca e o botão sumiria até a próxima pergunta (que tem folga de 1
  minuto, pra ir e voltar na home não virar uma pergunta por clique).
- **Medido a 320px:** o aviso ocupa 226px e o botão quebra em duas linhas (34 caracteres), sem
  rolagem lateral.
- `tools/test-inventario.js` tranca a mecânica com a rede trocada por um dublê: a primeira resposta
  só guarda a versão desta aba, impressão igual não avisa, impressão diferente acende o botão com o
  texto pedido palavra por palavra, o aviso vem antes do cabeçalho, a minha versão não se atualiza
  sozinha, o botão recarrega, sem rede não aparece nada, e a folga vale (3 chamadas, 1 ida à rede).
  Mais duas que **leem o código**: que o campo está no `CAMPOS_DA_CONTA` e que a home realmente
  pergunta — os casos chamam a função na mão e passariam com a chamada órfã.
  **⚠️ Ele usa um sandbox PRÓPRIO**: é o único bloco que depende de estado de MÓDULO (a impressão
  desta aba, a folga), e o resto do arquivo deixa promessas de `openSaveSelect` pendentes — quando o
  primeiro `await` cede, elas rodam e uma delas também pergunta a versão, roubando a primeira
  resposta. Conferido que o teste acusa com o botão fora da home, com a home sem perguntar, e com a
  minha versão se atualizando sozinha.
- **O sandbox aprendeu `location.reload()`** (anotado em `__recargas`, não executado) — sem isso o
  teste do botão recarregaria o próprio processo do teste.

#### ⚠️ E ELE NASCEU DUPLICADO — a unificação (13/09/2026)

**O jogo JÁ TINHA um aviso de versão nova**, escrito antes de 28/08, e eu não procurei antes de
construir o de cima. Eram dois mecanismos fazendo a mesma pergunta. O velho:

- **baixava o `index.html` INTEIRO** e tirava o SHA-256, no carregamento e **a cada 5 minutos**.
  São **1,45 MB por consulta, por aba aberta** — ~17 MB por hora em cada aba parada;
- mostrava uma **faixa fixa no topo** (`#version-banner`), que aparece em qualquer tela.

**O que ficou de cada um:** a PERGUNTA é a barata (o ETag num `HEAD`), e as DUAS telas ficaram — a
faixa do topo e o quadro da home. São **duas portas pro mesmo aviso, não dois avisos**: a faixa
existe porque a ronda de fundo roda com o jogador em qualquer lugar, e o quadro porque é na home
que dá pra recarregar sem perder nada. Os dois botões chamam o mesmo `atualizarParaVersaoNova`.

- **A RONDA DE FUNDO ficou nos mesmos 5 minutos** do mecanismo antigo — o que mudou foi o preço.
  E o gancho de `visibilitychange` ficou também: ele cobre o caso mais comum de todos (a aba que
  passou o dia em segundo plano e voltou).
- **⚠️ O `render()` SÓ ACONTECE NA HOME.** Este aviso chega por um TIMER, e um `render()` no meio de
  uma animação de batalha recria o HTML e mata a transição da barra de vida — a regra da casa, que
  já custou três defeitos. A faixa é pintada direto no DOM, como tudo que chega de fora da tela.
  O mecanismo antigo já fazia assim; a primeira versão do novo chamava `render()` de dentro do
  timer, e isso só não quebrou nada porque ela ainda não tinha ronda nenhuma.
- **⚠️ E EU REPETI, NO MESMO DIA, O DEFEITO QUE TINHA ACABADO DE CONSERTAR.** A chamada de
  carregamento (`conferirVersaoNoAr()`) ficou **acima** das declarações `let`/`const` que ela lê —
  zona morta temporal, o mesmo erro que travou as quatro telas de revelação em 09/09. E aqui era
  **pior**: a função é `async`, então o erro não aparece na cara — vira uma promessa rejeitada em
  silêncio, e a versão desta aba nunca seria capturada. Nenhum teste de comportamento pega isso (os
  casos chamam a função na mão, com tudo já declarado); o que pega é a ORDEM no arquivo, e é isso
  que o teste passou a cobrar.
- **⚠️ E O RELÓGIO FALSO DO TESTE TEVE QUE SUBIR.** Com a pergunta acontecendo no carregamento, o
  script carimba `ultimaChecagemDeVersao` com o `Date.now()` REAL — um relógio de teste começando em
  5.000.000 fica bilhões de milissegundos atrás dele, e aí toda pergunta cai dentro da folga e
  nenhuma vai à rede. Ele passou a começar em `Date.now() + 1h`.
- `tools/test-inventario.js` tranca a unificação: o mecanismo que baixava o arquivo não existe mais,
  a faixa continua e usa a mesma ação do quadro, a ronda usa a pergunta barata, o `render()` só na
  home, a ordem da chamada de carregamento, e a faixa acendendo junto com o quadro.

### O ! DO BOTÃO DAS LIGAS (13/09/2026)

Pedido assim: *"coloque um sinal de ! (igual quando tem notificação) no botão de ligas onlines,
quando o treinador ainda não está inscrito em nenhuma liga"*. É o MESMO `.notif-badge` do sino e do
card de Amigos — um sinal que o jogador já sabe ler como "tem coisa aqui".

- **⚠️ ELE SÓ APARECE QUANDO HÁ LIGA COM INSCRIÇÃO ABERTA**, e isso é decisão: quem responde é o
  `game.avisoLiga`, que já existia pro aviso das telas de batalha e significa *"há um ciclo aberto E
  você está de fora"*. Um `!` aceso o tempo todo pra quem não quer liga viraria ruído — e aceso com
  a inscrição FECHADA seria convidar pra uma porta fechada, que é a regra que o próprio aviso já
  segue.
  Se um dia a intenção for o `!` no sentido literal ("não está inscrito, ponto"), é trocar a
  condição — e a régua está aqui.
- **"Já está dentro" é mais que estar inscrito NESTE ciclo**: quem está disputando um ciclo já
  sorteado não consegue se inscrever no próximo. Quem cobre os dois casos é o
  `isAccountActiveInLeague`, e é ele que o `avisoLiga` usa.
- **⚠️ A HOME PASSOU A CALCULAR O AVISO.** Ele só rodava dentro do `runBattle` (pro botão de busca
  online das telas de batalha), então na home o valor era o que tinha sobrado da última jornada — o
  `!` só apareceria depois de o jogador ter batalhado. Custa no MÁXIMO **2 leituras a cada 5
  minutos** (a folga mora no `atualizarAvisoDaLiga`) e ele engole o próprio erro.
- **⚠️ O BOTÃO PRECISOU VIRAR `position:relative`.** O selo é `position:absolute`, e sem um ancestral
  posicionado ele se pendura no canto da PÁGINA em vez do canto do botão — o sino e o card de Amigos
  já eram relativos. Isso não aparece em asserção de HTML nenhuma, então o teste lê o CSS.
- **Medido a 320px, no navegador:** o selo fica em `top −4px, right −4px` do botão, sem rolagem
  horizontal, ao lado dos outros três selos da home.
- `tools/test-inventario.js` conta o selo DENTRO do botão das ligas, e não na home inteira: o sino e
  o card de Amigos também usam o `.notif-badge`, e um teste que contasse todos daria verde por acaso.
- **Cinco cards numa linha só**: Pokédex, Conquistas, Amigos, Mochila e Loja. A linha virou
  `grid-template-columns:repeat(5,minmax(0,1fr))` — com `1fr` (que é `minmax(auto,1fr)`) a coluna não
  encolhe abaixo do conteúdo, e "Conquistas" empurrava a linha inteira pra fora dos 320px.
- **OS CARDS FICARAM SÓ COM O NOME E OS NÚMEROS** (04/09/2026). A Pokédex mostra `175/250` e as
  Conquistas `53/69`; Amigos, Mochila e Loja ficam **só com o nome**. As frases que viviam ali
  ("Desafie quem você conhece", "Seus itens", "Em breve", "N desafios pra completar") eram convites
  de quando os cards estavam nascendo — num card de 43px a 320px elas eram a parte mais longa e a
  que menos se lia. O número diz o que falta sem uma palavra; onde não há número, o nome basta.
  O contador de conquistas **só aparece depois que o agregado carrega** — até lá o card fica sem a
  linha de baixo, em vez de mostrar um total sem o "de quantas".
- **O preço medido de caber cinco:** a 320px cada card fica com **43px** de texto, e "Conquistas" na
  fonte de pixel mede **99px**. Duas coisas cederam: o título passou pra fonte de TEXTO (mede 56px
  na mesma palavra) e a **contagem de baixo some abaixo de 420px** — "0/250 registrados" quebrava em
  três linhas e o card virava uma parede. Mesmo assim "Conquistas" não cabe numa linha: ela **quebra
  em duas** (`hyphens:auto` com `overflow-wrap` de rede de segurança), e o título tem altura fixa de
  duas linhas pra os cinco cards ficarem do mesmo tamanho. É o único ponto feio da linha de cinco —
  se incomodar, as saídas são encurtar o rótulo ou aceitar duas fileiras.
- **O nome do treinador ficou à ESQUERDA e o contador de moedas à direita**, no mesmo card.
  Centralizado, o nome mudaria de posição conforme o número de moedas crescesse — dançaria de lugar
  a cada compra. O contador não encolhe nunca: quem cede espaço é o nome, que já trunca.
- `.btn.danger:disabled` ganhou o mesmo tratamento que o `.btn.success` já tinha: **botão
  desabilitado precisa parecer desabilitado**, e o vermelho cheio do "Excluir" convidava a clicar em
  algo que não responde.

## Boss de Domingo (raide global) — **DESATIVADO desde 13/09/2026**

- **⚠️ O EVENTO ESTÁ DESLIGADO**, a pedido: *"tire o evento do boss de domingo, vamos deixar ele
  desativado porque estou pensando numa nova mecânica para ele"*. Tudo abaixo continua valendo como
  descrição do que ele É — nada foi removido.
- **QUEM FECHA DE VERDADE É O SERVIDOR** (`BOSS_ATIVO` no `functions/index.js`): o
  `bossRequireTester` passou a recusar com `failed-precondition`, e ele é o caminho das duas
  callables. O cliente sozinho não fecharia nada — o estado da raide é **global** (um único ataque
  mexe na barra que o jogo inteiro vê), o `index.html` vai com `no-cache` mas uma aba **aberta**
  continua com o jogo velho, e o console está sempre ali.
- No cliente é o `BOSS_DE_DOMINGO_ATIVO`: o `ehDomingo()` passa a ser sempre falso (o botão da home
  some) e o `openSundayBoss` recusa. **São duas constantes e religar é as duas.**
- `tools/test-boss.js` cobra **os dois lados**: desligado as duas portas recusam, e daí pra baixo a
  suíte liga o evento (`fns._boss.ativo(true)`) e testa a mecânica inteira. Sem a primeira metade,
  religar um dia seria uma surpresa; sem a segunda, a raide apodrecia sem ninguém ver.


- **Aberto pra todos** desde 30/08/2026 (nasceu restrito a `userTest`; o `bossRequireTester` ficou
  como gancho, sem efeito). O que limita é o CALENDÁRIO: o botão da home só existe **aos domingos**,
  pelo relógio do jogador. O servidor não checa o dia de propósito — checar obrigaria a escolher um
  fuso pro mundo inteiro, e quem vê "domingo" no celular não entenderia o botão sumir. Abrir a tela
  fora de domingo pelo console não quebra nada: é a mesma raide, só não anunciada.
- O botão ocupa as **duas colunas** da grade de modos (`.home-btn-largo`): é um evento de um dia por
  semana, e dividir espaço o faria passar despercebido justamente no dia dele.
- Um Mew **nível 4999**, um só pro jogo inteiro (`globalBoss/mew`). A vida **nunca regenera**: o que
  um jogador tirou fica tirado pro próximo. Nas regras do Firestore o documento é **leitura livre e
  escrita negada a todos** — inclusive ao dono da conta. É o oposto das outras coleções: ali um
  jogador só estraga o que é dele; aqui uma escrita solta mataria o Mew de todo mundo com um `hp:0`.
- **O servidor nunca aceita um time do cliente**, só o `slot` — o time sai do save gravado. Aceitar
  um time montado na hora seria aceitar seis pokémon nível 99 inventados no console, e o estrago
  não ficaria no save de quem trapaceou: ficaria na barra que o jogo inteiro vê.
- O desconto vai numa **transação**: duos ataques simultâneas leem o mesmo HP, e sem isso a
  segunda grava por cima da primeira e metade do dano some. (`tools/fake-firestore.js` ganhou
  transações serializadas por causa disto — antes rodavam sem isolamento nenhum.)
- **O HP NÃO dimensiona a raide.** Contra-intuitivo e já quase custou uma escolha errada: o motor
  calcula dano como fração da vida do alvo (`pct = dmgGen1 / gen1MaxHp(alvo)`) e só projeta na
  escala no fim (`pct * maxHp`). Medido: com 5.125, 10.000, 20.000 ou 100.000 de HP, um ataque
  tira sempre **~2,44% da barra**. Dobrar o HP dobra o dano por golpe e o número de ataques não
  muda. Quem controla a duração é o **nível** do Mew (entra no divisor): nível 200 → 3 ataques,
  500 → 13, 999 → 41, 2000 → 118 (time nível 70).
- O HP **sai da fórmula do jogo**, não é escolhido: `BOSS_MAX_HP = calcMaxHp({level:4999, baseHp:100})`
  = `round(30 + 4999*5 + 100)` = **25125**. Mew é 100 em todos os atributos (oficial da Gen 2).
  **Trocar o nível (ou o HP) exige apagar `globalBoss/mew`, `globalBoss/mewRank` e a subcoleção
  `players`**: o `maxHp` fica gravado no documento e o dano acumulado está na escala antiga. Já foi
  feito duas vezes — 10000 fixo → 5125 (nível 999) → 25125 (nível 4999).
- Calibragem: **~399 ataques** de um time nível 70 (era ~41 no nível 999). Um time de 6 sempre dá
  **24 golpes** por ataque: o Mew mata cada pokémon em 2 golpes (teto de 65% por golpe).
  Efeito colateral medido e aceito da subida pra 4999: com a defesa tão alta o dano de quase todo
  mundo desce pro piso, e a força do time quase não importa mais — time nível 50 leva **411**
  ataques, nível 99 leva **340** (1,2× de diferença, contra 2× que havia no nível 999). A raide
  virou uma conta de QUANTA GENTE bate, não de quão forte cada um é.
- **Derrubar o Mew premia o Top 10**: 1 hora de chance de shiny aumentada (`shinyBonusExpiresAt`,
  o mesmo campo do prêmio da Elite) + notificação com a posição e o dano. O bônus é gravado
  DIRETO, sem passar por notificação-cupom como o da Elite: aqui não há o que escolher, todo mundo
  do top 10 ganha igual, e um cupom a ativar só criaria um jeito de perder o prêmio.
  Marca também `bossTop10` na conta dos dez e `bossKiller` em quem deu o golpe final — que **não é
  necessariamente do top 10**: pode ter chegado no fim e tirado os últimos 20 de HP.
- Três conquistas novas: **Caçada Coletiva** (top 10 numa raide vencida), **Golpe Final** (derrubar
  o Mew) e **Mestre do Disfarce** (vencer a Elite 4 com um Ditto no time). As duas primeiras vêm de
  flags da CONTA, gravadas pelo servidor — não dá pra derivar do save, porque a raide é coletiva.
  A terceira usa `eliteDittoWin`, gravada **no instante da vitória** (mesmo motivo do
  `everComeback`): olhar o time do save depois daria a conquista pra quem só pôs o Ditto no time
  DEPOIS de ser campeão, e tiraria de quem venceu com ele e trocou em seguida.
- **Transação: as leituras TODAS antes das escritas.** O Firestore recusa a transação inteira se um
  `get` vier depois de um `set`, e o erro só existe em produção — chega no cliente como um
  `INTERNAL` seco. A função nasceu assim: 24 checagens verdes no teste, 500 no ar. O
  `fake-firestore` passou a impor a mesma regra, então esse erro agora quebra o teste.
- **O dano que vale é o APLICADO, não o simulado.** A luta é calculada sobre o HP lido ANTES da
  transação; entre a leitura e a gravação outros treinadores podem ter batido. Descontar o
  simulado deixava o HP certo (o `Math.max` segurava), mas creditava dano que nunca existiu —
  medido com 10 contas simultâneas num Mew com 251 de vida: as contribuições somaram **6322 de uma
  barra de 5125**. Hoje o desconto é `min(simulado, hp atual)` e quem chegou tarde é avisado na
  tela. Com 10 simultâneas no Mew cheio nada disso aparece: o dano fecha exato e as 10 contam.
- **Limite de escrita do Firestore: ~1 gravação por segundo por documento** (sustentada). A raide
  inteira passa por um documento só, então concorrência alta vira retentativa e latência, e num
  pico longo o suficiente vira `ABORTED` depois de esgotar as tentativas do SDK — o jogador
  perderia o ataque. Isso é propriedade documentada do Firestore, **não** algo medido aqui: o
  `fake-firestore` serializa as transações e não modela contenção. Se a raide abrir pra todo
  mundo, a saída conhecida é fragmentar o contador (N documentos, soma na leitura).
- **O quadro #151 (Mew) aparece na Pokédex, mas NÃO na conta.** A grade some com o buraco entre o
  #150 e o #152 — ler a Pokédex e achar uma falha justo onde todo mundo sabe que mora o Mew parece
  defeito do jogo. A contagem ("X de 250") continua saindo do `SPECIES`, onde o Mew **não está** e
  não pode estar: o desafio do Mewtwo e a conquista "Mestre Pokémon" cobram "capturou todo o
  resto", e uma vaga que ninguém consegue preencher deixaria os dois impossíveis pra sempre — o
  que já aconteceu neste jogo, com o Celebi, e ficou dias sem ninguém notar.
  A célula é **comum, de não-descoberto** — igual a qualquer espécie que o jogador ainda não pegou:
  sem estilo próprio, sem clique, sem ficha. Chegou a ter os dois (destaque rosa e ficha com os
  atributos da Gen 2) e saiu por decisão de design em 01/09/2026: qualquer marca ali promete alguma
  coisa, e não há nada a prometer. `tools/test-online-dex.js` tranca as duas metades — que o #151
  está na grade E que o total continua 250 — e mais: que ele não ganhou clique de volta.
- O Mew **não entra em `SPECIES`** — tudo que está lá conta pro total da Pokédex e pro "capturou
  tudo" que libera o Mewtwo, e um Mew que ninguém captura abriria uma vaga #151 impossível. A tela
  o encontra por `SPECIES_FORA_DA_DEX` / `especieParaTela()`; os atributos vivem só no servidor.
- A luta reaproveita **inteira** a tela de revelação da Torre (`trainerBattling`), trocando só o
  destino no fim (`bossBattlePending`). O nome do golpe do Mew cai no `MOVE_BY_TYPE` — ele não
  tem entrada no `MOVE_OVERRIDES` e não precisa.
- A tela tem **dois passos**: estado da raide + ranking, e só depois do "Atacar Mew" a lista de
  times. Com a lista aberta de saída, a barra de vida e o ranking — que são a razão da tela
  existir — ficavam atrás de uma rolagem em 320px.
- **A tela ESCUTA os dois documentos em tempo real** (`onSnapshot`), não consulta de tempos em
  tempos. É obrigatório numa raide coletiva: sem acompanhar, duas contas abertas lado a lado
  mostravam vidas diferentes, e nem o próprio ataque atualizava o ranking (o resultado da luta
  traz o HP e a sua contribuição, mas não a lista).
  As regras liberam leitura de `globalBoss/{id}` pra qualquer logado, então dá pra assinar direto.
  Medido: **2 telas abertas por 1h com 20 ataques = 80 leituras**, contra **4.320** consultando
  de 5 em 5s — e a barra anda no instante em que o outro bate, não até 5s depois.
- **O top 10 fica pronto em `globalBoss/mewRank`**, reescrito a cada ataque (best-effort, fora
  da transação). É o que faz a leitura custar 1 em vez de 10 e o que permite escutar o ranking.
  Mora num documento SEPARADO de propósito: o do Mew já é disputado por todo ataque, e o limite
  é ~1 gravação por segundo por documento — somar outra ali pioraria o ponto mais quente da raide.
  `bossRanking()` cai na consulta viva se o documento ainda não existir.
- O **polling de 5s continua no código como rede de segurança**: se a escuta não subir (regra,
  rede, navegador), o `onSnapshot` chama o callback de erro e a tela cai pro laço. Ficar em
  silêncio seria pior — a tela pararia de andar sem nada explicando.
- Dois cuidados da tela: **só redesenha se algo mudou** (assinatura de hp+batalhas+ranking), e
  **com a lista de times aberta não redesenha nunca** — atualiza a barra direto no DOM, porque uma
  linha nova no ranking empurraria os cards no instante do toque. Mesma regra das animações.
- `tools/test-boss-tela.js` exercita isso fora do navegador: o `onSnapshot` do sandbox passou a
  **guardar os callbacks** em vez de devolver um noop, então dá pra disparar "outro treinador
  bateu" na mão e ver a tela reagir. O sandbox também ganhou `functionsClient` — ele nasce num
  `<script>` separado da página, que o sandbox não carrega, e sem ele qualquer tela que chame uma
  Cloud Function derrubava o teste com um ReferenceError sem relação com o que estava sendo testado.
- **Top 10 por dano**, mesma marcação dos rankings das ligas (`leaderboard-list`). O nome do
  treinador fica **gravado no documento do jogador** e é atualizado a cada ataque: sem isso o
  ranking custaria 10 leituras extras em `users/` toda vez que alguém abrisse a tela. O preço é
  que quem troca de nome só aparece com o nome novo depois do próximo ataque.
  (`tools/fake-firestore.js` ganhou `orderBy` de verdade por causa disto — era um no-op, então um
  teste de ranking passaria sem conferir ordem nenhuma e o `limit(10)` cortaria dez QUAISQUER.)
- Em aberto, não implementado: **limite de ataques por jogador** (hoje é livre — sem isso, uma
  conta sozinha derruba a raide em ~399 ataques) e o que acontece depois que ele cai (hoje fica
  derrubado e a tela diz isso; não renasce no domingo seguinte).

## Conquistas

- **O time da vitória da Elite fica CONGELADO no save** (`eliteWinTeam`, gravado no instante em que
  a final é vencida). É o mesmo motivo do `eliteDittoWin`: o time do save continua mudando depois
  (o Mewtwo emprestado entra por 24h), e as conquistas de COMPOSIÇÃO mentiriam nos dois sentidos —
  dariam a conquista pra quem montou o time depois de campeão e tirariam de quem venceu e trocou.
  As conquistas que já liam `eliteTeams` (Venusaur, Charizard, lendário, sem lendário…) passaram a
  usar o congelado também; **save campeão anterior ao campo cai no time atual**, que é como sempre
  foi, pra ninguém perder o que já tinha.
- **O CAMINHO da jornada sai do `gymPath`** (uma região por etapa), que não muda mais depois da
  jornada — não precisa congelar nada. Save anterior à bifurcação não tem o campo e conta como oito
  de Kanto: naquele tempo só existia Kanto, e é o mesmo padrão do `regiaoDaEtapa`.
- Dez conquistas entraram em 31/08/2026: **Puro Kanto**, **Puro Johto** e **Entre Dois Mundos**
  (4+4) pelo caminho; **Turma dos Clássicos** (time todo de Kanto), **A Nova Geração** (todo de
  Johto) e **Especialista Absoluto** (todos com um tipo em comum — num time de tipagem dupla basta
  existir UM tipo que todos tenham) pela composição; **De Primeira** (vencer a Elite sem gastar
  tentativa — `eliteAttemptsUsed` só conta derrotas, então zero é passar direto); e três que Johto
  tinha deixado em aberto: **Pokédex de Johto**, **As Três Bestas** e **Mar e Céu** (Lugia e Ho-Oh).
  `tools/test-conquistas.js` monta o save de cada caso e confere que cada uma acende SÓ quando devia
  — conquista que nunca acende é o defeito mais silencioso do jogo, porque ninguém consegue reclamar
  do que não viu.

## Lista de amigos

- Amizade é **mútua e por aceite**, gravada nos DOIS lados (`users/{a}/friends/{b}` e o espelho).
  Duplicar é de propósito: ler "meus amigos" vira uma consulta só. O preço é que remover apaga
  dois documentos — e `removeFriend` apaga os dois mesmo que um já não exista, que é o conserto de
  uma amizade que ficou pela metade.
- **Pedidos cruzados viram aceite direto.** Se A pede pra B e B pede pra A, o segundo pedido firma
  a amizade em vez de abrir outro pendente. Sem isso os dois ficariam esperando o aceite um do
  outro e nada na tela explicaria por quê.
- **O retrospecto NÃO mora na amizade.** Fica em `rivalries/{par}`, escrito por `battleApplyStats`
  pra TODA batalha online. Se ficasse no documento de amizade, desfazer e refazer zeraria o
  histórico, e quem vira amigo depois de já ter batalhado começaria em 0×0 — que é mentira.
- **Presença não tem batimento.** `touchLastSeen` pega carona nas chamadas que já acontecem
  (`getMyNotifications`, lobby, fila), com folga de 5 minutos. Por isso "agora há pouco" na tela
  cobre 10 minutos e não 1: um batimento a cada 4s como o do lobby custaria ~21 mil escritas por
  jogador ativo por dia. Se um dia precisar de "online agora" de verdade, esse é o custo a pagar.
- **O desafio de amigo é assíncrono** (3 min), ao contrário do desafio do lobby (15s): o amigo pode
  estar em qualquer tela. O que impede uma batalha contra aba fechada é o `aliveAt` — o desafiante
  renova enquanto a tela dele está aberta, e o aceite recusa se o carimbo estiver velho. Melhor
  recusar na hora que criar uma batalha que morre por inatividade minutos depois.
- Batalha nasce em `montarBatalhaOnline()`, usada pelos DOIS caminhos (aceite do lobby/fila e
  aceite de desafio de amigo). Duas cópias desse objeto divergiriam num campo — foi o que já
  aconteceu com `specialties` no desafio do lobby.
- `searchTrainers` busca por `trainerNameLower`, campo que **não tem backfill**: cada conta ganha
  na primeira vez que passa por `touchLastSeen`. A segunda consulta (`trainerName ==` exato) é a
  rede de segurança pra quem ainda não abriu o jogo depois do deploy.
- **O desafio avisa em qualquer tela**: um laço solto consulta a cada 10s e levanta modal com som
  e vibração (`agendarAvisoDesafio`). Ele vai com **`passivo:true`**, que impede o servidor de
  renovar o `aliveAt` — senão o próprio aviso manteria vivo o desafio de quem desafiou e saiu da
  tela, que é exatamente o que o `aliveAt` existe pra evitar. Aceitar continua sendo na tela de
  amigos: é lá que estão o cronômetro e o "quem é esse treinador".
- 10s e não 3s como na tela de amigos: esse laço roda o tempo todo, pra todo jogador com o jogo
  aberto. 3s custaria 4× mais leitura o dia inteiro pra ganhar 7 segundos num prazo de 3 minutos.
- O áudio do aviso é liberado no **primeiro clique em qualquer lugar** do jogo. Navegador só
  destrava som a partir de um gesto, e quem é desafiado pode nunca ter passado pela busca de
  oponente (o único lugar que destravava antes) — aí o aviso chegava mudo.
- **`pararPollDesafio()` derruba o cronômetro junto.** Quem só quer parar a consulta tem que
  limpar apenas o `friendChallengeTimer`: `agendarPollDesafio` chamava a função inteira a cada 3s
  e congelava a contagem do card na primeira volta.
- `escJs()` escapa as DUAS camadas (string JS e atributo HTML). Antes escapava só a aspa simples,
  e como nome de treinador não filtra caractere nenhum (só corta em 20), um `Ash" onmouseover=…`
  fechava o atributo e executava. Quem chamar `escJs` **não deve** passar `escapeHtmlSafe` por
  cima: escaparia o `&` das entidades de novo.

## AS 28 FORMAS DO UNOWN (16/09/2026)

Pedido assim: *"implemente as sprites de todas as letras do alfabeto do unown"*, com o
`pokemondb.net` como fonte sugerida e um *"verifique se dá certo usar desse site"*.

**O Unown é a única espécie do jogo com mais de um sprite** — no original ele tem 28 formas (as 26
letras mais `?` e `!`), e até aqui todos os Unown do jogo apareciam com o MESMO desenho: o da
**letra A**, que é a forma padrão da espécie.

### ⚠️ A FONTE NÃO É O pokemondb, E O MOTIVO NÃO É ELE SER RUIM

O site foi testado como pedido, e **ele funciona**: `img.pokemondb.net` responde **200** com o
`Referer` do jogo, `Content-Type: image/png`, sem proteção de hotlink, atrás da Cloudflare e com
`Cache-Control: public, max-age=2592000`.

**Ele não foi usado porque o repo que o jogo JÁ USA tem as 28 formas.** O `PokeAPI/sprites` as traz
como **`201-<letra>.png`**, no MESMO CDN (`cdn.jsdelivr.net`) e com o MESMO domínio de fallback
(`raw.githubusercontent.com`) das 250 espécies. Com isso elas herdam **de graça**:

- a repetição do `handleSpriteLoadError` (2 tentativas, 500ms e 1200ms),
- a troca automática pro domínio alternativo,
- e o emoji de último caso quando os dois falham.

Um host novo teria que ganhar tudo isso de novo — e a regra da casa sobre imagem de fora nasceu de
**dois episódios de hotlink que funcionavam local e morriam publicados** (ver `GYM_BADGE_VISUALS`).
De quebra o sprite do PokeAPI é **96×96**, o mesmo das outras 250; o do pokemondb é 80×80, ou seja
o Unown apareceria menor que o resto do bestiário.

**Conferido, e não por amostragem:** as **84 URLs** que o próprio jogo gera (28 formas × normal +
shiny + fallback) foram batidas uma a uma — **84 de 84 respondem 200** com imagem de verdade. E no
navegador, a 320px, as **28 desenham e carregam** (`naturalWidth > 0`), todas 96×96.

- **⚠️ A LETRA A NÃO TEM ARQUIVO PRÓPRIO:** ela é a forma PADRÃO da espécie, ou seja o `201.png` de
  sempre — **o `201-a.png` responde 404**. É por isso que o sufixo dela é vazio, e é isso que faz
  save antigo, código de time e NPC continuarem mostrando EXATAMENTE o que mostram hoje. Há trava
  só pra isso: é o tipo de simetria que alguém "arruma" e quebra a forma mais comum do jogo.
- **A tabela vive SÓ NO CLIENTE**, como o `MOVE_BY_TYPE` e o `TIPO_DO_ESPECIAL`: é apresentação
  pura. A letra **não muda um ponto** de atributo, de tipo ou de dano — o motor não sabe nem
  precisa saber qual é.

### ⚠️ O `spriteHtml` PASSOU A ACEITAR A INSTÂNCIA, E ISSO FOI A DECISÃO ESTRUTURAL

Ele tem **72 chamadores**, e em **45** deles os dois primeiros argumentos já saíam do **MESMO
objeto** (`spriteHtml(p.speciesId, 'sprite-sm', p.shiny)`). Então passar o objeto **não acrescenta
parâmetro nenhum**: troca `p.speciesId` por `p`, e a letra (e o shiny) vêm junto.

Era isso ou um **QUINTO parâmetro posicional em 45 lugares** — que é exatamente a forma de defeito
que este projeto mais paga: o próximo chamador nasce sem ele e ninguém vê, porque o sprite continua
saindo certo pras outras 249 espécies.

- **Os 27 chamadores de id solto ficaram intactos, e isso é necessário — não é compatibilidade:** a
  prévia da evolução (`spriteHtml(destino, ..., p.shiny)`) desenha de propósito uma espécie
  **DIFERENTE** da do pokémon, e o disfarce do Ditto desenha o Mew.
- Por isso o **shiny explícito ganha do da instância**: sem essa precedência, a prévia da evolução
  perderia o brilho do pokémon que está evoluindo.
- `tools/test-jornada.js` **lê o código** e falha se algum chamador voltar a passar `X.speciesId`
  junto com `X.shiny` — ali a letra se perde em silêncio.

### ONDE A LETRA NASCE, E POR QUE ELA É SEMEADA

Ela é um campo da INSTÂNCIA (`p.unown`), como o `shiny`, e vai pro save de graça — o `team` é
serializado inteiro.

- **NA OFERTA SELVAGEM, uma linha depois do sorteio do shiny.** Duas razões se somam: **(1)** aquele
  bloco é **SEMEADO** (o `goToWildEncounter` troca o `Math.random` por um rng preso ao contador de
  encontros do save), então **sair do save e voltar devolve A MESMA letra** — sem isso o jogador
  re-sortearia até vir a que ele quer; **(2)** é uma linha **depois de tudo**, como a do shiny, então
  o pool, o raro da rota, a pré-evolução de inicial e a rede dos intocáveis já passaram e nenhum
  caminho novo escapa por esquecimento.
  **E é isso que faz o jogador VER qual forma está pegando antes de escolher** — que é o que faz a
  letra valer alguma coisa. Medido: 400 sementes cobrem **as 28 formas**.
- **NA VIGÍLIA**, com o rng **dela**, não com `Math.random`: a vigília é gravada no save (a clareira
  e a tela do prêmio são pontos de gravação), e o prêmio pode virar pokémon do jogador — com
  `Math.random` a letra mudaria entre montar a clareira e escolher o prêmio.
- **SÓ O UNOWN GANHA O CAMPO.** Um `o.unown` em toda entrada seria lixo em 249 espécies.

### ⚠️ E ELA TEM QUE SOBREVIVER AOS CLONES

O `createInstance` **não copia campo nenhum** — a armadilha que o `shiny` já custou **três vezes**
neste projeto, nos mesmos três lugares. Todo lugar que recola o shiny passou a recolar a letra: o
desafio do **Ginásio da Cidade**, a **Vigília**, a batalha por **código de treinador** e o desafio do
**Mewtwo**. O teste varre o código atrás de clones que recolem `.shiny` e **não** recolem `.unown`.

### O QUE FICA EM A, E É DECISÃO

- **Save antigo, código de time (liga e online) e NPC da Torre.** O código de time é
  `especie:nivel:shiny` e não carrega letra **por construção** — mexer nisso é mexer na trava
  anti-falsificação. O NPC da Torre é montado no servidor, que não conhece letra nenhuma.
  Nos três a letra fica indefinida, e indefinida quer dizer **a forma padrão**: o Unown A de sempre,
  byte a byte a mesma URL de antes desta feature.
  ⚠️ O Unown **está** no pool da Torre (ele não evolui, então conta como evolução final), então
  Unown de NPC sai sempre A. Se um dia isso incomodar, o caminho é o servidor mandar um índice
  0–27 junto do time — e não uma segunda regra de sorteio no cliente, que divergiria da primeira.
- **A Pokédex e a tela "Pokémons desta rota" mostram A**, e é o certo: ali a pergunta é sobre a
  ESPÉCIE, não sobre um bicho. **Quem responde "quais formas EU já vi" é a tela de Variações**, na
  ficha dele — ver a seção própria, logo abaixo.
- **O nome continua "Unown"**, sem a letra. No original é assim, e o glifo já é a identidade.

`tools/test-jornada.js` tranca 37 pontas: a tabela, os sufixos (com a letra A explicitamente vazia),
as URLs nos dois domínios, a letra não vazando pra outra espécie, o `spriteHtml` com instância e com
id, a precedência do shiny explícito, a semente (mesma semente = mesma letra, 400 sementes = 28
formas), a captura levando a letra, o save e a reidratação, a Vigília e o prêmio dela, e os clones.
**Conferido que cada um dos sete defeitos religado derruba o teste** — inclusive o `201-a.png`.

### AS VARIAÇÕES DO UNOWN (17/09/2026)

Pedidas assim: *"o card do Unown na pokedex é diferente, quando clicar no card vai aparecer um botão
com o nome: Variações, e quando clicar, vai abrir mais um modal com todas as formas de unown (as
letras) em formato igual da Pokedex, com vários quadradinhos, e somente exibe a letra do unown que
já foi pego ... se o treinador só pegou o Unown das letras G e O, só esses cards que ficam visíveis,
os outros ficam igual na pokedex, exibindo apenas #A, #B e assim vai"*.

- **ELA REUSA A GRADE E A CÉLULA DA POKÉDEX** (`pokedex-grid` / `pokedex-cell`), e isso é o pedido ao
  pé da letra. Reusar as duas classes é o que faz a leitura ser a mesma: quem já sabe ler a Pokédex
  sabe ler esta sem reaprender — letra pega mostra o sprite, letra que falta mostra o rótulo apagado.
- **⚠️ E O RÓTULO É `#A`, NÃO `#201`.** Aqui o que distingue uma célula da outra é a **LETRA**, e 28
  quadradinhos escritos "#201" não diriam nada.
- **⚠️ ELA É O PRIMEIRO DADO DE POKÉDEX QUE NÃO É POR ESPÉCIE.** As 28 formas são o MESMO #201, então
  o `pokedexCaught` **nunca as distinguiu** — nem tinha por que. A lista nova (`pokedexUnown`) vive
  no documento da CONTA, ao lado da Pokédex, e como ela é **livre pro dono** no `firestore.rules`:
  é registro de coleção, não poder de compra.
- **⚠️ ELA É GRAVADA COM `arrayUnion`, NUNCA REESCREVENDO A LISTA.** É a lição que já custou 49
  espécies da Pokédex de um jogador: um read-modify-write aqui poderia **ENCOLHER** a coleção se a
  leitura viesse atrasada. (O `tools/fake-firestore.js` aprendeu `arrayUnion` por causa disto.)
- **O PONTO DE ESCRITA É O `markCaught`, e ele ganhou um TERCEIRO argumento opcional.** É a única
  porta por onde uma captura passa; as outras 249 espécies chamam sem o argumento e continuam
  idênticas. Os dois pontos que capturam (o encontro selvagem e o prêmio da Vigília) passam a letra.
- **⚠️ E HÁ UMA REDE DE SEGURANÇA NO CARREGAMENTO DA CONTA:** além do registro feito na captura, ela
  varre os TIMES atuais atrás de Unown com letra. Ela recupera quem capturou um Unown **antes** deste
  campo existir — e tem o mesmo limite do Pokédex shiny: um Unown já liberado pro Prof. Carvalho não
  deixou rastro da letra em lugar nenhum, então aquele não volta.
- **O `unownCaught` ENTROU NO `CAMPOS_DA_CONTA`**: sem isso o `resetGame` o apagaria ao abrir um
  save, e a tela ficaria vazia pra quem tem mais de um.
- **O BOTÃO SÓ EXISTE NO UNOWN.** Ele é a única espécie com mais de uma forma, e um "Variações" nas
  outras 249 abriria uma tela de uma célula só.
- **⚠️ O MODAL É ANEXADO DEPOIS DA FICHA no `render`**: os modais empilham na ordem em que entram, e
  este é aberto de DENTRO dela — vindo antes, abriria ATRÁS. É a mesma nota que a caixa do especial e
  a própria ficha já carregam.
- **Medido a 320px, no navegador:** 28 células, 5 por fileira, 6 fileiras, célula de **41px**, modal
  de **280×483px**, sem rolagem lateral (o `max-height:85vh` faz a grade rolar por dentro quando
  precisa).

## Mapa de Kanto

- SVG desenhado no próprio arquivo, **nenhuma imagem de fora**. Já houve dois episódios de imagem
  hotlinkada que funcionava local e morria publicada (ver `GYM_BADGE_VISUALS`).
- **Só o caminho já percorrido é desenhado**, mais o trecho atual pontilhado. Desenhar a jornada
  inteira virava espaguete: o trajeto real de Kanto se cruza várias vezes (Celadon → Fuchsia →
  Saffron → Cinnabar → Viridian) e num celular isso lia como rabisco. A visão linear do que falta
  é a **trilha de insígnias** (`kantoTrailHtml`), que é outra coisa e fica em outro lugar da tela.
- `game.routeHistory` guarda a rota escolhida por trecho. **Nasceu como estado de exibição** e
  desde 11/09/2026 tem UM leitor de regra: a condição do **HM01** (ver a seção dos HMs). Se ele
  deixar de ser gravado, o HM01 fica inalcançável sem erro nenhum — e é por isso que o teste de lá
  cobra o par (rota gravada + HM ganho).
  `currentRoute` sozinho não servia: ele é sobrescrito no trecho seguinte, e o mapa perdia a
  memória de por onde a pessoa passou. Save antigo sem o campo desenha normal, só sem o passado.
- Cada lugar tem um `lp` (posição do rótulo). Com todos em cima, "Saffron City" caía sobre o ícone
  da rota e "Vermilion City" sobre a linha do trecho. Os nomes usam halo (`paint-order:stroke`),
  não caixinha: 11 caixas por trás dos nomes somem com o mapa.
- Cidade não descoberta é um ponto **pequeno**. Com o mesmo raio das outras, a abertura da jornada
  mostrava nove círculos escuros e o mapa parecia furado.
- A trilha vive FORA de qualquer `.box`, direto sobre o fundo escuro — por isso a legenda usa tons
  claros. Com `var(--muted)`/`var(--ink)` ela sumia no próprio fundo.
- Mexer numa coordenada de `KANTO_PLACES` move a cidade **e** as linhas do trajeto, que saem dali.
  `node tools/test-mapa.js` confere que toda cidade continua dentro da moldura e que o mapa não
  revela cidade antes da hora — os dois erros que somem em silêncio.

## Conta e login

### JOGAR SEM CRIAR CONTA: O CONVIDADO (23/09/2026)

Pedido assim: *"faça na tela de login um meio de poder jogar mas sem criar conta ... quando o
usuario clicar nos botoes para jogar a torre dos treinadores, ligas classicas, ilhas laranjas,
batalhas onlines e ginasio da cidade, ele só vai conseguir ver o que é ... E adicionar um botao
vermelho do lado do nick dele com o texto: 'Criar Login' ... E após ele se cadastrar, mantem os
times que ele montou nessa conta. Seria possivel isso? Visto que a Jornada usa muito o banco de
dados"*.

#### ⚠️ É POSSÍVEL JUSTAMENTE PORQUE ELA USA O BANCO — e essa é a resposta da pergunta

A **sessão anônima** do Firebase dá um `uid` de verdade, com documento em `users/{uid}` e
subcoleção `saves/` como qualquer outra conta. Ou seja **o convidado já grava no lugar CERTO desde
o primeiro clique**. Quando ele se cadastra, o `linkWithCredential`/`linkWithPopup` **PRESERVA O
MESMO UID**: a conta troca de MÉTODO DE LOGIN, não de dono.

**⚠️ ENTÃO NÃO HÁ MIGRAÇÃO DE DADOS, e é isso que torna a feature segura.** O caminho que a
pergunta teme — guardar no `localStorage` e copiar depois — é que seria arriscado: são 20 slots,
uma subcoleção por save e um formato que já mudou várias vezes; copiar isso à mão perderia coisa em
silêncio, e este projeto **já perdeu 49 espécies da Pokédex de um jogador** por uma escrita de
lista que encolheu. Aqui nada é copiado: **os bytes nunca saem do lugar**.

**CONFERIDO NO SDK que o jogo carrega** (`firebase-auth-compat.js` **10.7.1**, baixado e lido — a
lição do `count()`, que o CLAUDE.md registra como ausente no compat): `signInAnonymously`,
`linkWithPopup`, `linkWithCredential` e `isAnonymous` **estão todos lá**.

#### ⚠️ MAS BLOQUEAR OS BOTÕES NÃO BLOQUEIA NADA — e esse é o achado que organizou o trabalho

**O convidado é um `request.auth` de verdade.** Ele passa em `request.auth != null` — que era, até
aqui, a **única** pergunta que as regras e as **81 callables** faziam. Ligar a sessão anônima e
confiar na tela daria a ele escrita na **agenda da Liga**, no **chaveamento** e nos **inscritos**.

**SÃO TRÊS CAMADAS, e nenhuma substitui a outra:**

| | protege | por que ela não pode faltar |
|---|---|---|
| **o CLIENTE** recusa na porta | a UX pedida | é ela que mostra o modal que diz o que o modo é |
| **as REGRAS** recusam a escrita | **a Liga Clássica** | ⚠️ a inscrição dela é **ESCRITA DIRETA DO CLIENTE** (`registerForLeague` mora no `index.html`, não nas functions) — **não existe callable pra guardar**, a trava só pode estar ali |
| **as CALLABLES** recusam | Torre, Ginásio, online, Ilhas | callable é chamável direto do console, sem passar por tela nenhuma — é a mesma razão do `bossRequireTester` |

**O `sign_in_provider` é quem responde**, nos dois lados. Ele vem **dentro do token emitido pelo
Firebase Auth**, não de um campo do documento — e é isso que o faz servir de trava: o cliente não
tem como escrevê-lo. Pra sessão anônima ele vale exatamente `'anonymous'`.

#### ⚠️ A GUARDA DO SERVIDOR NÃO LÊ O BANCO — e é isso que permite pô-la em 39 callables

O `exigeAdmin`, que é o precedente, **paga uma leitura por chamada** (o campo `admin` mora no
documento). O `exigeCadastro` não: o dado já está no token. **Custo ZERO**, e por isso ela cabe nas
39 sem pesar em nada.

#### ⚠️ E NÃO DÁ PRA FILTRAR AS CALLABLES POR NOME

`reportMewtwoBattleResult` tem **"Battle"** no nome e é o desafio do Mewtwo, que sai da **Pokédex**
— jogo principal. E três que um grep pegaria são chamadas **de fora dos modos**:

| | quem chama | o que aconteceria se fosse bloqueada |
|---|---|---|
| `getMyActiveGymDefenses` | **a HOME**, em toda abertura | erro no console toda visita |
| `checkNeighborhoodGymDefenseForSlot` | o **apagar save** | idem |
| `vacateNeighborhoodGymForDeletedSave` | idem | idem |

As três devolvem vazio pro convidado **por construção** — ele nunca lidera ginásio, porque o
`setNeighborhoodGymDefense` está preso.

**A classificação é por ESCRITO, em duas listas** (39 protegidas / 42 livres), e o que a trava
cobra é que a **união seja TODAS as 81**: uma callable nova cai fora das duas e fica barulhenta. É
o molde do `prateleiraDoItem` (*"todo comprável aparece em exatamente uma"*).

#### O QUE O CONVIDADO JOGA

**A jornada inteira** — captura, ginásios, evolução, Elite 4, Pokédex, conquistas, moedas, loja,
Mewtwo. Tudo isso é `users/{uid}` e `users/{uid}/saves/*`, que **continuam livres pro dono**:
fechar isso seria fechar o jogo pra ele. Ele passa pela mesma tela de nome de treinador
(`exigeNomeDeTreinador`), que já funcionava sem uma linha nova — e é dela que sai o **nick** ao
lado do qual o pedido quer o botão.

#### ⚠️ O MODAL É QUEM MOSTRA "O QUE O MODO É" — e a alternativa foi descartada com motivo

A outra leitura seria deixar a **TELA** do modo abrir e ficar inerte. Ela cai porque aquelas telas
**chamam o servidor ao abrir**: a Torre gera a torre do dia, o Ginásio pede a geolocalização, o
online entra na fila. Com o servidor recusando, o convidado veria **cinco telas quebrando com
erro** em vez de descobrir o que o modo é.

A frase de cada modo mora numa **tabela** (`CONVIDADO_MODOS`), e não escrita em cada botão: escrita
em cada um, o sexto modo nasceria com a recusa **muda** — a família de defeito do
`CLASSE_DO_BANNER` (três contextos caindo numa string vazia) e das seis portas das Ilhas.

#### ⚠️ O BOTÃO NÃO COUBE AO LADO DO NICK, E O NÚMERO É BRUTAL

O pedido diz *"do lado do nick"*. **Medido a 320px** (o alvo da casa), com os três na mesma linha:

| | largura |
|---|---|
| o quadro do nick | 101px |
| **o NOME DO TREINADOR dentro dele** | **0px** |

**Ele sumia inteiro** — a moeda ao lado é `flex-shrink:0` e comia o que sobrava. E a linha
continuava **PARECENDO certa**: o quadro, a moeda e o botão apareciam. É exatamente a família do
nome que sumiu no card da Máquina (16/09): **medir a dimensão errada dá verde num defeito que se vê
no primeiro print** — a primeira medição olhou `nomeCortado` e não a LARGURA.

**Encolher o botão não resolve:** medido em 72 / 64 / 58 / **52px** (já ilegível), o nome ainda
cortava — ele ganhava 57 de 58.

**⚠️ E O `flex-wrap` FOI TENTADO E É PIOR:** ele quebra na **ordem do DOM**, então quem descia era
o **SINO** — sozinho numa linha, desalinhado. (A 320px o `min-width:165px` no nick fazia o botão
descer, mas só porque ele estava antes do sino; com o sino no meio a conta desanda.)

**Hoje ele é uma LINHA PRÓPRIA, colada embaixo do nick.** Um comportamento só, em toda largura, vale
mais que um arranjo esperto que funciona em algumas. Medido depois, a **320 e a 390**: nick e sino
na mesma linha, **nome inteiro (58 de 58)**, botão de 281px abaixo, **sem rolagem lateral**.

#### ⚠️ A CONTA QUE JÁ EXISTE É O ÚNICO CASO EM QUE "MANTÉM OS TIMES" NÃO VALE

Se o e-mail (ou a conta Google) já pertence a outro uid, o Firebase recusa o vínculo
(`credential-already-in-use` / `email-already-in-use`) — e **entrar naquela conta abandonaria o
progresso de convidado, sem volta e sem aviso**. Então a recusa **diz isso**, em vez de oferecer um
caminho que perde dado em silêncio. Há trava cobrando que ela **não** ofereça "entrar assim mesmo".

#### O QUE ISSO CUSTOU AO JOGO: NADA

**`MOTOR d19915312988 / DIARIO 741ec5a626c3`, idêntico** em 900 batalhas semeadas. Bateria: **38 de
38**. E os **19 defeitos religados acusam** (1 a 3 falhas cada).

#### ⚠️ O QUE ELE PRECISA LIGAR NO CONSOLE — sem isto NADA funciona

**Authentication → Sign-in method → Anônimo → Ativar.** Sem isso o `signInAnonymously` recusa com
`auth/operation-not-allowed`, e o botão **explica o que houve** em vez de falhar calado. Não deu
pra conferir daqui: o MCP do Firebase não expõe os provedores de auth, e descobrir pela API REST
**criaria uma conta anônima de verdade na produção** — escrever no banco pra ler uma configuração
não vale a pena quando a resposta é um clique.

#### ⚠️ O QUE FICOU DE FORA, E É DECISÃO REGISTRADA

**⚠️ OS AMIGOS FICARAM DE FORA POR ALGUMAS HORAS, e ENTRARAM no mesmo dia** — ver **OS AMIGOS
ENTRARAM NA LISTA**, logo abaixo. O que esta nota apontava como decisão em aberto (*"se um dia
incomodar, são 4 nomes a mover de LIVRES pra PROTEGIDAS"*) foi exatamente o que aconteceu, e o
motivo que ela já registrava é o que sustenta a mudança: **a amizade é MÚTUA**, e um convidado que
some deixa um pedido pendente pra sempre na conta de quem é cadastrado.

**O BOSS DE DOMINGO** continua de fora — ele não está nos cinco, e o evento está **desligado**
(`BOSS_ATIVO`), então ele já recusa todo mundo.

**O `pollFriendChallenge` e o `cancelFriendChallenge`** também: o poll já não é agendado pro
convidado e o cancel é limpeza — bloqueá-los só daria erro em console sem proteger nada.

#### ⚠️ O ERRO DO ANÔNIMO DESLIGADO TINHA DOIS CÓDIGOS, E EU TRATEI SÓ UM (23/09/2026)

Reportado no primeiro teste: *"aparece a mensagem em vermelho: 'Algo deu errado. Tente de novo.' e
não sai disso"*, com o console mostrando **`auth/admin-restricted-operation`**.

**Era defeito meu, e do tipo que esta feature existia pra evitar.** Eu escrevi a mensagem
explicativa para o `auth/operation-not-allowed` — e o Identity Toolkit devolve
**`auth/admin-restricted-operation`** quando o provedor Anônimo está desligado. O jogador caiu no
genérico do `authErrorMessage`, ou seja **exatamente o "falhar calado"** que o comentário do código
prometia não acontecer.

Hoje os dois caem na mesma frase (`ehAnonimoDesligado`): eles querem dizer a mesma coisa pra quem
está na tela. **A lição é a de sempre com código de erro: um caso não é a família** — e a que pega
isso é uma trava que lista os dois por nome, porque um `catch` genérico passaria nos dois.

#### OS AMIGOS ENTRARAM NA LISTA (23/09/2026)

Pedido: *"pode colocar que nao pode adicionar amigos enquanto nao cria conta"*. Eles eram a decisão
que esta seção registrava em aberto, e a régua estava escrita aqui — foram os **4 nomes** que ela
apontava, mais quatro do mesmo ciclo. **O card Amigos virou o SEXTO modo fechado**, com o mesmo
modal.

**⚠️ E FECHAR SÓ A PORTA DELE NÃO BASTA: a amizade é MÚTUA.** Ele não pode **aceitar** pedido (o
`respondFriendRequest` está protegido) — então um pedido mandado **PRA ele** ficaria pendente **pra
sempre** na conta de quem é cadastrado. E conta anônima é descartável: basta limpar o navegador.

Por isso ele **não aparece na busca de treinadores**, e o mecanismo tem duas partes:

- **quem marca é o SERVIDOR** (`touchLastSeen` grava `anon`), porque só ele sabe — o dado vem do
  token de quem chama, e os quatro chamadores daquela função passam o próprio uid. Na prática quem
  escreve é o **`getMyNotifications`**: dos quatro, os outros três são de modos que ele não joga;
- **⚠️ E O FILTRO É NO RESULTADO, não na consulta.** Não bastava deixar de gravar o
  `trainerNameLower`: o `searchTrainers` tem uma **SEGUNDA** consulta, por `trainerName` **EXATO**
  (a rede de segurança pras contas antigas), e por ela o convidado apareceria do mesmo jeito.

**O `pollFriendChallenge` e o `cancelFriendChallenge` ficaram LIVRES**, de propósito: o poll já não
é agendado pro convidado e o cancel é limpeza — bloqueá-los só geraria erro em console sem proteger
nada.

#### ⚠️ A TRAVESSIA DAS ILHAS ABRIU PRA TODO MUNDO (23/09/2026)

Pedido junto: *"pode tirar a travessia para as ilhas laranjas serem somente para admin = true,
libere para todos"*. Era a **sétima entrada** das Ilhas — a única que ficou fechada quando as outras
seis abriram em 21/09, e que este arquivo registrava como achado no dia anterior.

**O PREÇO NA JORNADA: NADA. 53,19% sem contra 53,03% com** — **−0,16 ponto, 0,1σ** (8 blocos de 400
jornadas de cada lado, **3.200 de cada**, o MESMO bot contra duas cópias congeladas, desvio tirado
de ENTRE os blocos, **4 de 8 blocos** pra cada lado). Ruído absolutamente puro.

**E ele é zero POR CONSTRUÇÃO pra quem não tem o HM03**: a carta aparece **trancada**, como a mata
faz pra quem não tem o Corte, e o jogador escolhe entre as mesmas duas rotas de sempre.

**⚠️ O QUE ELA VALE PRA QUEM TEM O HM03 NÃO DEU PRA MEDIR COM O BOT, e é honesto dizer:** ele não
sabe jogar os cinco minigames — com `--surf` ele entra na travessia e **trava na tela das Ilhas**
(13 falhas em 40). O que dá pra medir é o **prêmio**: os **+3 níveis no time inteiro** valem
**+12,75 pontos** de vitória num 6x6 (4.000 batalhas de cada lado, mesmos times e mesmas sementes,
47,85% → 60,60%). Em troca ele abre mão do encontro selvagem daquele trecho, que são **duas**
capturas.

**⚠️ E O SMOKE GANHOU `--surf` E UM CONSERTO QUE ELE PRECISAVA ANTES DE MEDIR.** O filtro de rotas
abertas do bot conhecia `r.corte` e `r.voo` e **não conhecia `r.surf`** — com a carta destravada ele
escolheria uma rota trancada, a ação recusaria em silêncio e **a jornada travaria até o
`MAX_STEPS`**. É literalmente o defeito que o comentário do `--corte` descreve logo acima dele, e
sem o conserto o A/B teria medido jornadas travadas.

**⚠️ E A TRAVA DO GATE NÃO FOI APAGADA: ela foi VIRADA DO AVESSO.** Ela cobrava que a rota *não*
existisse sem admin; hoje cobra que ela **exista**, e que ser admin **não mude nada** no sorteio.
Sem ela, alguém reintroduz a porta e a travessia volta a ser letra morta pra 99% dos jogadores **sem
ninguém ver** — que foi exatamente o que aconteceu de 21 a 23/09. Conferido: com o gate de volta ela
acusa **8** falhas.

**⚠️ E A PRIMEIRA MEDIÇÃO DELA DEU ZERO NOS DOIS LADOS**, o que teria "provado" que abrir não muda
nada: era o **slot 0 / geração 0**, cujos oito dados dão todos acima de 0,25. É a **terceira** vez
que a amostra única engana nesta feature, e o próprio arquivo já registrava as duas anteriores —
**sorteio semeado se mede varrendo** (20 slots × 10 gerações: 20,4% dos trechos, 164 de 200 saves).



### NENHUMA JORNADA COMEÇA SEM NOME DE TREINADOR (13/09/2026)

Reportado assim: *"tem alguns usuários que estão sem nome de treinador mesmo depois de se
cadastrar, aí não sei se deu algum bug pra eles ou eles que não quiseram colocar mesmo"*.

**ERA BUG, e dá pra provar pelos dados.** Medido em produção, lendo a coleção `users` pelo MCP do
Firebase: **5 contas de 48 (10,4%) sem `trainerName`**. Três têm só o carimbo de presença
(`lastSeenAt`) — entraram e não passaram da tela. Mas **duas têm `rivalNameDefault`,
`startersSorteados`, `geracaoDosSlots` e `pokedexCaught` gravados**: elas nomearam o rival,
sortearam inicial e capturaram pokémon. **Se a pergunta fosse mesmo obrigatória, esse estado não
existiria.**

- **⚠️ A CAUSA ERA A TELA DE NOME SER UM REMENDO DEPOIS DO CARREGAMENTO.** Ela era decidida no
  `.then()` de um `Promise.all` que carrega saves, pokédex, especialidades, ranking, notificações e
  uma callable — e a home **já estava na tela e clicável** esse tempo todo. Quem clicasse num slot
  nessa janela criava a jornada inteira sem nunca ver a pergunta. Numa rede lenta, ou com uma
  Cloud Function em cold start, a janela são segundos.
- **A GUARDA FOI PRO COMEÇO DA JORNADA** (`exigeNomeDeTreinador`, nos três caminhos:
  `startNewSave`, `continueSave`, `continueCompleteSave`), e não na home. É ela que vale por mais
  rápido que seja o clique, e é ela que continua valendo se alguém acrescentar outro caminho pra
  começar a jogar. O remendo do `Promise.all` **fica**, como rede — perguntar assim que dá pra
  saber é melhor que deixar a home parecendo pronta.
- **⚠️ ENQUANTO A CONTA NÃO FOI LIDA, A GUARDA NÃO BLOQUEIA** (`contaCarregada`, escrita no fim do
  `loadPermanentUserData`). Ela não tem como AFIRMAR que a conta está sem nome antes da leitura, e
  mandar pra tela de nome quem JÁ TEM seria trocar um defeito por outro. É o mesmo cuidado do
  `saveSlotsCarregados` na porta dos modos de campeão — e o campo entrou no `CAMPOS_DA_CONTA` pelo
  mesmo motivo que ele: sem isso o `resetGame` o apagaria ao abrir um save.
- **⚠️ E A ESCRITA DO NOME NÃO ERA CONFIRMADA.** O `confirmAccountSetup` navegava pra home NA HORA e
  mandava a gravação atrás, com um `console.error` como único tratamento. **`set()` resolvendo não
  quer dizer que salvou** — sem rede ele vai pra uma fila em memória que morre com a aba, e é a
  lição que o salvamento do jogo já carrega (ver `CONFIRMA_SAVE_MS`). Aqui ela vale mais: o nome é
  escrito **UMA vez na vida da conta**, então uma falha silenciosa ali fica pra sempre.
  Hoje ele grava, espera o `waitForPendingWrites` e **só então** navega; sem confirmação, ele fica
  na tela e diz o que houve.
- **O QUE NÃO FOI MEXIDO:** as três contas que só têm `lastSeenAt` continuam sem nome — não dá pra
  saber se elas viram a tela e desistiram ou se bateram na janela. Elas serão perguntadas na
  próxima vez que abrirem o jogo, agora sem escapatória.
- `tools/test-conta.js` tranca os três caminhos, o caso da conta ainda carregando (que NÃO pode ser
  mandada pra tela de nome), e **lê o código** pra cobrar que a guarda está nas três portas e que a
  escrita espera a confirmação antes de navegar.


- **O rival padrão mora na CONTA** (`users/{uid}.rivalNameDefault`), não no save: a tela de nome do
  rival já vem preenchida com ele, e trocar ali troca o padrão das próximas jornadas. Não existe
  outra tela pra editar, de propósito — o lugar natural de mexer no nome do rival é a tela que
  pergunta o nome do rival. A precedência é conta → rival de um save que já exista → o
  `RIVAL_NAME_DEFAULT` do jogo. O passo do meio é pra conta anterior ao campo: oferecer "Rafael"
  pra quem tem rival há três jornadas seria pior que aproveitar o que já está lá (save não tem
  carimbo de tempo, então é o primeiro slot que tiver um). O campo precisa estar em
  `CAMPOS_DA_CONTA`: sem isso o `freshGameDefaults()` de dentro do `confirmNewSaveName` o apaga no
  meio do caminho. A gravação é best-effort — se falhar, a jornada não para, o nome já está no save.
- **"Esqueci minha senha" é um MODO da mesma caixa** (`authMode: 'login' | 'register' | 'reset'`), e
  não uma tela nova: o campo de e-mail é o mesmo e o de senha some — pedir senha na tela de
  "esqueci a senha" faz a pessoa achar que clicou no botão errado. O e-mail digitado atravessa a
  troca de modo (`game.authEmail`) e sobrevive ao erro: antes, errar a senha redesenhava a tela e
  apagava o e-mail junto.
- **E-mail desconhecido NÃO vira erro na tela.** O Firebase devolve `auth/user-not-found`, e
  repassar isso transforma o formulário num oráculo — dá pra descobrir quem tem conta no jogo
  testando e-mails um a um. A resposta é a mesma nos dois casos, e `tools/test-conta.js` tranca
  isso (com o defeito, a tela chega a responder "E-mail ou senha incorretos" a quem só digitou um
  e-mail).
- O link do e-mail abre a página do **próprio Firebase** — o template fica no console, em
  Authentication → Templates, e não há nada pra guardar do nosso lado. O `continue URL` que traz a
  pessoa de volta pro jogo só é aceito se o domínio estiver nos autorizados do Auth, e o SDK recusa
  a chamada INTEIRA quando não está: daí a segunda tentativa sem ele. Melhor um e-mail sem link de
  volta do que e-mail nenhum.
- **Sair da conta devolve o formulário ao estado inicial** (modo, erro, recado e e-mail). Sem isso
  quem saiu com a tela em "criar conta" reencontrava aquele formulário no lugar do login, e o
  e-mail da conta anterior ficava preenchido num aparelho que pode não ser só dele.

## O CICLO QUE PERDIA O SAVE (11/09/2026)

Relatado assim: *"constantemente fica aparecendo aquela mensagem vermelha no save e realmente não
salva o progresso, por que que ta acontecendo isso? Outros usuários relataram o mesmo problema."*
A tarja dizia **`Maximum call stack size exceeded`**, que é um `RangeError` — não um erro de rede.

- **A CAUSA: o motor pendura REFERÊNCIAS ao pokémon adversário na instância do time, e o
  salvamento é recursivo.** São dois marcadores de confronto: o `_especialContra` (com quem foi o
  último confronto, comparado por IDENTIDADE — é ele que faz o golpe especial sair uma vez só) e o
  `_anulado`, que guarda `{ tipo, contra }` — e o `contra` também é um pokémon.
  Quando o adversário aponta de volta, os dois fecham um **CICLO**:
  `team[3]._especialContra → _anulado.contra → team[3]`. O `limparParaFirestore` desce campo a
  campo sem guarda nenhuma, então ele descia pra sempre e morria na pilha.
- **MEDIDO: os campos sobram em 100% das batalhas e o ciclo se fecha em 3% delas.** Ou seja, mais ou
  menos **uma batalha em trinta perdia o save inteiro** — o que bate com o "constantemente" do
  relato, e com ser vários jogadores.
- **E o custo silencioso era maior que o erro:** sem o ciclo, o save ainda gravava um **pokémon
  adversário INTEIRO por membro do time** dentro do documento. Ninguém veria isso como defeito.
- **O CORTE É NA CAMADA DO SAVE: campo que começa com `_` não vai pro Firestore.** Podia ser só a
  limpeza de fim de batalha, e ela também foi feita — mas o corte aqui é o que faz o PRÓXIMO
  marcador de motor nascer protegido. O `_` já era a convenção de rascunho do projeto inteiro
  (`_furia`, `_anulado`, `_especialContra`, `_itemGastoAnotado`, `_dormindoPor`), e nenhum deles
  tem por que ser gravado.
- **O `encerrarBatalha` É A OUTRA METADE, e ele nasceu porque a saída da batalha tinha DUAS portas.**
  A devolução do teto de HP da Fúria vivia num bloco solto antes do `return` da vitória, e o
  `return` da DERROTA passava por cima dele. **Medido: 983 pokémon de 3.000 saíam de uma derrota com
  o teto de vida errado (até +30), contra ZERO nas vitórias** — e como o `_furia` é zerado no começo
  da batalha seguinte, o teto inflado deixava de ter de onde ser recalculado e ficava errado pra
  valer, inclusive no save e na barra da tela de time. Isto é exatamente o defeito que o próprio
  CLAUDE.md descrevia ("saía da luta com o teto +30 pra sempre"); ele só tinha sido fechado de um
  lado.
  Hoje as duas portas chamam a MESMA função, e ela também solta os marcadores de confronto.

## Salvamento

- **`set()` do Firestore NÃO significa que salvou.** Ele resolve quando o SDK aceita a gravação
  localmente; sem rede ela vai pra uma fila em memória (não habilitamos persistência), o `await`
  volta sem erro e a fila morre com a aba. Por isso todo salvamento espera o
  **`waitForPendingWrites()`**, que só resolve com a confirmação do SERVIDOR — e uma tarja sobe na
  tela se não confirmar em 12s. Sem isso o jogador joga uma hora e perde tudo em silêncio.
- Diagnóstico que já foi usado: `readTime` do Firestore lê o documento como ele estava em qualquer
  instante da última hora. Amostrar de 5 em 5 minutos mostra se o save **avança** ou se está sendo
  regravado idêntico — foi o que separou "não grava" de "grava sempre o mesmo estado".
- O autosave é debounced em 800ms e **re-armado a cada `render()`**: uma tela que se redesenhe mais
  rápido que isso adia a gravação pra sempre. Ele também só roda nas telas de `SAFE_SAVE_SCREENS`.

## ⚠️ AS ILHAS LARANJA MORAM EM `docs/ilhas-laranja.md`

**LEIA ESSE ARQUIVO ANTES DE MEXER EM QUALQUER UM DOS CINCO MINIGAMES, NO MAPA DAS ILHAS, NA
TRAVESSIA A PARTIR DA JORNADA OU NOS RANKINGS DELES.** É o registro de tudo que foi medido em cada
um — e a maior parte custou uma medição no navegador, um relato com print, ou os dois.

⚠️ **E ELE ALCANÇA COISA QUE NÃO PARECE "ilha":** a travessia mexe na **tela de fim de jornada** e
no **SAFE_SAVE_SCREENS** (um save já entrou direto nas Ilhas por causa disso), o ranking semanal
mexe no **cron** e nos **prêmios de Doce Raro**, e os cinco jogos são **chamadores do motor de
batalha**. É por isso que a lista de símbolos abaixo existe.

**O que está lá:** os **cinco minigames** (Corrida, Pescaria, Resgate, Arena 1x1 e Seleção), o **mapa do
arquipélago**, a **travessia pela jornada** e o que ela custou, o **ranking** de cada um (o de
sempre e o semanal, com os prêmios), o **monitor** do painel de admin, o **anúncio das novidades**,
e a cena da **Arena da semana**.

**⚠️ E ESTES SÍMBOLOS SÓ SÃO EXPLICADOS LÁ** — um `grep` que caia aqui e não ache nada tem que
ir pro capítulo, e é essa lista que faz o gatilho valer quando o assunto não é óbvio:

`equiparNpc` · `orderBy` · `applySavedState` · `firestore.rules` · `preservePlayerHp` · `simulateGymBattle` · `ilhasJornada` · `journeyEnd` · `CRIT_BASE` · `effectiveSpeed` · `speedDaCorrida` · `loadPermanentUserData` · `corridaZerar` · `index.html` · `abrirConfronto` · `arrayUnion` · `calcMaxHp` · `abrirCorrida` · `createInstance` · `ehDoJogador` · `npcParaOSpeed` · `nivelDoNpc` · `DESENHOS` · `game.screen` · `requestAnimationFrame` · `advanceReveal` · `pescariaTerminar` · `classList` · `slotDaConta` · `pescariaBatalhar` · `corridaInstancia` · `pescariaPintarArea` · `game.saveSlots` · `entradaAte`

*(18 seções, 249 subseções, 360 KB — saíram daqui em 25/09/2026 porque o CLAUDE.md é lido
INTEIRO em toda sessão, e ele tinha chegado a 1.360 KB.)*

## A VELOCIDADE PASSOU A ESCALAR COM O NÍVEL (20/09/2026)

Pedida assim: *"pode fazer com que a velocidade escale com o nivel, o nosso jogo tem que sempre
tentar se manter fiel ao jogo original nesse quesito de resultado de batalhas"*. Ela nasceu de um
relato sobre o LOG — *"por que que o Tentacruel atacou 2x seguidas?"* —, e a resposta era um empate
de velocidade que na Gen 3 não existiria.

A mecânica está no item do **Motor de batalha**, acima. Aqui fica o que ela CUSTOU.

### O TAMANHO DO DESVIO, ANTES DE MEXER

| diferença de nível | a ordem inverte | empate hoje | empate na Gen 3 |
|---|---|---|---|
| mesmo nível | 0,00% | 3,70% | 3,82% |
| **até 3 (a jornada)** | **0,90%** | 3,70% | 1,29% |
| até 10 | 5,53% | 3,68% | 1,12% |
| até 30 | 17,81% | 3,64% | 0,93% |
| qualquer (5 a 99) | 27,84% | 3,74% | 0,68% |

| no modo | inverte | empate |
|---|---|---|
| **jornada** (níveis pareados por desenho) | **2,61%** | 4,12% |
| **pescaria** (parceiro Lv.55-70 × peixe da zona) | **23,04%** | 3,49% |

Ou seja: **na jornada quase não importava**, porque os níveis são pareados de propósito. **Na
pescaria importava muito**, porque o parceiro é Lv.55-70 e o peixe pode ser Lv.8. E os empates
caem de 3,7% para ~0,7%, que é o que fazia o log mostrar dois golpes seguidos.

### ⚠️ O PREÇO NA JORNADA: NADA NO TOTAL, MAS A FORMA MUDA MUITO

**53,16% contra 54,22%** de conclusão — **+1,06 ponto, 1,1σ**, 8 blocos de 800 jornadas de cada
lado (**6.400 de cada**, o MESMO bot contra duas cópias congeladas pelo `--html`, desvio tirado de
ENTRE os blocos, **6 de 8 blocos** pro lado da escala). Ruído.

**⚠️ MAS A DIFICULDADE SE REDISTRIBUI, e muito** (game overs, 6.400 jornadas de cada lado):

| ginásio | sem a escala | com | |
|---|---|---|---|
| 1º | 397 | **330** | −17% |
| 5º | 398 | **493** | +24% |
| **6º** | 1.346 | **888** | **−34%** |
| 7º | 21 | 34 | — |
| **8º** | 814 | **1.169** | **+44%** |

**⚠️ E O MECANISMO TEM NOME: quem tem o NÍVEL MAIOR ganha a iniciativa.** A distribuição de níveis
trava em **55**, e os líderes vão de 18,3 no 1º a **59,8 no 8º** — ou seja a curva do jogador cruza
a dos líderes entre o 6º e o 8º. Onde o jogador está acima (1º, 6º) ele passa a abrir os confrontos
e a batalha afrouxa; onde o líder está acima (5º, 8º) é o contrário. Antes disso, o nível não
contava pra nada nessa decisão.

**A impressão do motor MUDA, e tem que mudar** (`MOTOR 0c52f316db7b → dbf789938bc5`): é mudança de
motor, não de apresentação. E `effectiveSpeed` é **idêntico nos dois motores** — uma divergência
ali faria a mesma partida de liga terminar diferente no cliente e no servidor.

### ⚠️ A CORRIDA ESCALARIA DUAS VEZES

O `speedDaCorrida` **já era a fórmula da Gen 3** — ele a CRIOU, em 18/09/2026, justamente porque o
motor de batalha não tinha nenhuma. Mantida a conta dele, um Jolteon Lv.70 iria de **187 para 266**
e a pista inteira precisaria ser recalibrada — e o defeito não apareceria como erro, apareceria
como todo mundo correndo mais rápido.

Hoje ele é **o próprio `effectiveSpeed`**. Medido: Jolteon Lv.70 **187 → 187** e Shuckle **12 → 12**,
idênticos. O único número que se move é o do shiny (**223 → 224**), porque os multiplicadores
passaram a entrar DEPOIS da escala e o `+5` deixou de ser multiplicado.

**⚠️ E A TRAVA DA CORRIDA QUE DIZIA "o `effectiveSpeed` do motor IGNORA o nível" FOI INVERTIDA** —
ela era a justificativa de a escala existir lá, e virou a prova de que ela mudou de dono. A
mensagem de falha dela aponta pro outro lado se alguém desfizer um dos dois.

### ⚠️ E ELA DEIXOU A RAIDE DO MEW INGANHÁVEL — o dial que consertou isso

O Mew da raide é **Lv.4999**, e esse número nunca foi uma afirmação sobre o bicho: ele é o dial que
dá os 25.125 de HP e que divide o dano por ataque. Com a escala, o mesmo 4999 dava velocidade
**10.003** — mais que o jogo inteiro somado. Medido: o Mew matava os SEIS antes de qualquer um agir
e uma investida tirava **ZERO** de dano, sempre.

**Hoje a velocidade do chefe é um DIAL explícito** (`BOSS_SPEED_COMO_NIVEL`): ele se comporta como
um Mew de nível 50. Medido, isso o devolve **exatamente onde ele estava** — 44 investidas e 41 com
dano zero **dos dois lados** —, contra 41/41 (ou seja sempre zero) sem o dial.

**⚠️ ELE FICA FORA DO `BOSS_BASE`** de propósito: aquele objeto são os atributos oficiais do Mew
(100 em tudo, Gen 2), e sobrescrever a velocidade lá faria a tabela mentir sobre a espécie.
**⚠️ E A RAIDE CONTINUA DESCALIBRADA** — isso é anterior, de 15/09/2026, quando o golpe moribundo
acabou. Ela está DESLIGADA e o dial só impede que ela volte INGANHÁVEL; ele não a conserta.

### ⚠️ O QUE FICA EM ABERTO

O **desempate de velocidade** continua sendo sorteado a CADA troca. Com os empates caindo de 3,7%
para ~0,7% isso ficou muito mais raro, mas no **espelho** (mesma espécie, mesmo nível) ele continua
valendo 70% dos confrontos. A alternativa — sortear uma vez por confronto — está medida no item do
log de batalha e não foi feita porque não foi pedida.

## O TERRENO DO GINÁSIO É O PRÓPRIO GINÁSIO (25/09/2026)

Pedido assim: *"quando for desafiar os líderes dos ginásios, não vai mais assumir nenhum terreno
aleatoriamente, porque o terreno vai virar 'Ginásio de Pedra'... vai ser a mesma coisa que os outros
terrenos, porém esse vai dar o buff apenas para pokémons de pedra"*.

São **16 terrenos** (`GYM_TERRAINS`), um por tipo de ginásio — o `Ginásio de Pedra` do exemplo até o
`Ginásio de Dragão`. Cada um dá **1,15× em todos os seis atributos** pra **um tipo só**.

### ⚠️ O GINÁSIO JÁ ESCOLHIA UM TERRENO DO TIPO DO LÍDER — o que muda é o TIPO EXTRA

Esta é a parte que a intuição erra. O `pickGymTerrain` **não sorteava entre os 51**: ele já filtrava
pelo tipo do líder. O problema é que **94,8% dos terrenos carregam mais de um tipo** — a Caverna de
Cristais é `Rock/Psychic` —, então no Brock um **Alakazam do jogador pegava 1,15× em tudo de graça**.

| ginásio | os tipos EXTRAS que o terreno sorteado podia beneficiar |
|---|---|
| Pedra | Psychic, Ground, Dragon, Fire, Ice, Dark |
| Água | Ice, Fighting, Ghost, Fire, Bug, Steel |
| Fogo | Ground, Rock, Ghost, Bug, Water, Dark |

**MEDIDO, em 40.000 visitas a ginásio com time aleatório de 6:**

| | o time do JOGADOR pega buff de terreno |
|---|---|
| antes (terreno sorteado, 1 a 3 tipos) | **62,4%** |
| hoje (Ginásio de X, 1 tipo só) | **39,3%** |

**⚠️ E O LÍDER QUASE NÃO PERDE — mas não é "nada", e essa conta me pegou:** **12% dos pokémon de
líder NÃO são do tipo do próprio ginásio** (o Sandshrew do Brock é Terra puro, os Magnemite e o
Electabuzz da Jasmine são Elétrico, o Gyarados da Clair é Água/Voador). Medido em pokémon com buff
por batalha: o jogador cai **0,99 → 0,50** (−0,49) e o líder **4,11 → 4,03** (−0,08). O jogador
perde **6× mais**.

### O CUSTO MEDIDO: a batalha aperta, a jornada não se move

| | n | resultado |
|---|---|---|
| **a BATALHA de ginásio isolada** (mesmo time, mesma semente, só o terreno muda) | 6.400 batalhas | **−1,81 ponto** pro jogador |
| **a JORNADA** (16 blocos de 800, duas cópias congeladas) | **12.800 de cada lado** | **+0,70 ponto, 1,3σ** — ruído |

A batalha isolada é a medição **pareada**, e ela concorda com a conta de buff: o ginásio ficou mais
apertado. Na jornada isso se dilui — o jogo compensa derrota com níveis (o bolo de +5 por ginásio
perdido, e o limite de 5 derrotas é POR ginásio), e os game overs por ginásio mexem pouco e em
direções alternadas (−13 no 1º, +15 no 5º, −20 no 8º, somando −14 em 2.400 jornadas).

**⚠️ E O PRIMEIRO A/B DEU 2,6σ QUE NÃO SE REPETIU — esta é a lição que vale mais que o número.**
Ele deu **+1,66 ponto, 2,6σ, 7 de 8 blocos** pro lado fácil, o que pareceria efeito real e
**contradizia a direção da conta de buff**. O segundo, idêntico, deu **−0,27, 0,3σ, 2 de 8**. Os 16
juntos dão 1,3σ. Ou seja: **8 blocos de 800 ainda produzem 2,6σ por acaso neste simulador** — o
CLAUDE.md já registrava que ele varia ~2 pontos entre amostras grandes, e agora há um caso com o
σ calculado. **Quando o A/B contradiz uma conta direta, rodar o segundo é mais barato que acreditar
no primeiro.**

### AS DECISÕES

- **⚠️ ELES FICAM FORA DO `TERRAINS`, e isso é decisão e não organização.** Aquela tabela é
  **sorteada pela Liga**, oferecida ao líder do **Ginásio do Bairro**, escolhida na **Trainers
  League** e listada na tela de terrenos — jogar os 16 lá dentro os poria em todos esses lugares.
  E quebraria a conta de **6 terrenos por tipo**, que existe por uma razão medida: ela é o que faz o
  buff sair com a mesma frequência pros 17 tipos.
- **⚠️ MAS A TABELA SEPARADA TEM UM PREÇO, e ele é o `terrenoPorId`:** o selo do ginásio chama o
  `openTerrainInfoModal`, que procurava no `TERRAINS` — e o sintoma de não achar é **MUDO**: o selo
  continua na tela e o clique não abre nada. Hoje ele olha as duas tabelas.
  **⚠️ E os 5 `TERRAINS.find` da Liga ficaram como estavam, de propósito:** ali o find é uma
  **validação implícita** (só terreno de liga vale na liga), e trocá-lo passaria a aceitar um id de
  ginásio gravado por engano em vez de recusá-lo. Há trava cobrando os dois lados.
- **⚠️ A FUNÇÃO TROCOU DE NOME** (`pickGymTerrain` → `terrenoDoGinasio`): um `pick` que devolve
  sempre a mesma coisa é um nome que mente, e neste arquivo nome caduco já custou investigação mais
  de uma vez.
- **⚠️ O NOME É ESCRITO À MÃO, e não `'Ginásio de ' + o tipo`:** quatro tipos são **adjetivos**
  (Elétrico, Psíquico, Voador, Normal) e com a preposição sairiam errados em português. Ficaram
  *Ginásio Elétrico*, *Ginásio Psíquico*, *Ginásio Voador* e *Ginásio Normal*; os outros doze usam
  o *"de"*, e o exemplo do pedido (*"Ginásio de Pedra"*) está preservado exatamente.
- **SAVE ANTIGO NÃO QUEBRA E NÃO MUDA NO MEIO:** o `gymTerrain` é serializado, então quem parou
  dentro de um ginásio com um terreno sorteado **continua com ele** até aquele ginásio acabar — o
  `game.gymTerrain = null` da vitória é que traz o novo. E o modal continua achando o terreno velho,
  porque o `terrenoPorId` olha as duas tabelas.

### OS 16 CENÁRIOS ENTRARAM (25/09/2026)

A arte vem de fora (*"estou usando uma outra IA para gerar as imagens do fundo"*). O Brock entrou
primeiro, pra conferir a forma; os outros 15 na mesma tarde, quando os arquivos chegaram nomeados
**exatamente pelos ids da tabela** — 16 de 16, sem sobra dos dois lados.

**⚠️ CADA UMA FOI UMA LINHA DE CSS, e é isso que o `GYM_TERRAINS` tinha comprado:** o
`terrainBattleSceneStyle` já emitia `--battle-scene-id:ginasio_pedra` mesmo sem imagem, então bastou
a regra pelo seletor de atributo — a **mesma porta** dos três cenários dedicados (termas vulcânicas,
colmeia de chamas, submarino afundado), com `background-size:100% 100%` porque é a cena INTEIRA e
não um slot da folha 3×3 do atlas.

**⚠️ AS ARTES NÃO TÊM TODAS A MESMA PROPORÇÃO, e isso foi medido antes de aceitar:** são **três
grupos** — 1402×1122 (razão **1,25**, dez delas), 1466×1073 (**1,37**, quatro) e 1484×1060
(**1,40**, duas). A caixa da cena é **320×384 (0,83)**, e o `background-size:100% 100%` **estica**:
a largura fica em **67%** da original nas de 1,25 e em **60%** nas de 1,40. São **7 pontos** de
diferença entre a mais e a menos espremida — conferido na tela, não se nota. Os três cenários que
já existiam são 1,28, ou seja no meio do grupo.

**⚠️ OS ARQUIVOS SÃO WEBP: 34 MB de PNG viraram 4,9 MB** (de 233 a 401 KB cada; os três cenários
antigos pesam ~1,2 MB **cada**, então os 16 novos juntos pesam pouco mais que quatro deles). Não há
`cwebp` nem `sharp` nesta máquina — a conversão foi pelo **canvas do navegador**, em lote, com o
navegador fazendo POST de cada binário direto pro servidor local: nenhum base64 atravessou a
conversa.

**⚠️ E A PASTA DAS ARTES TEVE QUE ENTRAR NO `hosting.ignore`: são 34 MB de PNG** (16 gerações) e a
raiz inteira é publicada. É a **terceira vez** que esta armadilha aparece — a `previa-confusao.html`
em 24/09 e os 985 KB de protótipos no mesmo dia. Entrou `ginasios-cenarios/**` e o `ginasio_pedra`
solto na raiz; **há trava lendo o `firebase.json`**.

**⚠️ E AS DUAS TRAVAS OLHAM EM DIREÇÕES OPOSTAS, de propósito:** a nova vai da **TABELA pro CSS**
(todo ginásio tem regra de cena) e a que já existia vai do **CSS pro DISCO** (toda imagem pedida
existe). Juntas elas fecham o circuito — e é por isso que a nova **não** confere arquivo: seria a
mesma conta, pior feita. Mais um teto de **600 KB** por cena, que existe pra pegar um PNG que entre
**sem passar pela conversão** (a maior hoje tem 401 KB).

**QUANDO UM GINÁSIO NOVO NASCER** são dois passos: o arquivo em `assets/batalha/cena-<id>.webp` e a
linha de CSS. A trava varre a **tabela**, então ela cai sozinha — nomear os 16 à mão deixaria o
próximo entrar sem cena, caindo no `campo_aberto` **sem nada quebrar**, que é o jeito mudo de
falhar.

### ⚠️ E "Ginásio de Fantasma" QUEBRA EM DUAS LINHAS NO SELO — e isso é PRÉ-EXISTENTE

Medido a 320px, na linha do ginásio, com o líder de nome mais longo (Lt. Surge): o selo vai de
**21px para 33px** nesse único caso. **Não é novidade da mudança** — o *Submarino Afundado*, que já
existe no `TERRAINS`, quebra exatamente igual. Consertar isso mexeria no selo da Liga também, o que
não foi pedido. Nenhum nome estoura a caixa e o nome do líder nunca é cortado.

`tools/test-terrenos.js` tranca 16 pontas, e as que importam são a **cobertura** (todo ginásio tem
terreno, senão ele lutaria sem terreno e o sintoma é mudo), o **tipo** (o buff é o do líder), o **um
tipo só**, o **não vazamento** pro `TERRAINS` da liga, e — a que a conferência de acusação cobrou —
o **SELO abrindo a caixa**, exercitando o `openTerrainInfoModal` de verdade em vez do `terrenoPorId`
na mão. **Conferido: os 5 defeitos religados acusam.**

## O NÍVEL DO SELVAGEM TEM QUE CABER NA ROTA (25/09/2026)

Reportado com print: *"estou na segunda rota, antes do ginásio de inseto, e apareceu um Magcargo
level 39 para capturar, isso é bug ou tá definido assim?"*.

**Era a MECÂNICA, não um defeito** — e é a **segunda vez** que ela aparece: o **Dugtrio Lv.28** nas
rotas iniciais (11/09/2026) é o mesmo mecanismo. O `Slugma` evolui no **38**, e o
`EVOLVED_MIN_LEVEL` impede uma forma evoluída de sair abaixo do nível em que ela existiria (senão o
jogo entregaria um "Magcargo Lv.9" que a regra de espécie-por-nível converteria em Slugma na hora).
A Caverna União é **8–13** e ele saía **38–43**.

### ERAM QUATRO, E A VARREDURA É O QUE OS ACHOU

| região | trecho | rota | pokémon | a rota é | ele saía em | |
|---|---|---|---|---|---|---|
| Johto | 2 | Caverna União | **Magcargo** | 8–13 | 38–43 | **+25** |
| Kanto | 4 | Desvio por Lavender | **Rhydon** | 18–23 | 42–47 | **+19** |
| Kanto | 6 | Dojo Lutador | Poliwrath | 28–33 | 40–45 | +7 |
| Kanto | 6 | Silph Co. | Porygon2 | 28–33 | 40–45 | +7 |

**Os quatro foram pro trecho 8** (50–55), onde o piso **não morde** — ali o `faixaDeNivelSelvagem`
devolve a faixa da rota inteira. E cada um com afinidade de tipo, não no gosto:

- **Magcargo** (Fire/**Rock**) e **Rhydon** (Ground/**Rock**) → **Victory Road** (Rock/Fighting), e
  **o Rhyhorn já morava lá** — a linha se junta;
- **Poliwrath** (**Water**/Fighting) → **Covil do Dragão** (Dragon/Water);
- **Porygon2** (Normal) → **Usina de Força**, onde **o Porygon já morava**.

**⚠️ O TRECHO 7 NÃO RESOLVIA, e a conta diz por quê:** lá a faixa é 33–38 e o piso 38 produz
`[38, 43]` — ainda **5 acima do teto da rota**. A fórmula é `[piso, piso + (max − min)]`, então o
piso só some quando ele é **menor que o mínimo** do trecho.

**⚠️ O EEVEE DA MANSÃO CONTINUA SAINDO ACIMA (Lv.45 numa rota de 33–38), e é DECISÃO:** o nível
dele vem do `route.niveis`, não do piso. Ele é a **exceção nomeada** na trava.

### ⚠️ TRÊS VARREDURAS MINHAS DERAM "ZERO ACHADOS" ANTES DESTA

E as três pelo mesmo motivo — **medir a dimensão errada, com o zero parecendo resultado**:

1. a primeira usou o **`routesForLeg`**, que escolhe a região pelo **save** — com um save de Kanto
   ela varreu **metade do jogo**;
2. a segunda e a terceira leram **`.min`** num retorno que é um **array `[de, ate]`**:
   `undefined − 13 > 3` é falso, então nada aparecia.

**A trava cobra as duas coisas**: que nenhum selvagem saia mais de 3 níveis acima do teto da rota,
**e que a varredura tenha olhado as 32 rotas das duas regiões** — essa segunda linha é o que separa
*"não achou"* de *"não procurou"*. Mais uma por pokémon movido, cobrando que ele **continue em
alguma rota**: tirar sem pôr deixaria um buraco na Pokédex.

**Conferido: o defeito religado acusa nas DUAS regiões** — o Magcargo de volta na Caverna União e o
Rhydon de volta no Desvio por Lavender.

## A ROCKET E O RIVAL GANHARAM TERRENO, E OS SELOS FICARAM LADO A LADO (25/09/2026)

Pedido assim: *"os encontros com a equipe rocket e o rival, sempre vai sortear um terreno para
acontecer a batalha. O selo da dança da chuva, hoje aparece embaixo do selo do terreno, coloque
para ficar ao lado"*.

### ⚠️ SÃO QUATRO CONTEXTOS, E NÃO DOIS

O `hideout1` e o `hideout2` **são a Equipe Rocket** — o guarda e o chefe do esconderijo. Nomear só
o `rocket` deixaria as **duas lutas mais longas da linha** sem terreno, e o jogador veria o selo
sumir no meio da sequência.

**A `elite` fica de fora porque ela já tem o dela** (um por membro, escolhido no chaveamento) — e
se entrasse na lista, o sorteado sobrescreveria o do membro. **A montanha e a vigília ficam de
fora** porque não foram pedidas, e as duas são batalhas de PRÊMIO, com recompensa calibrada.

- **⚠️ O SORTEIO MORA NO `startSpecialBattle`, e não no `runSpecialBattle`:** aquele roda de novo a
  cada tentativa, e o terreno mudaria embaixo do jogador entre a tela de abertura e a luta. Aqui
  ele nasce junto com a batalha e vale até ela acabar. **Há trava cobrando que ele não mude.**
- **⚠️ E O `eliteTerrainBadgeHtml` SAIU, por causa do nome:** quando a Rocket e o rival ganharam
  terreno, ele deixou de ser "da Elite". Nome que mente já custou investigação mais de uma vez
  neste arquivo. Quem lê o terreno agora é o `terrenoDaBatalhaEspecial()`, e quem desenha é a
  fileira.

**O CUSTO MEDIDO: nada.** Isolado (3.000 batalhas, 6 meus contra 4 do NPC, mesmo time e mesma
semente dos dois lados): **70,83% → 70,20%**, −0,63 ponto. Na jornada: **−0,80 ponto, 0,8σ**
(8 blocos de 800 de cada lado, 3 de 8 pro lado novo). Faz sentido — **o terreno beneficia os DOIS
lados**, e a fatia é quase igual: **0,94 de 6** do meu time e **0,70 de 4** do NPC.

### ⚠️ E O PRIMEIRO A/B DEU +4,83 PONTOS (5,3σ) — ERA UM VAZAMENTO QUE EU TINHA ACABADO DE CRIAR

**O buff de terreno saía da batalha e ia pra jornada inteira.** A flag `terrainBuffed` ficava
LIGADA depois da luta, e ela vale **1,15× nos seis atributos, teto de HP incluído**: um Pikachu
Lv.30 saía da batalha do rival com **teto 220 em vez de 215, velocidade 68 em vez de 59 e ataque
63 em vez de 55**.

**⚠️ ISSO NASCEU COM ESTA MUDANÇA:** antes só a Elite aplicava terreno ali, e lá o vazamento não
tinha pra onde ir (é o fim da jornada). O ginásio **limpava por acidente** — o `applyTerrainBuff`
DESLIGA a flag de quem o terreno não alcança —, então o vazamento durava da batalha especial até o
ginásio seguinte, e no meio estão a distribuição de níveis e a cura, que leem o teto de HP.

**⚠️ O QUE O DENUNCIOU FORAM DOIS NÚMEROS DISCORDANDO**, e é a lição que fica:

| | delta | σ | blocos |
|---|---|---|---|
| a batalha ISOLADA (pareada) | **−0,63** | — | — |
| o A/B **com** o vazamento | **+4,83** | **5,3σ** | 8/8 |
| o A/B **depois** do conserto | **−0,80** | 0,8σ | 3/8 |

**A medição pareada estava certa o tempo todo.** Um A/B que contradiz uma conta direta e ainda dá
5,3σ não é "efeito surpreendente" — é sinal de que a mudança alcançou algo que ela não devia
alcançar. **Procurar o vazamento é mais barato que acreditar no número.**

- **⚠️ A LIMPEZA VEM DEPOIS DO `simulateGymBattle`, nunca antes** — a luta precisa do buff.
- **⚠️ E ELA NÃO TOCA NO HP:** o `preservePlayerHp` da Elite carrega o valor entre as lutas, e mexer
  no teto ali deixaria um pokémon com `hp` acima do `maxHp` — o defeito do Gyarados de 504 num teto
  de 490 que este arquivo já registra.
- **⚠️ E A TRAVA PRECISOU ESPIAR A LUTA:** o buff tem que estar **ligado durante** e **desligado
  depois**, então olhar só o estado final faz as duas travas se contradizerem. O dublê anota o time
  no instante da chamada e repassa pro original.
- **⚠️ E A PRIMEIRA VERSÃO DESSA TRAVA PASSOU COM O DEFEITO RELIGADO:** ela sorteava o terreno e
  podia não alcançar o time — medindo o conjunto vazio. Hoje ela reusa o painel que sorteia **até**
  alcançar.

### ⚠️ OS SELOS EMPILHAVAM POR CAUSA DA ESTRUTURA, NÃO DO ESTILO

Cada selo emitia o **próprio** `.terrain-badge-row` — um bloco com margem. Dois blocos empilham por
construção, e **nenhum ajuste de CSS os junta sem um pai comum**. Hoje quem monta a fileira é a
`faixaDeSelosDaBatalha(terreno, m)`, e os selos são irmãos dentro dela.

**⚠️ E A PRIMEIRA VERSÃO DA REGRA FALHOU POR 2 PIXELS — medido, não deduzido.** Ela nasceu
`flex-wrap:wrap; gap:6px`, e com o selo no padding antigo (9px) os dois somavam **278px** numa
fileira de **276px**: o wrap fazia exatamente o que o pedido veio consertar. Duas coisas mudaram:

| | antes | agora |
|---|---|---|
| a fileira | `wrap`, gap 6 | **`nowrap`, gap 4** |
| o padding do selo | `3px 9px` | **`3px 6px`** |
| o pior caso (Ginásio de Fantasma + Dança da Chuva) | **empilhado, 60px** | **lado a lado, 21px, sobra 4px** |

**⚠️ O `nowrap` É DELIBERADO:** com o wrap, um nome comprido devolve o empilhamento sozinho. Não
cabendo, quem cede é o **texto por dentro do selo** — que é o que o *Submarino Afundado* já faz.

**⚠️ E A TRAVA QUE COBRAVA `chuvaBadgeHtml(m)` NAS QUATRO TELAS CADUCOU** — três delas trocaram de
porta. Ela não foi afrouxada: hoje cobra que a tela emita a fileira por alguma das duas, que é a
regra de verdade.

### ⚠️ E A CONFERÊNCIA DE ACUSAÇÃO PEGOU UMA TRAVA QUE LIA SÓ A TELA

Religando o motor pra ignorar o `specialTerrain` — **o defeito mais grave da lista, porque a tela
mostraria o selo e a luta não daria o buff** — todas as travas continuavam **verdes**: elas liam o
`terrenoDaBatalhaEspecial()`, que é o lado da TELA. Hoje há uma que **roda o `runSpecialBattle` de
verdade** e confere que o time saiu marcado, cobrando o par (com terreno marca, sem terreno não).

**⚠️ E O `MUDO` DA PRIMEIRA RODADA ERA MEU:** eu tinha apontado o caso pro `test-especiais` e a
trava está no `test-terrenos`. **Um "mudo" pode ser o teste errado, não uma trava fraca** — vale
conferir o par antes de reescrever a trava.

## A BIFURCAÇÃO PARAVA O SORTEIO EM TRÊS LUGARES (24/09/2026)

Reportado com print do picker da Liga Pro: *"apareceu um poliwhirl, porem pelo level 56 deveria ser um
poliwarth"*. **E estava certo:** o Poliwhirl evolui no 40, o card dizia **Lv.56**, e a forma que existe
naquele nível é o **Poliwrath**.

### ⚠️ A CAUSA É UMA GUARDA QUE ESTÁ CERTA NA JORNADA E ERRADA AQUI

```js
while(EVOLUTIONS[cur] && nivel >= EVOLUTIONS[cur].level){
  if(EVOLUTION_CHOICES[cur]) break;   // <- ela PARA na bifurcacao
  cur = EVOLUTIONS[cur].into;
}
```

Ela existe desde a bifurcação Kanto/Johto e o motivo dela é bom: **na jornada quem escolhe entre
Poliwrath e Politoed é o JOGADOR**, na tela do `evoChoice` — parar ali é o que impede o jogo de
decidir no lugar dele.

**⚠️ MAS ONDE NINGUÉM VAI ESCOLHER, PARAR É MOSTRAR UMA FORMA QUE NÃO EXISTE NAQUELE NÍVEL.** E são
**QUATRO** as linhas travadas (`gloom`, `poliwhirl`, `slowpoke`, `tyrogue`) — o relato nomeou uma.

**MEDIDO NO BOLO DA LIGA PRO, antes de mexer:**

| faixa | entradas travadas | **bolos com pelo menos uma** |
|---|---|---|
| Bronze 15-30 | 0,00% | 0,0% |
| Prata 35-50 | 1,64% | 17,9% |
| **Ouro 55-70** | **2,10%** | **23,0%** |

⚠️ **Quase um bolo em quatro na faixa Ouro** — não é caso de canto. E na Bronze é zero por aritmética:
o Poliwhirl só evolui no 40, então abaixo disso ele **É** a forma certa.

### ⚠️ ERAM TRÊS LUGARES, E SÓ UM FOI RELATADO

O `semEscolha` é opcional e **quem o pede é o CHAMADOR** — a guarda continua cega por padrão, então a
jornada não muda um caractere:

| onde | quem escolheria | passa `semEscolha` |
|---|---|---|
| **o bolo da Liga Pro** | ninguém — os 12 são sorteados | **sim** |
| **o draft da Ilha Kumquat** | ninguém — o bolo é sorteado | **sim** |
| **os guardiões da Montanha Sagrada** | ninguém — são adversários | **sim** |
| a **VIGÍLIA do Arco-Íris** | **o JOGADOR** — o prêmio vira pokémon dele | **não** |
| a jornada, o encontro selvagem, a Torre | o jogador | não |

**⚠️ A VIGÍLIA É A EXCEÇÃO E ELA É DELIBERADA:** o prêmio dela **entra no time como um selvagem
capturado**, e resolver a bifurcação ali seria escolher Poliwrath ou Politoed pelo jogador — a coisa
mais definitiva do jogo. Ela continua parando, e **há caso de teste cobrando isso** (religá-lo acusa).

**⚠️ E O PARÂMETRO É OPCIONAL, NUNCA O PADRÃO.** Com `semEscolha` implícito, a próxima chamada
esquecida **tiraria a escolha do jogador em silêncio** — é a mesma armadilha do `ehDoJogador` do
`corridaInstancia` e do `pescariaInstancia`, pelo lado oposto. Há caso de teste pros dois sentidos.

**⚠️ E O `formaNoNivel` TEM QUE REPASSAR**, senão ele desce a linha e o `especieNoNivel` volta a
parar na subida — o sintoma fica **idêntico** ao defeito. É a única linha que liga os três chamadores
à guarda, e ela tem trava própria.

**MEDIDO DEPOIS: 0 de 7.200** nas três faixas da Liga Pro, e zero nos três chamadores.

**NO MOTOR, NADA:** `MOTOR 2d6a83f24cf1 / DIARIO 72e61601d1fb`, idêntico em 900 batalhas semeadas — e
o instrumento é sensível (com o `CRIT_BASE` em 1/8 os dois hashes mudam). O `formaNoNivel` é sorteio
de espécie, não conta de dano.

**⚠️ E ELE CUSTOU UM PATCH QUE DEIXOU OS DOIS MOTORES DIVERGINDO NO DISCO:** o script escreveu o
`functions/index.js` e **estourou** no `index.html` (âncora errada — eu copiei a linha do servidor, e
a chamada da Kumquat no cliente é `createInstance(formaNoNivel(sorteado, nivel), nivel)`). Restaurado
do backup, e o patch passou a **preparar TODOS os arquivos e só então escrever qualquer um** — a regra
que vale pra tudo que é duplicado aqui.

## A POKÉDEX CONTA 251, E A BARRA NUNCA FECHA (23/09/2026)

Reportado assim: *"na pokedex tem um texto que fala '130 de 250 especies registradas…', mas é 251 o
correto"*. **E ele estava certo — a tela discordava de si mesma:** a conta dizia 250 (o tamanho do
`SPECIES`) e a **grade desenhava 251**, porque o quadro do **#151 (Mew)** entra nela desde
01/09/2026 pra a numeração não pular do #150 pro #152.

- **⚠️ E O NÚMERO É DERIVADO DAS DUAS TABELAS** (`SPECIES` + `SPECIES_FORA_DA_DEX`), nunca o 251
  escrito à mão: ele envelheceria na próxima espécie que entrasse na dex — a família de trava e de
  texto fixo que já caiu meia dúzia de vezes neste projeto.
  **⚠️ E COMPARAR A CONTA COM A SOMA DAS TABELAS NÃO DISTINGUE OS DOIS**, porque hoje 250+1 dá 251:
  um número fixo passa. Quem distingue é **MEXER na tabela** e cobrar que a conta acompanhe — a
  mesma técnica do asterisco do cartão de golpe, que mexe na chance e cobra a frase.
- **⚠️ O CUSTO É CONHECIDO E ACEITO: A BARRA NUNCA FECHA.** O Mew é o chefe da raide e **ninguém o
  registra**, então o máximo possível é **250 de 251**. É o preço de a conta bater com a grade — e
  fica trancado no teste pra ser decisão e não surpresa.
- **⚠️ E NENHUMA CONQUISTA QUEBRA, o que foi conferido antes de mexer:** o desafio do Mewtwo e o
  "Mestre Pokémon" cobram *"capturou todo o resto"* lendo o **`SPECIES`**, que continua em 250. A
  conta da tela é **só texto** — se ela alimentasse a conquista, os dois ficariam impossíveis pra
  sempre, que é o que já aconteceu neste jogo com o Celebi e ficou dias sem ninguém notar.
- **⚠️ ISSO REVERTE A DECISÃO DE 01/09/2026**, que era *"ele entra na GRADE mas NÃO entra na
  CONTA"*. Ela existia pela razão do item acima — e a razão valia pro `SPECIES`, não pro texto.

**A trava do `test-online-dex.js` FIXAVA 250 e caiu com o código certo** — a família que este
arquivo já registra meia dúzia de vezes. Ela não foi afrouxada: passou a cobrar a **regra** (a conta
BATE com o que a grade desenha, ela é derivada, e o teto real é uma a menos que o total).

## O FERRAMENTAL DE DESENVOLVIMENTO (24/09/2026)

Pedido assim, depois de uma leva que demorou mais que o trabalho que ela entregou: *"por que estamos
levando mais de 1h para fazer as ações?"* e *"pode tudo que deixar melhor a performance do nosso
desenvolvimento"*.

### ⚠️ O GARGALO NÃO ERA A BATERIA — ELA LEVA 52 SEGUNDOS

Medido teste a teste: **52s para os 43**, e **40 deles são do `test-especiais`**. Ou seja rodar tudo
a cada mudança é barato, e nada aqui precisa de execução seletiva.

**O GARGALO É QUE EU REESCREVIA AS MESMAS QUATRO FERRAMENTAS A CADA LEVA.** Contado no scratchpad da
sessão: **453 arquivos**, dos quais **119 são a mesma coisa de novo** —

| | quantos |
|---|---|
| `previa*` (montar uma tela pra olhar) | **40** |
| `acusar*` (a conferência de acusação) | **34** |
| `medir*` (os números a 320px) | **23** |
| patch/troca de texto | **22** |

Cada um escrito do zero traz junto a chance de um escape quebrar, uma âncora não casar **em
silêncio**, ou um harness medir o vazio. Nesta leva sozinha isso custou: cinco escapes comidos pelo
shell, um comentário com duas palavras apagadas por crases que executaram, uma troca de selo que
**não foi aplicada** enquanto o "ok sintaxe" dizia que sim, um script que estourou no meio e deixou
o **defeito injetado no arquivo**, e uma medição feita no **iframe errado** (dois empilhados no
mesmo canto).

Nasceram quatro ferramentas versionadas em `tools/`, e cada garantia delas é um defeito real deste
projeto.

### `tools/patch.js` — trocas de texto, tudo-ou-nada

```
node tools/patch.js <receita.js> [--seco]
```

A receita é um **ARQUIVO JS** (escrito pela ferramenta de edição, nunca pelo shell) com uma lista de
`{arquivo, de, para, rotulo, vezes}`; `de` aceita string ou RegExp.

**⚠️ ELA É UM ARQUIVO JUSTAMENTE PORQUE O SHELL COME ESCAPE.** Um `\\d` num heredoc chega no node
como `d`, um `${` vira `bad substitution`, e uma **crase EXECUTA como comando** — e nenhum dos três
dá erro: o patch "roda", imprime ok, e o arquivo fica errado ou intocado.

As cinco garantias:

| | o defeito que ela existe pra impedir |
|---|---|
| **a CONTAGEM** (`de` tem que aparecer exatamente `vezes`) | âncora que não casa se lê igual a "deu certo" |
| **TUDO-OU-NADA** (prepara tudo em memória, só então escreve) | um script que escreve o cliente e estoura no servidor deixa os **dois motores divergindo no disco** |
| **o DELTA DE TAMANHO, sempre impresso** | um `process.argv[1]` no lugar do `[2]` já apagou a tabela de desenhos — **55.642 caracteres viraram 472, e o `node --check` PASSOU** |
| **a SINTAXE nos dois formatos** (`.js` pelo vm; no HTML, cada `<script>` à parte) | a crase que fecha um template literal: com um número PAR delas o arquivo continua válido e a tela só morre no navegador |
| **BACKUP** em `.patch-bak/` | desfazer sem depender do git |

**Conferido que as quatro primeiras acusam** (âncora, contagem, sintaxe e tudo-ou-nada), com exit
code 1 e o arquivo **intocado** nos quatro.

### `tools/acusar.js` — a conferência de acusação

```
node tools/acusar.js <casos.js> [--caso N]
```

Mesmo formato da receita, mais `testes:['test-x']`. Ele religa cada defeito, roda os testes, e diz
se alguma trava caiu. **São quatro veredictos, e os quatro foram provados:**

| | |
|---|---|
| **acusa** | o defeito foi religado e uma trava caiu |
| **MUDO** | o arquivo MUDOU e nada caiu — a trava é decoração |
| **ANCORA** | o `de` não casou; nada foi testado (e isso **não é** um mudo) |
| **NAO COMPILA** | o recorte comeu uma chave: o teste morreria por sintaxe, não pela regra |

- **⚠️ ELE CONTA `FALHOU` **E** `FALHA`**, porque metade dos testes da casa imprime um e metade o
  outro — e o sumário imprime `N FALHA(S)`, então contar só ele dá "1 falha" em TODO caso. Um "1"
  idêntico em treze casos foi o que denunciou, e era a quarta vez desta armadilha.
- **⚠️ E "MORREU" É NÃO TER IMPRESSO O SUMÁRIO, nunca o stderr ter a palavra "Error".** O
  `test-ilhas` escreve **1.401 bytes de `console.error` MESMO PASSANDO** (ele exercita o caminho de
  erro de propósito), então o detector antigo marcava "(e morreu)" em tudo. **Detector que dispara
  sempre não é detector** — a mesma lição que o TypeError do stub de saves já tinha custado.
- **⚠️ ELE RESTAURA NO `finally` E NO `SIGINT`.** Um script que estoura no meio deixa o **defeito
  injetado no arquivo** — aconteceu nesta mesma sessão, e só o teste seguinte pegou.

### `tools/impressao.js` — a impressão do motor

```
node tools/impressao.js <a.html> <b.html>     (o uso que importa)
node tools/impressao.js index.html --sensivel
node tools/impressao.js ... --equipa --terreno
```

Ela já existia no scratchpad e era copiada a cada leva. Versionada, ela ganhou três coisas:

- **compara DUAS cópias** e diz o que mudou: *só o DIARIO* é apresentação, *os dois* é mecânica;
- **⚠️ `--sensivel`**, que mexe no `CRIT_BASE` e mostra os dois hashes andando. **Sem essa prova,
  "o hash está igual" e "o painel não alcança o código" são indistinguíveis** — e um hash imóvel só
  prova alguma coisa quando o painel exercita o caminho que a mudança toca;
- **⚠️ `--equipa` e `--terreno`**, porque o painel padrão **não equipa ninguém**: sem `ataques` o
  motor cai no de tipo e a tabela de aprendizado não é lida uma vez sequer. Em 24/09 isso quase fez
  uma mudança de moveset ser reportada como "não mexeu no motor".

### `tools/gerar-preview.js` — ele já existia, e ganhou a MEDIÇÃO

**⚠️ ELE ESTAVA VERSIONADO O TEMPO TODO** (30 telas, um arquivo só, sem servidor e sem rede, com
seletor de 320/390/430px) **e eu escrevi 40 prévias descartáveis por fora.** Na última delas cheguei
a subir um servidor HTTP na mão e a montar iframes que se empilharam.

O que ele ganhou:

- **`medir()` e um botão "Medir TODAS a 320px"** — a medição que eu fazia com 40 linhas de JS
  inline, uma tela por vez, agora varre as 34 de uma vez e reporta: **estouro de largura, texto
  cortado, selo vazio, interpolação literal na tela e `<h2>` em duas linhas**.
  **⚠️ Ela REVELA cada tela pra medir**: elemento com `hidden` tem caixa ZERO, e sem isso ela
  reportaria *"0x0, nada cortado"* em 33 das 34 — o zero perfeito, que é o falso verde mais comum
  daqui.
- **`--servir`**, porque a automação de navegador **recusa `file://`**. Pro humano continuam sendo
  dois cliques; pra mim é uma flag em vez de um servidor escrito do zero.
- **⚠️ O GERADOR PASSOU A CONFERIR O HTML QUE ELE GERA**, e essa é a lacuna de verdade: o `patch.js`
  confere o ARQUIVO que escreve, e a página é um artefato produzido depois. Um `\n` meu virou uma
  **quebra de linha de verdade** dentro de aspas simples (dupla camada de template literal), o
  script inteiro da página parou de rodar — **e o `node --check` do gerador passou**, porque ele
  estava válido. Sem a conferência, a única forma de descobrir é abrir e ver as abas mortas.
  Conferido que ela acusa.
- **as telas da Liga**: o anúncio da Liga Pro, a Clássica, a Clássica **com um chaveamento rodando**
  (o caso que mais me custou medição) e a Liga Pro.

#### ⚠️ E A MEDIÇÃO ACHOU DOIS DEFEITOS NA PRÓPRIA PRÉVIA

1. **TODA tela dela saía com os selos VAZIOS** desde que os emojis viraram desenho (18/09/2026): o
   `montarSelos()` injeta os símbolos no `document.body` **de verdade**, e a prévia é montada pelo
   sandbox, que não tem body. Cada `<use href="#s-x">` saía do tamanho certo e **sem desenho**.
2. **O modal era medido com a largura da JANELA**, não a da prévia — o overlay é `position:fixed`.
   O conserto é uma propriedade: **um ancestral com `transform` vira o bloco de contenção de
   qualquer descendente fixed**, então o `.pv-tela` ganhou `translateZ(0)` e o modal passou a se
   ancorar na caixa de 320px — que é o que o jogo faz num celular.

**Medido depois dos consertos: as telas com algo a olhar vão de 26 para 10** — e as 10 são achados
REAIS (um `<h2>` em duas linhas em quatro telas, `"🏆 Gary Oak"` cortado na lista de amigos), em
telas que ninguém tinha tocado. Elas ficam registradas aqui e **não foram mexidas**: não foram
pedidas e não são regressão.

### ⚠️ E ELE ACHOU 985 KB DE LIXO PUBLICADO

O `firebase.json` publica a RAIZ inteira, e o `hosting.ignore` é a única rede. Conferido em
produção: **`preview-telas.html` respondia 200** (542 KB), e os **quatro protótipos de referência**
(`corrida-`, `pescaria-`, `queimada-` e `resgate-pokemon.html`, 443 KB) também.

**⚠️ É O MESMO EPISÓDIO DE 24/09/2026** (a `previa-confusao.html`) por um padrão que não casa: o
`**/previa-*.html` que nasceu dali cobre *previa-* e não *preview-*. E os protótipos nunca entraram,
embora o `index-novos-graficos.html` — que é exatamente o mesmo tipo de arquivo — já estivesse lá.

**Não é vazamento de dado: é peso e ruído.** Os dois padrões entraram no ignore, e eles **saem do ar
no próximo deploy sozinhos** — cada `--only hosting` publica um instantâneo completo do diretório.

⚠️ **O `CLAUDE.md` (1,5 MB) continua no ar de propósito**, como o `tools/` — isso já estava
registrado na seção de Deploy e não foi mexido.

### ⚠️ O CLAUDE.md ERA 40% DO MEU CONTEXTO — e o motor saiu dele

Perguntado assim, no fim da leva: *"tem alguma coisa que eu ou voce possa fazer para diminuir o
tempo que voce esta levando para processar tudo? Eliminar algum arquivo que nao é necessário e voce
ta consultado?"*. **Medido, e o alvo era este arquivo:**

| | tamanho | carregado |
|---|---|---|
| **`CLAUDE.md`** | **1,5 MB — ~400 mil tokens** | ⚠️ **inteiro, em TODA sessão** |
| a memória da conta | 8,9 KB | toda sessão (irrelevante) |
| o scratchpad | 133 MB | **nunca** — só quando eu listo |
| a bateria | — | **52 s** |

**⚠️ E O CUSTO NÃO É LATÊNCIA, É ESPAÇO.** Ele fica em cache de 1 h, então reler não dói; o que dói é
sobrarem **600k dos 1M** pro trabalho — e é por isso que uma sessão longa **comprime no meio**, que é
o retrabalho de verdade (eu perco detalhe e releio o que já tinha lido).

**O QUE SAIU: a seção `## Os golpes do pokémon`, que tinha 249 KB — 16% do arquivo sozinha.** Ela
nasceu sobre a escolha de dois golpes e virou o registro do **motor inteiro**: os cinco status por
ataque, os estágios, o Metrônomo, a Fúria, o Remoinho, as danças, o clima, a suavização do log, o
moveset dos NPCs. Hoje ela é **`docs/motor-de-batalha.md`**, e o que ficou aqui é **a linha de índice
com o GATILHO** (*leia antes de mexer em dano, golpe, status, passiva ou log*) — sem ela a divisão
seria uma perda, porque a razão de este arquivo ser automático é justamente não depender de eu lembrar.

- **⚠️ A VARREDURA ACHOU O BALAIO DE VERDADE: duas das 39 subseções não eram de motor nenhum** — a
  **rolagem de lista** (18/09) e as **missões dos ninhos** da Montanha (18/09). Elas caíram ali por
  sequência de dia, e num capítulo chamado "motor de batalha" elas fariam o índice mentir. As duas
  voltaram a ser seções de nível 2 **aqui**.
- **⚠️ E A CONFERÊNCIA É DE CONTEÚDO, não de tamanho:** as **39 de 39** subseções foram achadas num
  dos dois arquivos, o corpo da seção foi conferido por amostra, e a soma fecha —
  `1.546.958 = 1.302.972 + 245.692 − 1.706`, onde os 1.706 são o cabeçalho e o índice novos.
  **Delta de tamanho não prova que nada se perdeu**: um recorte pode levar a metade de uma subseção
  e a conta continua fechando. É a mesma lição do `node --check` que aprova um arquivo 30% menor.
- **⚠️ NENHUM TESTE LÊ ESTE ARQUIVO** — conferido: as 13 menções a ele em `tools/` são todas em
  comentário (*"ver o CLAUDE.md"*), e nenhuma é `readFileSync`. Se alguma fosse, ela cairia em
  silêncio no dia em que o conteúdo mudasse de arquivo.
- **O capítulo VAI AO AR, como este arquivo já vai** (conferido: `jornadakanto.com/CLAUDE.md`
  responde **200 com 1,5 MB**, e está registrado como proposital na seção de Deploy). O peso
  publicado não muda — é o mesmo conteúdo em dois arquivos.

**⚠️ E O QUE ESTA DIVISÃO NÃO RESOLVE:** os outros 1,3 MB. As três maiores que sobraram são os
**minigames das Ilhas (318 KB em 14 seções)**, a **economia (230 KB)** e os **HMs (116 KB)** — e a
régua está aqui: dividir tudo por assunto levaria o fixo a ~15 KB e liberaria **~385k tokens**, ao
preço de eu ter que ler o capítulo certo em seis lugares em vez de um. Foi escolhido tirar só o
balaio, que é o maior ganho por unidade de risco.

**⚠️ E DUAS COISAS QUE NÃO ERAM O GARGALO, pra ninguém procurar ali de novo:** a **bateria leva 52 s**
(rodar tudo a cada mudança é barato), e o **scratchpad não me custa token nenhum** — ele só ocupa
disco. As **69 cópias congeladas do `index.html`** que as medições de A/B deixaram lá valiam **85 MB**,
e foram apagadas; o que elas custavam era espaço em disco, não contexto.

**⚠️ E FICA UM RISCO SEU NA RAIZ: o `index-novos-graficos.html` tem 23 MB.** Ele já foi colhido (a
cena nova está no jogo, 49 usos de `battle-scene`) e está no `hosting.ignore`, então não vai ao ar —
mas **23 MB são ~6 milhões de tokens**: uma varredura que o leia por engano estoura o contexto
sozinha. Ele é untracked e não é meu; fica registrado como a coisa mais perigosa do diretório.
### ⚠️ A BATERIA MENTIU, E TRÊS DEFEITOS MEUS FORAM PRO AR DE UMA VEZ (24/09/2026)

Reportado com print: *"está dando esse erro quando clica pra se inscrever na liga pro"* — a tela
dizendo **"Não deu pra sortear seus pokémon. Confira sua conexão"**. ⚠️ **A Liga Pro estava quebrada
em produção: ninguém conseguia se inscrever.**

**A CADEIA TEM TRÊS ELOS, e os três são meus:**

| | |
|---|---|
| **1. a trava** | ao inverter uma trava do `test-liga-pro` eu escrevi **`cli`** onde a variável é **`src`** — `ReferenceError` **no teste** |
| **2. a bateria** | ⚠️ **ela contou o teste morto como OK**, então nenhuma trava da Liga Pro rodava |
| **3. o código** | ao tirar a trava de "já está disputando", o `preambuloDaInscricao` deixou de devolver `ativo` — e o **`if(ativo)` ficou órfão** no `abrirBoloDaLigaPro`. `ReferenceError` → o `catch` → a mensagem do print |

**⚠️ O ELO 2 É O QUE IMPORTA: sem ele os outros dois teriam sido pegos na hora.** O meu laço de
bateria era um `grep -qE "FALHA|FALHOU"` na saída — e **um teste que MORRE não imprime nenhuma das
duas palavras**: ele imprime um stack trace. O laço contava isso como passou, e a sessão inteira
rodou com **43 de 43** enquanto um teste estava morto.

**⚠️ E A LIÇÃO JÁ ESTAVA ESCRITA — no `tools/acusar.js`, do mesmo dia:** *"MORREU é não ter impresso
o sumário, nunca o stderr ter a palavra Error"*. Ela tinha sido aplicada à **conferência de
acusação** e não à **bateria**. É a mesma armadilha em duas ferramentas irmãs.

**`tools/bateria.js` é a bateria com o critério certo, e ele é o EXIT CODE** — o único universal:
node sai != 0 quando o script estoura, quando o timeout dispara e quando o teste faz
`process.exit(1)`.

**⚠️ E O SUMÁRIO NÃO SERVE DE CRITÉRIO, o que a primeira versão dela provou na cara:** os testes da
casa têm **CINCO formatos** — `Tudo certo.` (35 deles), `N/N casos passaram.` (5),
`Tudo certo. (N casos)`, `Tudo certo.  (N asserções)` e `tudo certo` em minúscula. Conhecendo só o
primeiro, ela reportou **6 testes CERTOS como mortos**. Hoje o sumário entra só pra dizer POR QUE
falhou. **Conferido que ela pega o que o laço antigo deixava passar**: com o defeito religado, o
laço diz OK e ela diz `MORREU`.

**⚠️ E ELA ACHOU MAIS SEIS MORTOS NA PRIMEIRA RODADA — que eram falso positivo dela mesma.** Os seis
passavam, com um dos outros quatro formatos. É o lembrete de que **uma ferramenta nova mente nos
dois sentidos** até ser conferida contra o conjunto todo.

**O CONSERTO DO JOGO são duas linhas**, e a segunda estava no mesmo print:

- **o `if(ativo)` saiu** — e remover é o conserto CERTO, não um remendo: a trava foi tirada **a
  pedido** no mesmo dia. ⚠️ E o `node --check` passa nisso: `ativo` é uma variável, e o erro só
  existe em **RUNTIME** — a família do `moveTeam` que nunca existiu e do TDZ;
- **o erro e o "Sorteando…" apareciam JUNTOS** (está no print), porque eram duas condições
  independentes. ⚠️ Um "carregando" ao lado de um erro é pior que ruído: ele diz que ainda há o que
  esperar quando já acabou e falhou, e o jogador fica esperando.

**⚠️ E O QUE ISSO DIZ SOBRE AS TRAVAS DA LIGA PRO: elas ESTAVAM certas.** O `test-liga-pro` já
exercita o `abrirBoloDaLigaPro` **de verdade** (com o preâmbulo dublado) desde 24/09 — conferido,
religando o `if(ativo)` ele **acusa**. O que faltou não foi trava: foi **rodá-la**.
### ⚠️ AS TRÊS REGRAS QUE FICAM

1. **Texto com escape nunca passa pelo shell.** Receita em arquivo, e **regex LITERAL**
   (`/const X = (\d+)/`) em vez de `new RegExp('...')` — o literal não tem o que escapar.
2. **Medir a caixa ANTES de escrever o conteúdo que vai dentro dela.** O anúncio da Liga Pro foi
   cortado duas vezes por causa disso.
3. **Verificação de sintaxe não é verificação de conteúdo.** O `node --check` aprova um `}` a mais
   dentro de um template literal (ele é TEXTO), um arquivo 30% menor e um artefato quebrado. O que
   denuncia é o **número** — o delta de tamanho, a contagem de asserções, a de ocorrências.

## Frontend

- **A tela de notificações é uma caixa de entrada**: lista de títulos em cima, corpo do que está
  aberto embaixo. Antes cada notificação era um card inteiro aberto — com quatro ou cinco, a tela
  virava uma parede de texto onde nem dava pra ver quantas eram. A mais recente abre sozinha (a
  tela existe pra LER a notificação; abrir com o painel de baixo vazio cobraria um clique só pra
  chegar onde a pessoa já queria chegar), e a seleção cai nela sozinha quando a aberta é apagada.
  **A marcação de lida continua sendo em bloco, na abertura da tela.** Marcar uma a uma seria o
  natural num e-mail, mas deixaria o sino da home aceso enquanto sobrasse uma não aberta — e a
  decisão antiga era não cobrar um clique por notificação. O selo **NOVA** devolve a informação que
  a marcação em bloco apaga: ele marca as que estavam por ler AO ABRIR a tela.
  **⚠️ A LISTA MOSTRA 6 E ROLA, e o teto é em PX — não em `vh`** (17/09/2026, a pedido). Ele era
  `42vh`, que é relativo à **JANELA**: a 320×568 dava 239px (5,8 linhas, por acaso perto de 6), e
  numa tela de 800px de altura daria 8. A linha mede **41px**, então 6 delas são **246** — e aí o
  "6" é verdade em toda tela. É a mesma conta da `.loja-lista`.
  **⚠️ E O QUADRO DE BAIXO TEM ALTURA FIXA** (a pedido: *"deixe o quadro debaixo onde exibe as
  informações sobre a notificação, fixo na tela, hoje ele fica se movendo, aumentando e diminuindo,
  conforme deleta ou troca de notificação"*). Medido a 320px nos **dez tipos**: ele ia de **188 a
  355px** — 167px de diferença, e a tela inteira pulava a cada troca.
  **É exatamente o mesmo defeito que a LOJA teve em 13/09, e o conserto é o mesmo:** altura FIXA (o
  maior caso medido, o campeão de liga com os dois botões) e uma **coluna de três andares** — topo,
  miolo que ROLA, e o rodapé colado embaixo.
  **⚠️ ALTURA E NÃO `min-height`:** com ela o pulo volta no primeiro texto que passar do valor.
  **⚠️ E O `overflow` VIVE NO MIOLO**, nunca no quadro: no quadro inteiro o rodapé rolaria junto e o
  **botão de apagar** voltaria a sair do lugar — que é o que se pediu pra parar. Medido depois: os
  dez tipos em **355px** e o Apagar sempre no mesmo Y.
  O título do corpo usa a fonte de TEXTO, não a de pixel dos títulos de seção: é conteúdo, e a de
  pixel gastava três linhas a 320px. `tools/test-notificacoes.js` cobre os três estados da tela, a
  seleção, o selo e o CTA de cada tipo de notificação.
  **Dá pra marcar várias e apagar de uma vez** (botão "Selecionar"): no modo de seleção a linha
  MARCA em vez de abrir e o corpo some da tela — ninguém está lendo uma notificação enquanto separa
  dez pra apagar, e sem ele a lista inteira cabe na tela. A caixinha de marcar é um span dentro do
  botão da linha, não um `<input type=checkbox>`: a linha toda já é o alvo do toque, e mirar num
  quadradinho de 16px num celular é pedir erro.
  O lote vai numa chamada só (`deleteNotifications`, um batch do Firestore com teto de 400) — quem
  motivou o pedido foram 21 notificações iguais de um defeito, e 21 chamadas de rede pra uma ação
  que é uma só seria trocar um incômodo por outro. A confirmação NOMEIA o que tem prêmio dentro
  (bônus shiny não ativado, empréstimo do Mewtwo): apagar isso é perda definitiva, e num lote é
  ainda mais fácil levar junto sem ver.
### O BOTÃO QUE LEVA ATÉ O CAMPEONATO (16/09/2026)

Pedido assim: *"nas notificações das ligas pokemons adicione um botão para levar até o campeonato
que a notificação está falando sobre"*.

- **TODA notificação de liga já carregava `meta.leagueTypeId`** desde que elas existem — o que
  faltava era a porta. São **cinco**: `league_started`, `league_ended`, `league_delayed`,
  `match_played` e `league_champion`.
- **O TEXTO NOMEIA O DESTINO** ("Ir para a Trainers League", "Ir para a Liga Clássica"): um "Ver a
  liga" genérico num aviso de Trainers League mandaria o jogador procurar qual delas.
- **NO CAMPEÃO SÃO DOIS BOTÕES, e a ordem importa**: o prêmio vem primeiro porque é a ação que
  **EXPIRA** (o bônus shiny vale uma hora depois de ativado), e a liga é só pra rever.
- **Notificação sem `leagueTypeId` não ganha botão** — as antigas, gravadas antes do campo. Um
  botão que leva pra lugar nenhum é pior que nenhum.

**⚠️ E A ARMADILHA É A LIGA CUSTOMIZADA: ela precisa da CONFIG, não só do id.** O
`currentLeagueTypeConfig` carrega o `allowedTypes`, e é **ele** que decide qual montador de time
abre (ver `openLeagueTeamPicker`). Abrindo só com o id, uma liga restrita a um tipo cairia no
montador comum — e **o jogador inscreveria um time que ela não aceita**, descobrindo isso só na
hora de perder. Por isso o `irParaALiga` faz uma leitura a mais, e **só nesse caso**: a Clássica e
a Trainers não têm config pra buscar.
Se a leitura falhar, ele abre a liga assim mesmo — chegar na tela certa sem o cabeçalho é melhor
que não sair do lugar —, mas o montador restrito é justamente o que se perde, então o erro é
logado em vez de sumir.

- **A Torre ficou de fora**, e é escopo: o pedido diz "notificações das ligas". As duas dela
  (`tower_top`, `tower_cleared`) têm a mesma forma de problema e nenhuma porta.
- `tools/test-notificacoes.js` tranca 16 pontas: as cinco com botão, o texto nomeando as duas
  ligas conhecidas, a que não tem `leagueTypeId` sem botão, o prêmio antes da liga no campeão, o
  que não é de liga sem botão, a customizada chegando **com o `allowedTypes`**, a Trainers pela
  porta dela, a Clássica sem gastar leitura, e a leitura falhando sem travar.

#### ⚠️ E ELE NÃO LEVAVA A LUGAR NENHUM (17/09/2026)

Reportado assim: *"o botão que leva para a liga que a notificação está informando, não está levando
para lugar nenhum, nada acontece"*.

**A causa é de UMA linha, e ela não é de lógica: o valor saía de um `JSON.stringify`.** Ele põe
**aspas duplas** numa string, e o atributo `onclick` é delimitado por aspas duplas:

```html
onclick="irParaALiga("classic")"
```

A aspa do valor **fechava o atributo**. O navegador lia `onclick="irParaALiga("` — sintaxe inválida —
e o clique não fazia nada, **em silêncio, sem erro no console**.

- **O conserto é o `escJs`**, o ajudante da casa que escapa as DUAS camadas (a string JS e o
  atributo HTML), com aspas simples dentro das duplas. É o que todo o resto do arquivo já usa.
- **⚠️ E A TRAVA QUE EXISTIA NÃO PEGOU PORQUE ELA MEDIA A PRESENÇA.** Ela procurava `irParaALiga` no
  HTML, e ele **estava lá** — o que faltava era o atributo ser válido. Hoje ela cobra a chamada
  inteira (`onclick="irParaALiga('...')"`), e há uma segunda varrendo o **arquivo todo**: nenhum
  `onclick` do jogo pode usar `JSON.stringify`. Essa é a que teria pego o de hoje, e é a que pega o
  próximo botão que nascer assim.
- **Conferido que as duas acusam** com o `JSON.stringify` religado: 5 falhas.

- **Não redesenhar a tela durante animações.** Cada `render()` recria o HTML e mata a transição
  CSS da barra de HP no meio. Animações atualizam o DOM diretamente. Já causou três bugs.
- Timers que dependem de `render()` param quando o render fica raro. Cronômetros têm laço próprio.
- Barra de HP: usar `renderHpBar` e as classes `hp-bar-fill` + `hpBarClass`. Marcação própria
  parece igual mas não recebe as regras de cor.
- Ícones da home são pixel art em base64 na constante `ICONES`. **Diagonais finas não sobrevivem
  à redução** — usar formas sólidas.
- Testar layout em 320px, não só 390px.
- **`touch-action: manipulation` no `html` e no `body`.** Tocar rápido várias vezes no mesmo botão
  (o "+" da distribuição de níveis é o caso clássico) fazia o celular entender toque duplo e dar
  zoom, e daí em diante mexer no jogo virava um transtorno. `manipulation` desliga SÓ o toque
  duplo — o pinça-pra-ampliar continua, que é o que importa pra quem depende dele. O
  `maximum-scale=1` que já existia no viewport **não resolve**: o Safari do iPhone ignora esse
  atributo desde o iOS 10, de propósito.
- **A faixa branca do atalho-app** era o fundo do `<html>`, que não tinha cor: em modo standalone,
  puxar além do fim da página revelava o branco por baixo. Hoje o `html` tem o fundo escuro do jogo
  e `overscroll-behavior:none`.
- **A rolagem é preservada quando a MESMA tela é redesenhada.** O `render()` troca o `innerHTML`
  inteiro a cada toque, e no atalho-app a rolagem escorregava a cada "+" até mostrar o vazio embaixo
  do conteúdo. Trocar de tela não foi tocado — continua como sempre foi.

## Armadilhas conhecidas

- O Mewtwo emprestado é gravado pelo servidor com só `{speciesId, level, shiny}`. `hydrateTeam()`
  completa os campos no carregamento — sem isso, qualquer tela que leia `p.types` quebra.
- `createInstance()` não copia a flag `shiny`. Ao criar instâncias manualmente, copiar na mão.
- Ao transformar algo em fase própria (ex: a contagem regressiva da batalha online), **procurar o
  bloco antigo**: ele costuma continuar disparando sozinho. Aconteceu duas vezes.
- Pokédex normal e shiny são listas separadas. Marcador de "já tenho" precisa consultar a certa.

## Contexto do jogador

- Ele testa em celular e manda print. Vale renderizar a tela e conferir antes de entregar.
- Prefere entender o custo de uma decisão a receber só o resultado.
