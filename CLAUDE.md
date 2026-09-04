# Jornada Kanto

Fangame de Pokémon Gen 1 em português, jogável no navegador. No ar em jornadakanto.com.
Dev: Matheus (Buzzo no jogo).

Este arquivo guarda **decisões e armadilhas** — o que NÃO dá pra deduzir lendo o código.
Estrutura de arquivos, dependências e o que cada função faz: leia o código, ele é comentado.

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
  `no-cache` não quer dizer "não guarde": o navegador guarda e **revalida pelo ETag** a cada visita,
  então o custo normal é um 304 vazio. O que muda é que o deploy passa a valer no próximo F5.
- **Deploy que demora não é deploy que acabou.** As ~67 functions levam vários minutos e o hosting
  entra no fim da leva: enquanto ela roda, o que está no ar ainda é a versão anterior. Testar nesse
  intervalo devolve o comportamento velho -- foi exatamente o que aconteceu no print da Faixa.
  Conferir com o `Deploy complete!` e, na dúvida, comparar o arquivo no ar com o local
  (`curl -s https://jornadakanto.com/index.html | cmp - index.html`).
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
- **Crítico ainda é Gen 1** (`velocidade/512`, e o crítico dobra o nível na fórmula). A Gen 2 usa
  1/16 fixo com multiplicador ×2. É o maior desvio que resta: hoje a taxa média é 13,4% e 138 das
  150 espécies criticam mais do que criticariam na Gen 2 (Electrode 27,3%, 4,4× a taxa oficial).
  Decisão em aberto — foi medido e apresentado, não escolhido.
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
- Velocidade alta é mais valiosa do que parece, porque entra na taxa de crítico (ver acima).
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
- Buffs: **shiny 1,20× e terreno 1,15×, em TODOS os atributos** — ataque, especial, defesa,
  velocidade e HP. Multiplicam entre si: um shiny no terreno do tipo dele fica 1,38× em tudo.
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
- Teto de nível: **99** (`MAX_POKEMON_LEVEL`).

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
  Metrônomo são os **4 pedidos** (Togepi, Togetic, Cleffa, Snubbull). Clefairy, Clefable e Snorlax
  também aprendem Metrônomo por nível no original e ficaram **de fora de propósito**: são espécies
  comuns em time de jogador e de líder, e o metrônomo é o golpe mais aleatório dos três.
- **O sono dá DUAS TROCAS livres, não mata mais** (`SONO_EM_TROCAS = 2`, 02/09/2026). O alvo apanha
  sem revidar por duas trocas e então acorda; a luta segue normal. Como o Disable e a Recuperação, é
  `continue` e não `return true` — o confronto acontece inteiro.
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

- **Chance por CONFRONTO, não por golpe**: 15% autodestruição, 5% sono.
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
- **DRENAGEM (`ABSORCAO`, 10%): 23 espécies, e acontece ANTES da luta**, no mesmo lugar do Recuperar.
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
  `tools/test-especiais.js` confere que **as 59 espécies das quatro listas** aparecem e que todo
  golpe que o motor sabe gerar tem tipo declarado — sem isso o selo sairia num cinza genérico, e só
  no confronto que teve aquele golpe.
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

## Log de batalha

- O matchup carrega **`golpes`**: o diário do confronto, um registro por golpe na ordem real,
  escrito por `doExchange`. Não é reconstrução — o motor anota enquanto luta. Só apresentação:
  passar ou não o array não muda um ponto de dano (conferido por hash, 14.645 confrontos).
- **O dano gravado é o EFETIVO, não o sorteado.** Golpe de 101 em quem tem 54 de HP entra como 54.
  Com o valor cru o log não fechava: somando as linhas dava mais dano do que o pokémon tinha.
- **Log e animação leem a MESMA lista** (`sequenciaDoConfronto`). Enquanto eram montadas em separado,
  o jogador via 3 golpes na tela e lia 4, 7 linhas no log — reportado três vezes.
- **O TETO DE 3 GOLPES VALE, e vale por leitura: uma luta comum tem que caber em duas ou três
  linhas.** Medido, 99,4% dos confrontos passam de 3 golpes REAIS (mediana 4, 90% até 6, maior 28 em
  3.944), então o teto não é um detalhe — é ele que decide o que a tela mostra quase sempre.
  **Ele chegou a sair inteiro por um dia** (03/09/2026), pra o log mostrar o diário: uma troca banal
  de Gloom contra Miltank virou **seis linhas** e foi reportado com print. Voltou no mesmo dia.
- **A EXCEÇÃO É O SONO, e só ele.** As trocas livres que ele compra são o que o golpe É, e esmagá-las
  na reconstrução foi a origem dos dois defeitos reportados naquele dia ("um golpe dele, dois dela").
  Elas entram **reais, uma linha cada**, e só o RESTO da luta é reconstruído.
  Medido: **sem sono, 98,6% dos confrontos ficam em 3 linhas e 1,4% em 2** — a leitura de sempre.
  **Com sono: 4 linhas em 19,5%, 5 em 41,5%, 6 em 5,9%** (as seis são quando quem usou o sono é o
  mais rápido e ganha 3 golpes livres) e 2 linhas em 33,2% (o confronto acabou dentro do teto).
- **E SAI DA ORDEM DO DIÁRIO, não da lista já reordenada pelo `passosVisiveis`.** Ele move o golpe
  MORIBUNDO pra antes do golpe que derrubou quem o deu — e na lista reordenada esse moribundo
  aparecia ANTES do primeiro golpe do adormecido, entrando na conta como se fosse troca livre.
  **Com o golpe que MATOU contado como livre, a reconstrução ficava sem nada pra mostrar do lado do
  inimigo e emitia um "−0 de HP" na tela**, além de deixar o morto atacando.
  Reportado em 04/09/2026 com print (um Paras que matava a Staryu, ela ainda atacava, e o Paras
  fechava com um golpe de zero). **Raro — 1 em 21.556 confrontos — e ANTIGO**: não tem nada a ver
  com a Faixa de Foco, que só o trouxe à tona por estar sendo olhada.
- **A reconstrução também não pode emitir golpe de dano zero.** Ela devolve um lado com zero quando
  o outro já levou tudo, e o filtro `(g.x || g.d > 0)` só vale pro DIÁRIO — a saída dela passava
  direto. Os dois caminhos (sono e Faixa) filtram agora.
- **O teste que deixou isso passar era pequeno demais.** Ele rodava 4.000 confrontos de uma lista
  curta de espécies; o defeito aparece em 1 de 21.556. A varredura nova roda **13.000 confrontos
  cobrindo todas as espécies**, sem item nenhum, e cobra as duas coisas: nenhum golpe de dano zero
  na tela e ninguém atacando depois de cair. Amostra pequena não é teste de invariante raro.
- **Quantas trocas livres sai do DIÁRIO, não de `SONO_EM_TROCAS`.** Os dois números não são iguais: o
  sono compra 2 trocas, mas quem usou, se for o mais rápido, ainda bate primeiro na troca em que o
  outro acorda — e aí são 3. Ler do diário acerta os dois casos, acerta o **sono DUPLO** (os dois se
  dormem, os contadores correm juntos e ninguém ganha troca livre) e continua certo se a duração do
  sono mudar.
- **A reconstrução pega só o que SOBROU.** Ela interpola entre o HP do começo e o do fim, então o
  "começo" dela tem que ser depois da cura E depois das trocas livres — senão ela recontaria o dano
  que as linhas de cima já mostraram, e a soma do log passaria do HP que o pokémon tinha. É o mesmo
  ajuste que a cura já fazia sozinha desde 02/09/2026.
- **GOLPE DE DANO ZERO NÃO É GOLPE.** Ele existe no diário: quando o alvo já está em 0, o dano
  EFETIVO é 0 — é o revide de quem caiu contra quem já tinha caído. Vira um "**−0 de HP**" na tela,
  que é o que faz procurar bug onde é regra (mesmo motivo do "mas não teve efeito" da imunidade).
  Fica fora da sequência. As **aberturas** (sono, cura) têm `d=0` de propósito e ficam: não são dano,
  são o passo.
- **Alguém sempre vai parecer agir depois de cair, e a regra escolhe quem.** Medido em 4.000
  confrontos: 205 são o **golpe moribundo** (que entra ANTES do golpe que derrubou quem o deu — os
  dois são do mesmo instante) e 52 são a **explosão** (um evento só, duas entradas). Fora esses dois,
  **zero**.
- `tools/test-especiais.js` tranca tudo isso junto: a animação tem os MESMOS passos do log, a soma de
  dano de cada lado fecha, não há golpe de dano zero na tela, ninguém ataca depois de cair fora dos
  dois casos, o sono mostra as trocas livres que compra, **luta sem golpe especial não passa de 3
  linhas** e a com sono passa. Conferido que ele falha ao tirar o teto (3.870 de 3.925) e ao tirar a
  exceção do sono.
- **O golpe moribundo vale CHEIO** (`DYING_BLOW_FACTOR = 1.0`). Valeu metade até 30/08/2026, e o
  efeito colateral era ilegível: um Venusaur com vantagem de tipo tirava 112 em vez de 223 e o
  jogador procurava bug no multiplicador. Medido na mudança: **11,2% das batalhas trocam de
  vencedor** (a maior mexida desta série), taxa de vitória geral parada (51,3% → 51,0%), e os
  confrontos decididos no **desempate sobem de 6,5% pra 14,6%** — mais gente cai junto.
  Quem sobra no desempate volta com **5%-15%** da vida (já foi 1%-3% e 1%-10%). Subir a faixa
  mexe pouco: 0,5% das batalhas mudam de vencedor, e o sobrevivente passa a vencer o confronto
  seguinte em 0,6% das vezes, contra 0,2% — continua sendo um empate que ele ganhou no critério,
  não uma vitória.
  Armadilha: a marca de moribundo tem que sair da SITUAÇÃO (o segundo caiu e revidou), não de o
  dano ter sido reduzido. Enquanto era deduzida do dano, subir o fator pra 1.0 apagava a marca —
  e sem ela o log volta a mostrar pokémon atacando depois de cair.
- O **golpe moribundo** entra **ANTES** do golpe que o derrubou. Não é distorção — os dois são do mesmo instante, e o motor só os aplica em sequência
  porque código roda em sequência. Qualquer outra ordem faz o log dizer que alguém atacou depois
  de cair, e isso já foi reportado como bug três vezes (inclusive na forma "somar o revide numa
  linha anterior", que fazia a linha antiga parecer fatal).
- A linha do log tem **uma forma só**: "X atacou Y com GOLPE e tirou −N de HP". Já passaram por
  ali selo de crítico, de moribundo e de "o tipo não pega nele" — todos saíram: viravam ruído numa
  linha que se lê de relance. As **exceções são os três golpes especiais** (autodestruição,
  sono e Disable, seção acima): ali não há número pra contar a história, e sem a frase o jogador
  vê dois pokémon caindo juntos -- ou um deles batendo mais fraco do resto da luta -- sem
  explicação nenhuma. As frases vivem no `fraseDoEspecial`, e o aviso do meio da batalha lê a
  mesma função.
- **A animação mostra o mesmo diário.** `buildAnimatedHitSequence` devolve os golpes reais (pelo
  `passosVisiveis`, pra dobrar o moribundo igual ao log); a reconstrução antiga — até 3 golpes
  inventados a partir do HP antes/depois — virou fallback pra confronto gravado antes do diário.
  Enquanto as duas coexistiram, a contagem batia em só 31% dos confrontos, e o jogador via 3
  golpes na tela e lia 7 linhas no log.
- **A animação ONLINE tem orçamento de tempo** (`ORCAMENTO_ANIM_ONLINE_MS`, 4,5s): o servidor
  reserva 5,2s antes de abrir a janela de escolha, e luta real longa estourava isso — medido, a
  mediana é 2,1s mas a cauda ia a 18s. Passando do orçamento, cada golpe anima proporcionalmente
  mais rápido. Na jornada não existe orçamento: lá ninguém está esperando o outro lado.
- Nomes de golpe (`MOVE_BY_TYPE` + `MOVE_OVERRIDES`, 150 espécies / 294 combinações) vivem **só no
  cliente**. O servidor manda o TIPO; o cliente escolhe a palavra. É o que evita mais uma tabela
  duplicada pra sair de sincronia.

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

## Equipe Rocket

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

## A loja de verdade: Despertar, Poção e Super Poção

- **OS TRÊS SÃO DE EQUIPAR, num pokémon específico** (03/09/2026). Nasceram como interruptor da
  CONTA — usava na mochila e o efeito valia pro time inteiro, em qualquer save, por 10 minutos ou
  até a poção disparar. Hoje o item vai num pokémon: o + da tela de ordem de batalha, e ele protege
  ou cura **aquele**. Vira escolha ("quem eu protejo do sono?") em vez de um botão ligado por fora.
  **O que isso custou está medido, e é grande:** ver "O preço da mudança", no fim desta seção.
- **Agora existe ARMAZÉM.** Até aqui a mochila era uma leitura do que a conta já tinha (o contador de
  doces e os cupons de bônus shiny). Item comprável precisa de estoque, e ele é do SERVIDOR pelo
  mesmo motivo das moedas: uma linha no console viraria Despertar infinito — e Despertar infinito
  **desliga um golpe do jogo inteiro**. `inventario` (item → quantos) e `equipados` (espécie → item)
  entraram na trava do `firestore.rules` junto de `moedas` e `rareCandies`. Quem escreve é
  `buyItem`/`equipItem`/`unequipItem`/`consumeEquipped`.
- **A chave dos equipados é `"SLOT:RAIZ DA LINHA"`** — o save MAIS a linha evolutiva. Nunca o id da
  instância, nunca a espécie sozinha, e nunca a linha sozinha.
- **O SLOT entrou em 04/09/2026, reportado:** a chave era só a linha, e o item vazava entre saves.
  Um Venusaur no slot 11 e outro no slot 5 são o mesmo `venusaur` pra conta, então equipar num fazia
  o item aparecer no outro. O comentário que justificava a chave antiga dizia "espécie é única na
  conta pra este fim" — ela é única dentro de UM SAVE (o encontro selvagem nunca oferece uma linha
  que o time já tem, e o montador recusa repetida), mas a conta tem até 20 saves e nada impede dois
  Venusaur. **É a mesma correção que a espera do Ginásio da Cidade já tinha feito**, e pelo mesmo
  motivo: lá a chave também virou save+espécie depois de um jogador ver oito pokémon marcados por
  causa de seis.
- **O slot é por POKÉMON, não por time** (`p.slotDaConta`): na jornada o time é todo de um save, mas
  na Torre e no Ginásio da Cidade ele MISTURA saves, e cada escolhido traz o slot de onde saiu.
  `equiparItens(time, equipados, slotPadrao)` usa o do pokémon quando existe e o padrão quando não.
- **Três caminhos precisaram carregar o slot até a batalha**, e cada um perdia de um jeito:
  o `createInstance` da Torre monta do zero e não copia campo nenhum (o mesmo motivo pelo qual o
  shiny já tinha que ser recopiado ali); a raide monta do save gravado e recebe o slot no pedido; e
  o Ginásio da Cidade transforma o time num **CÓDIGO**, que é compacto e não carrega slot — ali os
  slots viajam **dentro do match**, como a especialidade e os equipados já viajam, e são carimbados
  logo depois do `decodeTeamCode`.
  Cuidado ao mexer nisso: o carimbo tem que ficar **junto do decode**, não perto da chamada da
  batalha — a trava que LÊ O CÓDIGO exige um `applySpecialtyBuff` nas 12 linhas anteriores, e
  qualquer coisa empurrada pra ali a quebra.
- **CHAVE VELHA (sem slot) CONTINUA VALENDO na leitura**, pra ninguém perder item no deploy: ela casa
  com qualquer slot, que é como se comportava. Na primeira vez que o jogador mexer naquele item ela é
  apagada e nasce a nova — o dado se conserta sozinho, sem migração.
- **O `raizDaLinha` virou a base da CHAVE, então os dois motores têm que concordar sobre ele.**
  Discordância ali faz o cliente gravar numa chave e o servidor procurar noutra, e o item some sem
  ninguém entender. `tools/test-especiais.js` compara a raiz das **250 espécies** entre os dois — por
  VALOR, não por texto: os dois arquivos têm comentários próprios. O `id` (`mon7`) vem de um contador que recomeça do 1 a cada carregamento de
  página e **repete entre saves** — foi assim que um jogador viu oito pokémon marcados por causa de
  seis (ver a seção do Ginásio da Cidade).
  **A ESPÉCIE foi a primeira tentativa e durou um dia**: o pokémon EVOLUI e a espécie muda. Uma
  poção equipada num Charmeleon ficava presa na chave `charmeleon` enquanto o bicho passava a se
  chamar `charizard` — a tela mostrava o + de "sem item" e a batalha não aplicava nada.
  Reportado em 03/09/2026: *"coloquei uma poção no charmeleon, ele nem entrou na luta, evoluiu, e a
  poção sumiu"*. **Ela não sumia da conta**: ficava fora do armazém, invisível e IRRECUPERÁVEL,
  porque a tela só sabe pedir pela espécie que está vendo.
  **As duas hipóteses do relato foram separadas por medição**: trocar de partida não mexe em nada (o
  motor não anota gasto de quem não lutou, e o mapa sai intacto); a evolução, sozinha, causa tudo.
  A raiz é tão única quanto a espécie era pra este fim (um save não tem duas do mesmo bicho — o
  encontro selvagem nunca oferece uma linha que o time já tem e o montador recusa repetida) e junta
  os dois lados da bifurcação, que é o que se quer: Slowbro e Slowking são o MESMO Slowpoke. E tem a
  propriedade que faltava — **ela não muda quando o pokémon evolui**.
- **A LEITURA aceita QUALQUER chave da mesma linha** (`itemEquipado`), e é isso que devolveu o que já
  estava perdido **sem migração de dados**: uma poção gravada em `charmeleon` volta a ser achada pelo
  Charizard. A ESCRITA grava na raiz e **apaga toda chave velha da linha** — deixar a antiga pra trás
  faria o item ressuscitar na leitura seguinte.
- **O `EVOLUTION_CHOICES` virou a QUINTA tabela duplicada** (com SPECIES, GEN2_SPECIAL, EVOLUTIONS e
  TERRAINS): o `raizDaLinha` precisa dela pros dois lados chegarem na MESMA raiz, senão o servidor
  procuraria o item do Slowking sob `slowking` e o cliente sob `slowpoke`. `tools/test-johto.js`
  compara as duas por VALOR, como já fazia com as outras.
- **Equipar TIRA do armazém; desequipar DEVOLVE; trabalhar PERDE.** Trocar o que o pokémon já
  carregava devolve o antigo — perder um item por ter clicado no botão errado seria pior que a troca
  não acontecer. Tudo em transação: sem ela duas abas leem o mesmo estoque e as duas passam, e um
  Despertar protege dois pokémon.
- **Preços: Bônus Shiny 800, Doce Raro 300, Despertar 50, Super Poção 50, Faixa de Foco 50,
  Poção 30, os cinco de atributo 30.** O número vive no cliente (`ITENS`) E no servidor (`LOJA`):
  o cliente precisa dele pra desabilitar o botão, o servidor é quem cobra. Se os dois divergirem, a
  tela promete um preço que a cobrança não pratica.
  A Super Poção era 30 e a Poção 15; subiram em 04/09/2026. Pela medição anterior isso põe a Poção
  em **0,070 ponto por moeda** (era 0,141) e a Super em **0,063** (era 0,105) — elas deixam de ser
  as compras mais eficientes e passam a valer o mesmo que os de atributo.
- **A LOJA É UMA LISTA, com o quadro de cima FIXO** (04/09/2026). Era a mesma grade de quadradinhos
  da mochila, e com 11 itens ela parou de funcionar: o quadradinho mostra só o ÍCONE, e metade dos
  ícones são emojis parecidos (❤️ ⚔️ 🛡️ 🔮 ✴️) — não dava pra escolher sem clicar em cada um.
  A lista traz **ícone, nome, quanto você já tem e o preço**, sem cobrar um toque.
  O quadro de cima é `position:sticky` e não `fixed`: fixed sairia do fluxo e a lista subiria por
  baixo dele; sticky o mantém dentro da coluna do app, com a mesma largura, e ele só "cola" quando o
  topo passa por ele. **Sem isso o jogador rolava até o item, clicava, e voltava pra cima pra ler o
  que ele faz e comprar** — duas viagens pra uma decisão. Conferido a 320px: rolando 400px, o quadro
  fica em `top:0` e só a lista anda.
  A **mochila continua com a grade**: ela mostra o que você TEM (raramente mais que três ou quatro
  pilhas), e ali o quadradinho ainda funciona.
- **A loja vende os CINCO desde 03/09/2026.** O Doce Raro e o Bônus Shiny voltaram a ter preço; eles
  continuam vindo de jogar também, e é por isso que **cada um lê de uma fonte própria**
  (`quantoTenho`) em vez de sair de um campo só:
  o Doce Raro do contador `rareCandies`, o Bônus Shiny dos CUPONS (save campeão + notificação de liga)
  **mais** o estoque comprado, e os três de batalha do armazém. Derivar tudo do `inventario` faria a
  mochila mostrar **duas pilhas** do mesmo item.
- **O Doce Raro comprado vai pro CONTADOR, não pro armazém.** É o mesmo `rareCandies` que a Torre
  escreve e o `useRareCandy` desconta — pôr o comprado noutro lugar faria o doce existir em dois
  lugares, com duas contas que divergem no primeiro erro.
- **O Bônus Shiny comprado tem função própria pra ativar** (`activateBoughtShinyBonus`): os outros
  dois caminhos leem um CUPOM (o save campeão, a notificação), que é marca de prêmio e não estoque.
  **Na mochila o CUPOM é gasto primeiro**, porque é ele que pode sumir sem ser usado — apagar a
  notificação apaga o cupom. O comprado está no armazém e não corre risco.
  **Ativar um com outro valendo SOMA o tempo**, não reinicia: reiniciar jogaria fora o que sobrou e
  o jogador não teria como saber que perdeu.
- **A LOJA ABRE NO PRIMEIRO ITEM QUE ELA VENDE.** Hoje ela vende tudo, então o cuidado ficou sem
  efeito prático — mas ele existe porque um item sem preço no catálogo deixava o quadro de cima
  VAZIO, e foi pego pelo teste no dia em que a loja passou a vender.

### O popup de quantidade
- **Comprar abre um popup** com −/+, um botão **Máx** e o total. O teto é **o que o dinheiro
  compra** (`maximoQueCabe` = `moedas / preço`, arredondado pra baixo).
- **O teto da tela é conveniência; quem valida é o SERVIDOR**, contra o saldo lido DENTRO da
  transação — o saldo pode ter mudado em outra aba entre abrir o popup e confirmar.
- **Pedir mais do que cabe leva o que cabe**, não recusa a compra inteira: pedir 10 com dinheiro pra
  4 leva 4, e a resposta diz quantos foram (`comprou`/`gastou`). Recusar tudo porque o saldo mudou
  seria pior que entregar o que dá. Quantidade ausente compra 1 — é o que um cliente antigo em
  cache manda.
- **Não há teto artificial**: o limite é o dinheiro, e um pedido absurdo é cortado pelo próprio
  saldo dentro da transação.
- **O Máx fica na MESMA linha do −/+**, e não escondido: num toque, ele é o único caminho real pra
  comprar 20 — ninguém aperta o + vinte vezes.
- **O número vai na fonte de TEXTO, não na de pixel.** Medido na tela: "83" na fonte de pixel se lê
  como outra coisa; ela é de título curto, e aqui o número É a informação.
  A 320px o popup mede 265px e o stepper 223 — cabe numa linha, sem rolagem.

### O preço das duas vendas novas, medido
- A moeda vem de jogar: **70 por jornada completa**. Então o preço de cada item é, na prática,
  **quantas jornadas ele custa**: Poção 0,21 · Super Poção 0,43 · Despertar 0,71 ·
  **Doce Raro 4,3** · **Bônus Shiny 11,4**.
- **O Doce Raro é +1 nível, e um nível sozinho quase não se vê**: medido em 8.000 batalhas 6x6
  nível 60 (1σ = 0,79 ponto), +1 nível no líder do time vale **+0,54 ponto** — dentro do ruído.
  O que ele compra é ACÚMULO: +5 níveis valem **+4,25** (5,4σ) e +10 valem **+8,19** (10,4σ).
  A 4,3 jornadas por doce, subir um pokémon 10 níveis custa **43 jornadas completas**. É lento de
  propósito, e o teto de nível 99 continua valendo.
- **O Bônus Shiny é o item mais forte da loja, e de longe.** A chance dele não é fixa: começa em 5%
  e sobe **+10 pontos por encontro sem shiny** enquanto durar (`SHINY_PITY_STEP`). Calculado:
  39% de já ter um shiny no 3º encontro, **78% no 5º, 99% no 8º** — ou seja, uma jornada inteira sob
  o bônus é praticamente um shiny garantido, contra **6,1%** sem ele no modo normal.
  As 11,4 jornadas de preço são o que segura isso; se um dia incomodar, o lugar de mexer é o preço.

### O + DA TELA DE ORDEM (onde o item entra no pokémon)
- **Está nas QUATRO telas de ordem** onde o jogador entra em batalha: jornada, desafio do ginásio da
  cidade, defesa do ginásio e Torre. **NÃO está nas três das ligas** (Clássica, customizadas e
  Trainers League) — item equipado não vale lá (ver "Onde os itens valem"), e um + que promete um
  efeito que a partida não aplica é o mesmo defeito do selo de terreno prometendo bônus que a
  batalha não dá.
- **Ele mora na COLUNA DO NÚMERO, embaixo do "1º", e isso foi medido — não é gosto.** Como bloco
  próprio na faixa do meio (que é onde o pedido o colocava, ao lado das setas) ele custa a largura
  dele MAIS o gap: 50px. A 320px o nome do pokémon precisa de **180px** numa coluna que tem **182** —
  ou seja, os seis nomes passavam a quebrar em duas linhas, cada um com um "— Lv.62" pendurado
  embaixo. **Não há largura de botão que resolva**: testado de 34px a 20px, todos quebravam; a folga
  era de 2px. Na coluna do número ele custa **zero** horizontal (ela já tem 28px e a linha já é mais
  alta que o número). A 390px o + ao lado das setas caberia; a 320px, não.
- **Quadrado, não redondo**: as redondas são as setas de mover, e duas formas iguais lado a lado na
  mesma linha se confundem.
- **Carregando alguma coisa, o botão vira o ÍCONE do item** (⏰ 🧪 💊) e acende em amarelo, em vez do
  +. A tela responde "o que este aqui está levando?" sem cobrar um toque.
- **A caixa de escolha lista o que a mochila TEM *mais* o que ele já carrega.** O equipado já saiu do
  armazém, então filtrando só por estoque ele sumia da lista — a caixa dizia "está carregando
  Despertar" e o Despertar não aparecia em lugar nenhum pra ver marcado. Quem tem 1 e equipou fica
  com 0, que é o caso mais comum de todos. A linha dele fica **amarela e travada** (reequipar não
  mudaria nada e o servidor recusaria com estoque 0), mas **não cinza**: cinza diz "indisponível" e
  o que se quer dizer é "é este" — daí o `.btn.selected:disabled` próprio.
- **A mochila deixou de ter "Usar" pros três**, e no lugar diz onde eles se usam. O botão existia pra
  ligar um efeito na conta e não há mais efeito de conta pra ligar; sumir em silêncio deixaria a
  pessoa procurando.

### Despertar (equipado, anula um sono)
- **O golpe de sono do adversário não pega em QUEM CARREGA o item.** Não é mais o time inteiro: o
  vizinho de time continua dormindo normal, e é isso que faz da compra uma escolha. Os pokémon do
  jogador **continuam podendo** fazer o adversário dormir — o item protege quem o carrega, não
  desliga o golpe.
- **A chance do adversário é CONSUMIDA**: ele tentou e falhou. E isso vira **linha no log**
  ("Jynx tentou fazer Machop dormir com Hipnose, mas o Despertar segurou") — sem ela o jogador não
  teria como saber que as 50 moedas trabalharam, que é o erro da especialidade de novo.
- **O item é UM: depois de segurar um sono, ele acabou.** Um segundo adversário que tente de novo
  pega. O teste cobra isso na forma certa — "nunca dorme ENQUANTO o item não foi gasto" —, e a
  primeira versão dele, que cobrava proteção eterna, falhou 1 vez em 6.000 confrontos exatamente por
  esse motivo.
- Medido no modelo de hoje: **+0,1 ponto** de vitória por batalha 6x6 (50,48% → 50,59%, 0,2σ — ruído),
  e ele trabalha em **1,5%** das batalhas. Parece pouco e é: o sono é 5% por confronto e agora
  protege um pokémon só. O que ele compra não é taxa de vitória, é **não perder aquele pokémon pra
  um sorteio** — que foi exatamente a reclamação que fez o sono ser reescrito.

### Poção (55%) e Super Poção (80%)
- **MESMA MECÂNICA DO RECUPERAR: a cura acontece ANTES da luta.** O pokémon que carrega a poção entra
  machucado do confronto anterior; se está com **25% ou menos**, ele se cura e só então o novo
  adversário ataca. Uma por poção, e ela some depois de trabalhar.
- **Chegou a disparar na VITÓRIA do confronto, e estava errado** — reportado em 03/09/2026 com um
  "ele nem tinha tomado hit ainda". A cena não fazia sentido: o pokémon matava o adversário sem
  levar um golpe e tomava a poção logo em seguida. A vida que ele carregava era do confronto
  ANTERIOR, e a tela não contava isso. O Recuperar já tinha resolvido esse mesmo problema em
  02/09 (ele também vivia no fim do confronto), e a poção passou a seguir o mesmo caminho.
- **Ela vem ANTES do `doExchange`, e isso resolve sozinho a ordem com o Recuperar:** se a poção
  subiu o HP pra cima de 70%, o Recuperar não dispara mais; se ela não disparou, ele sai normal.
  Medido: **0 confrontos com os dois** em 4.000 batalhas de um Alakazam com poção armada.
- **Nunca no primeiro confronto de uma batalha**: fora da Elite 4 o time entra cheio
  (`team.forEach(p => p.hp = p.maxHp)`), então não há o que curar. É também o motivo de a poção não
  poder disparar "no fim da batalha": ali a cura não mudaria nada, porque a luta seguinte já começa
  com todo mundo cheio.
- **QUEM LIMPA depende de onde a luta rodou.** Na Torre, no Ginásio da Cidade e na raide é a própria
  função da batalha, sem depender de ninguém. Na jornada quem viu a luta foi o CLIENTE, então é ele
  que avisa (`consumeEquipped`) — e o pior caso de a chamada se perder é o jogador FICAR com o item
  equipado, que é o lado certo pra errar.
- **Quem sabe o que foi gasto é o MOTOR** (`itensGastos` / `itensGastosDaBatalha()`): ele anota espécie
  e item no instante em que o efeito acontece, e quem chamou a batalha limpa. O motor não fala com o
  banco. É função e não a variável direto porque ela é **reatribuída** a cada batalha — quem tivesse
  guardado a lista antiga ficaria olhando pra uma batalha que já acabou.
- **O PREÇO MEDIDO, e continua sendo o maior desta leva** (12.000 batalhas 6x6 nível 60, mesmos times
  e mesma semente dos dois lados, 1σ = 0,65 ponto): **50,48%** sem item, **52,59% com a Poção**
  (+2,11) e **53,63% com a Super Poção** (+3,15). Onde o item é equipado quase não muda (líder do
  time ou pokémon sorteado dão o mesmo, dentro do ruído): o que decide é ele estar no pokémon que
  vai precisar, e isso o jogador não sabe de antemão.

### O preço da mudança: de item da conta pra item do pokémon
- **O item ficou ~3× mais fraco, e o número é esse** (mesmas 12.000 batalhas, Super Poção). O modelo
  velho foi reproduzido honesto: roda a batalha SEM item, vê quem seria o primeiro a entrar com 25%
  ou menos, e equipa **justamente ele** — até a primeira cura as duas trajetórias são idênticas,
  então isso É o modelo velho.

  | | vitória | ganho | disparou em |
  |---|---|---|---|
  | sem item | 50,48% | — | — |
  | **modelo VELHO** (da conta) | 61,63% | **+11,14** (17,3σ) | **80,7%** das batalhas |
  | modelo NOVO, no líder | 53,63% | +3,15 (4,9σ) | 24,8% |
  | modelo NOVO, num sorteado | 53,76% | +3,27 (5,1σ) | 22,1% |

  A causa não é a cura ter mudado — ela é a mesma. É a **frequência**: armada na conta, a poção
  disparava em 4 de 5 batalhas, porque bastava QUALQUER um dos seis chegar machucado. Presa num
  pokémon, ela só sai quando **aquele** chega machucado: 1 em 4.
- **Os preços NÃO foram mexidos** (Poção 15, Super Poção 30). A eficiência por moeda caiu junto:
  a Poção sai de 0,48 pra **0,14 ponto por moeda** e a Super de 0,38 pra **0,11**. Continuam sendo os
  itens mais fortes do jogo por moeda, mas com folga bem menor. Se a intenção era manter o poder de
  compra, o lugar de mexer é o preço — e a conta pra devolver o que era antes seria dividir por ~3.
  Ficou como está por não ter sido pedido.

### Os cinco de atributo (HP / Atk / Def / Atk Special / Def Special Up), 30 cada
- **+15 no atributo comprado, a BATALHA inteira, e somem no fim dela.** Diferente dos três de cima
  numa coisa só: não são um efeito que dispara uma vez — valem em TODO confronto daquele pokémon,
  do primeiro ao último. Mas **se gastam pela mesma regra**: o item sai quando TRABALHA, e trabalhar
  aqui é o pokémon **ter entrado em batalha**. Quem ficou no banco e não lutou continua com o dele.
- **O bônus vale até o fim da batalha, mesmo já tendo sido "gasto".** O motor só anota o RECADO
  (`itensGastos`) no instante em que o pokémon entra no primeiro confronto; quem tira da conta é
  quem chamou a batalha, depois. Zerar o `p.item` na hora faria o bônus sumir no meio da luta.
- **Uma anotação só por batalha** (`_itemGastoAnotado`, zerado pelo `equiparItens`): um pokémon que
  enfrenta três adversários seguidos não pode gerar três gastos, senão o servidor tentaria apagar um
  item que já não existe e a conta passaria a mentir.
- **Esta seção já disse o contrário** ("NÃO se gastam"), por um dia. Era leitura errada do pedido, e
  o número que ela levava junto — "+1,5 pra sempre contra +3,15 uma vez" — não vale mais.
- **A regra de UM ITEM POR POKÉMON continua valendo**, e é ela que faz disso uma escolha: não dá pra
  empilhar Atk Up com Def Up, nem com uma poção.
- **O bônus é FLAT e entra POR ÚLTIMO** (`withItemStat`), depois de shiny, terreno e especialidade —
  que são multiplicadores. Entrando antes, eles o inflariam: +15 num shiny em terreno viraria +21, e
  "+15 de atributo" deixaria de ser 15.
- **O TIPO DO GOLPE decide QUAL atributo conta, e por isso metade das compras não fazia nada.**
  No motor da Gen 1 o que separa físico de especial não é o golpe, é o TIPO: Fogo, Água, Planta,
  Elétrico, Psíquico, Gelo e Dragão usam o **Ataque Especial**; todo o resto usa o **Ataque**.
  Um Atk Up num Alakazam é dinheiro fora, e um Atk Special Up num Machamp também.
  Reportado em 04/09/2026: *"to colocando aqui em alguns pokemons e nao vejo nada de diferente"*.
  Medido nas 250: **108 atacam SEMPRE físico**, **45 SEMPRE especial** e 97 variam conforme o
  adversário. Medido no dano: um Machamp com Atk Up bate **+18,8%**; um Alakazam com o mesmo item,
  **+0,1%**.
- **A tela passou a avisar, e a mecânica NÃO mudou** (decisão de 04/09/2026). A caixa do + diz, em
  cada item de ataque, **o NOME dos golpes que ele fortalece**: *"Fortalece o ataque Raio Solar."*
  no Atk Special Up de um Venusaur, *"Fortalece o ataque Bomba de Lodo."* no Atk Up do mesmo bicho.
  `golpesDoItem(item, especie)` cruza os tipos da espécie **mais os subtipos** (a mesma lista que o
  `bestAttackType` escolhe) com o `isSpecialType`, e vira palavra pelo `nomeDoGolpe` — o mesmo
  caminho do log, sem tabela nova. Quando não sobra golpe nenhum daquele lado, a linha vira
  ⚠️ *"Não fortalece nenhum ataque deste pokémon"* e fica desbotada.
  **A primeira versão dizia a CATEGORIA, e durou um dia.** Ela escrevia "ele ataca com golpes
  ESPECIAIS" na caixa e pôs uma linha na ficha da Pokédex dizendo se a espécie ataca físico,
  especial ou dos dois jeitos. Recusado no mesmo dia: *"ficou difícil de compreender"*. É
  vocabulário de motor — o jogador não pensa em categoria de dano, ele pensa no golpe que lê no log.
  **A linha da ficha da Pokédex saiu junto** e não volta: quem responde essa pergunta é a caixa do
  +, na hora de equipar, que é onde a pergunta é feita.
  **O item continua CLICÁVEL**: é o pokémon do jogador e a escolha é dele — o que a tela deve é
  avisar, não decidir.
  **O Ditto não nomeia golpe**: ele copia o tipo de quem está na frente, então a linha dele diz
  isso e mais nada — prometer um golpe seria mentir em metade das lutas.
  **Os dois de DEFESA não nomeiam nada**, e não é esquecimento: quem decide se conta a Defesa ou a
  Defesa Especial é o tipo do golpe de QUEM ATACA, não do dono do item. Não há o que prometer a
  partir da espécie — o que dá pra dizer é que 59% dos golpes do jogo são físicos.
  `tools/test-inventario.js` confere que **as 250 espécies têm nome pra todo golpe que conseguem
  usar** (senão a caixa diria "Fortalece o ataque " e pararia ali) e que nenhuma fica sem golpe dos
  dois lados.
- **O TETO DE DANO ENGOLE O BÔNUS em 12,3% dos golpes.** `DMG_CAP_PCT = 0.65` limita cada golpe a
  65% do HP máximo do alvo (70% no crítico), e quem já bate no teto não ganha nada com mais ataque.
  Medido em 8.000 batalhas o A/B de subir pra 75%: os golpes no teto caem de 11,5% pra 6,6%, a taxa
  de vitória não se move (50,64% → 50,80%), **3,6% das batalhas trocam de vencedor** e a jornada
  concluída vai de 66,3% pra 69,0% (1,8σ — no limite do ruído, mas para o lado fácil).
  **Ficou em 65%**: o teto é o que garante que one-shot não existe e que todo pokémon sempre
  responde pelo menos uma vez, e mexer nele muda o jogo inteiro por causa de um efeito colateral
  nos itens.
- **Consequência conhecida e aceita: ele vale proporcionalmente MAIS pra quem tem o atributo baixo.**
  +15 num ataque de 45 (Onix) é +33%; num de 110 (Snorlax) é +14%; num Magikarp de 10, +150%.
- **O HP Up entra no `effectiveBaseHp`**, então mexe no TETO de vida (`calcMaxHp`) **e** no
  `gen1MaxHp`, que é o divisor do dano: mais vida também significa tomar uma fração menor da barra
  por golpe, que é o que mais vida tem que significar.
- **NÃO existe Speed Up**, e não é esquecimento: a velocidade entra na taxa de crítico
  (velocidade/512, regra da Gen 1), e um item de 30 moedas mexendo na frequência de crítico é outro
  tipo de item. Não foi pedido.
- **O time da jornada é sincronizado assim que os equipados mudam** (`equiparItens` no carregamento
  da conta, ao equipar, ao tirar e ao gastar). Sem isso o `p.item` da instância só era escrito no
  começo da batalha — e o `calcMaxHp` roda FORA dela (distribuição de níveis, Doce Raro), então a
  barra do HP Up mudaria de tamanho sozinha ao entrar na luta.
- **O PREÇO MEDIDO** (12.000 batalhas 6x6 nível 60, mesmos times e semente, 1σ = 0,65 ponto), com o
  item no líder do time:

  | | vitória | ganho |
  |---|---|---|
  | sem item | 50,48% | — |
  | **HP Up** | 52,08% | **+1,59** (2,5σ) |
  | **Atk Up** | 52,02% | **+1,53** (2,4σ) |
  | **Def Up** | 51,84% | **+1,36** (2,1σ) |
  | **Atk Special Up** | 51,75% | **+1,27** (2,0σ) |
  | **Def Special Up** | 51,55% | **+1,07** (1,7σ) |

  Os cinco ficam na mesma faixa; onde o item é equipado quase não muda (num sorteado o Atk Up dá
  +1,36 e o HP Up +1,63, dentro do ruído).
- **A COMPARAÇÃO QUE IMPORTA, e ela não é confortável: como consumíveis de 30, eles são a pior
  compra da loja por moeda, tirando o Despertar.**

  | item | preço | ganho por batalha | ponto por moeda |
  |---|---|---|---|
  | Poção | 15 | +2,11 | **0,141** |
  | Super Poção | 30 | +3,15 | **0,105** |
  | HP Up | 30 | +1,59 | 0,053 |
  | Atk Up | 30 | +1,53 | 0,051 |
  | Def Up | 30 | +1,36 | 0,045 |
  | Atk Special Up | 30 | +1,27 | 0,042 |
  | Def Special Up | 30 | +1,07 | 0,036 |
  | Despertar | 50 | +0,11 | 0,002 |

  Pelo MESMO preço de 30, a Super Poção dá o DOBRO; a Poção custa metade e ainda dá mais.
  **A diferença de natureza é real e não aparece na tabela**: o item de atributo trabalha em
  **100% das batalhas** (o líder sempre entra) e a poção em **~25%** — um é certeza pequena, o
  outro é loteria grande. Mas o valor esperado ainda favorece a poção por 2×.
  Se a intenção era que os cinco fossem competitivos, o lugar de mexer é o **preço** — 15 os poria
  na faixa da Poção. Ficou em 30 porque foi o preço pedido.
- `tools/test-especiais.js` tranca os cinco (cada um dá +15 SÓ no atributo dele, o bônus é flat
  mesmo num shiny em terreno, o HP Up sobe o teto de vida, e nenhum deles gera gasto na batalha), e
  a comparação dos DOIS MOTORES passou a equipar um item de atributo diferente a cada volta — sem
  isso ela não tocava no `withItemStat`, e uma divergência ali só apareceria em produção.
  Conferido que ela falha com os dois motores discordando em 1 ponto de bônus (115 de 300).

### Faixa de Foco (50 moedas)
- **O golpe que mataria deixa 1 de HP, o pokémon revida e a LUTA CONTINUA.** É o único item que age
  NO MEIO da luta — os outros são abertura (poção, Despertar) ou um número somado antes dela (os
  cinco de atributo). Vale uma vez: o próximo golpe fatal da mesma batalha leva o pokémon.
- **Ela entra nos DOIS pontos do `doExchange` em que alguém chega a zero** — quem apanha primeiro e
  quem apanha o revide — **e também na AUTODESTRUIÇÃO**.
- **A explosão foi o furo da primeira versão** (reportado em 04/09/2026: *"equipei o charizard com
  Faixa de foco e ele morreu direto quando chegou com 0 de hp"*). Ela zera o HP dentro do
  `tentarGolpeEspecial`, sem passar por nenhum dos dois pontos do `doExchange` — e é justamente o
  golpe mais fatal do jogo, o último lugar onde um item que promete segurar a morte pode ter
  exceção. Medido antes do conserto: **22 furos em 3.000 batalhas**, todos `boom,boomself`.
- **SÓ O ALVO É SALVO, nunca quem explodiu**: o dano que o explosor toma é dele mesmo, e salvá-lo
  faria da autodestruição um "mate o outro e sobreviva" — ela deixaria de ter preço.
  E o `explosaoDoAtivo` só é marcado quando o alvo REALMENTE caiu: com a Faixa segurando, quem
  explodiu morreu sozinho, e o `teamStillAlive` não pode dar a batalha pra ele.
- **O TESTE NÃO OLHA CAMINHO, OLHA INVARIANTE**: quem carrega a Faixa nunca termina um confronto em
  0 sem ela ter disparado antes. Qualquer caminho novo que zere HP — um golpe especial futuro, uma
  regra nova — cai ali. É a forma que teria pego a explosão, e a que vai pegar a próxima.
- **NÃO é o golpe moribundo com outro nome.** No moribundo o pokémon revida **e cai**; aqui ele fica
  de pé. E como a marca de moribundo sai da SITUAÇÃO ("o segundo caiu e revidou"), segurar em 1 já a
  desliga sozinho — que é o certo, porque ele não caiu.
- **A Faixa segura ANTES de o diário ser escrito**, então o dano gravado é o EFETIVO (o que saiu de
  verdade, parando em 1) e a barra da tela desce até 1.
- **ELA PARTE O CONFRONTO EM DUAS LUTAS, e cada uma é reconstruída como qualquer outra — com o
  mesmo teto de 3 golpes.** A luta corre normal até o pokémon chegar a zero, a Faixa o devolve a 1,
  e o que vem depois se lê como uma luta nova em que ELE ataca primeiro. No log continua sendo um
  confronto só.
  **Três tentativas até acertar, e as duas primeiras estão registradas porque cada uma errou de um
  jeito diferente:**
  1. **A linha como rodapé, depois de UMA reconstrução do confronto inteiro.** O log dizia que o
     Charizard tomou **388 de 388 de HP** e, embaixo, que a Faixa o segurou com 1 — as duas coisas
     na mesma tela. Reportado com print.
  2. **Os golpes REAIS, sem teto** (a "segunda exceção", como o sono). Contava a história certa, mas
     custava **7 linhas em 61%** dos casos e até **14** na cauda: a luta virava uma parede.
     Reportado de novo, e desfeito.
  A METADE 1 termina com o pokémon em 1: ele é o "perdedor" dela, então o último golpe da
  reconstrução é justamente o que ia matá-lo. A METADE 2 começa com ele em 1 — e como a reconstrução
  dá o primeiro golpe a quem entra **abaixo de 50%**, ele ataca primeiro sem precisar de regra nova.
- **QUEM CAIU NA METADE 1 decide o papel de cada um na reconstrução, e errar isso põe um pokémon
  MORTO ATACANDO** — o defeito mais reportado deste log. Se o adversário TAMBÉM chegou a zero ali
  (`outro === 0`), os dois caíram: é uma **TROCA**, e a reconstrução da troca dá um golpe a cada
  lado, com o do adversário PRIMEIRO — ele bate e só então morre. Se o adversário sobreviveu, só o
  carregador caiu, e aí ele É o perdedor da metade.
  Reportado em 04/09/2026 com print: um Ivysaur matava o Geodude com o HP inteiro num golpe só e o
  Geodude, já em 0, revidava na linha seguinte. A causa era declarar o carregador "perdedor" da
  metade quando quem morreu ali foi o adversário.
- **A divisão parte do HP DEPOIS das aberturas** (o `base`), não do HP de entrada. Se uma drenagem ou
  uma cura abriu o confronto, as duas barras já se moveram antes do primeiro golpe, e dividir a
  partir da entrada fazia a metade 1 gastar vida que a abertura já tinha gasto. Mesmo sintoma
  (alguém batendo com o adversário em 0), em **0,16% dos confrontos com Faixa** — todos com drenagem
  junto. O bloco que desloca o ponto de partida existia só pro caminho do sono e teve que subir.
- **O teste não olha nenhum dos dois casos: ele PERCORRE a sequência mostrada e exige que ninguém
  bata com a barra em zero.** Os dois defeitos acima passaram por testes que olhavam estrutura
  (posição da linha, teto de golpes, soma do dano) — só um invariante sobre o resultado os pega, e é
  ele que vai pegar o terceiro jeito. **O par do moribundo é permitido**, com a mesma regra do teste
  que já existia: quem caiu no passo imediatamente anterior pode bater, porque os dois golpes são do
  mesmo instante.
- **A vida do ADVERSÁRIO no instante da Faixa vem do diário** (campo `ho` da marca): sem ela não há
  como dividir, porque a reconstrução precisa dos dois lados em cada metade. Pro caso comum ela é a
  vida do adversário ANTES do revide — de propósito: o revide é o primeiro golpe da luta nova.
  Confronto gravado antes do campo existir cai na vida de entrada; log velho não pode sumir.
- **A MORTE SÚBITA PODE RESSUSCITAR quem carregava a Faixa** (ela vale quando os dois chegam a zero,
  e isso ainda acontece depois de a Faixa ter sido gasta): o sobrevivente volta com 5%-15%, ou seja
  ACIMA do 1. A metade 2 não tem como mostrar vida subindo, então a soma das linhas passaria do que
  ele perdeu — o log diria 388 de 388 e o cartão mostraria 40. O último golpe contra ele é **aparado**,
  que é o que o próprio desempate já faz no diário. Medido: **1% dos confrontos com Faixa**.
- **A linha vem logo DEPOIS do golpe que ela segurou**, e é por isso que ela não é escrita dentro do
  `faixaDeFoco` (`marcaDaFaixa` monta, quem chama empurra). Escrita lá, ela saía ANTES: o motor
  segura o HP no instante do golpe mas só escreve a linha dele no fim do `doExchange`, e o log
  ficava "a Faixa segurou com 1 de HP" e só então "Electabuzz atacou e tirou −182" — a ordem
  invertida da cena. Vale também na explosão: a linha vai entre o `boom` e o `boomself`.
- **Ela É um passo da animação, com movimento ZERO.** A barra já parou em 1 no golpe anterior, e é
  esse 1 que ela explica; sem o passo, a animação pularia do golpe que ia matar direto pro revide.
- **A FRASE APARECE NO MEIO DA BATALHA TAMBÉM, com 1 segundo de pausa.** Ela é o **único aviso do
  meio da luta**: todos os outros são de ABERTURA (sono, explosão, cura, poção, drenagem) e por isso
  valem desde o começo do confronto. A Faixa não pode — mostrada desde o início ela entregaria o
  desfecho e ainda ocuparia o lugar do "Trocando golpes..." a luta inteira.
  Ela entra no passo dela e **sai no seguinte**. O `avisoDoConfronto` só a considera quando recebe o
  `passo`; chamado sem ele (que é como o `pausaDoEspecial` decide a pausa ANTES do primeiro golpe)
  ela não vale, porque a pausa dela é outra.
- **A pausa dela é no MEIO do laço** (`pausaDaFaixa`), e não na abertura: o passo da Faixa não mexe
  barra nenhuma — a barra já parou em 1 no golpe anterior —, então a duração dele é ZERO e sem a
  pausa a frase apareceria e sumiria no mesmo quadro. É o mesmo segundo do `pausaDoEspecial`, pelo
  mesmo motivo.
- **Dois desenhos, não um.** O passo da Faixa força um `render` pra a frase APARECER (sem barra se
  movendo, nenhum desenho aconteceria), e o passo seguinte força outro pra ela SAIR (`posFaixa`).
  Sem o segundo ela ficaria no lugar do "Trocando golpes..." pelo resto da luta — que foi exatamente
  o defeito que a cura teve quando nasceu.
  Os quatro laços de revelação (jornada, ginásio, Torre/raide e liga assistida) receberam os dois.
- **O preço em linhas, medido:** a luta comum continua em **3 linhas (100%)** — a regra da casa não
  se move. A com Faixa fica em **6 linhas em 66%** dos casos, 5 em 18%, 4 em 15%, e o **maior é 7**
  (era 14 na versão sem teto). Cabe na mesma leitura do sono, que vai até 6.
- **É O ITEM MAIS FORTE DO JOGO, e por larga margem** (12.000 batalhas 6x6 nível 60, 1σ = 0,65):

  | item | preço | ganho | trabalhou em |
  |---|---|---|---|
  | **Faixa de Foco** | 50 | **+4,98** (7,7σ) | **98,2%** das batalhas |
  | Super Poção | 30 | +3,21 (5,0σ) | 25,4% |
  | Atk Up | 30 | +1,53 (2,4σ) | 100% |

  Ela junta as duas coisas que os outros têm separadas: dispara em quase toda batalha (como os de
  atributo) E o efeito é grande (como a poção). Por moeda dá **0,100**, quase empatada com a Super
  Poção (0,107) — o preço de 50 é o que a segura. Se um dia parecer forte demais, é ele que se mexe.

### Onde os itens valem
- **TODA chamada de batalha passa pelo `equiparItens`, sem exceção** -- inclusive as ligas, que passam
  a lista VAZIA.
  Exceção em lista é onde a próxima omissão se esconde, e ela já aconteceu: quando os itens
  entraram, **cinco dos oito caminhos de batalha ficaram de fora**, entre eles o do LÍDER DE
  GINÁSIO, que é A batalha da jornada. O jogador usou a poção, foi lutar e não aconteceu nada --
  reportado em 03/09/2026, horas depois de a loja subir. Os outros quatro eram o desafio do Mewtwo,
  a batalha por código de treinador e as duas resoluções de liga do cliente.
  `tools/test-especiais.js` **lê o código** e falha se alguma chamada de `simulateGymBattle` ou
  `simulateBossFight` não tiver um `equiparItens` nas 12 linhas anteriores — a mesma trava que já
  existia pro `applySpecialtyBuff`, criada depois de a raide do Mew passar semanas sem o buff.
  Ela não cobria os itens; agora cobre, e foi conferido que ela falha ao tirar os itens do ginásio
  da jornada.
- **Valem:** jornada (cliente), Torre, Ginásio da Cidade e raide do Mew (só o Despertar — a raide é
  um ataque só, sem confronto seguinte pra o curado aproveitar).
- **NÃO valem nas ligas**, e é de propósito: elas são resolvidas por cron, às vezes horas depois da
  inscrição, e um item equipado agora não pode decidir uma partida sorteada ontem — pior, ele sumiria
  da mochila sem a pessoa ver a luta. O `resolveLeagueMatch` recebe os equipados **dentro do match**,
  como a especialidade já viaja — no Ginásio da Cidade o lado A é o DESAFIANTE (quem está jogando
  agora) e o líder está dormindo do outro lado do mundo; nas ligas ninguém manda nada. É também por
  isso que o + não aparece nas telas de ordem delas.
- **NÃO valem na batalha online**: aquele caminho resolve confronto a confronto (`battleResolveMatchup`)
  e daria vantagem a um lado só numa partida PvP. Fica em aberto.
- `tools/fake-firestore.js` ganhou **`increment` dentro de mapa aninhado** por causa disto: é assim
  que o inventário é escrito (`set({ inventario: { potion: increment(1) } }, {merge:true})`), o
  Firestore de verdade faz, e sem isso a função passava no teste e quebrava só em produção.
  Com os equipados ele ganhou mais três, pelo mesmo motivo: **`FieldValue.delete()`**, **caminho com
  ponto no `update()`** (`update({'equipados.blastoise': delete()})` apaga UMA chave do mapa, e sem
  isso o fake criava um campo literal chamado "equipados.blastoise" — o teste diria verde com o item
  nunca saindo do pokémon) e **`update` dentro da transação**. O ponto só é resolvido no `update`,
  nunca no `set`: no `set` o Firestore de verdade trata o ponto como parte do NOME do campo, e um
  fake que resolvesse nos dois deixaria passar exatamente esse erro.

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

## Progressão da jornada

- Distribuição de níveis trava em **55**; acima disso só desmaio, Bônus de Kanto e Doce Raro.
- **Desmaiar dá +1 nível.** Isso já foi explorado: jogadores perdiam de propósito porque a
  distribuição tem teto e o desmaio não. Corrigido pelo Bônus de Kanto (abaixo), não removido —
  o desmaio ainda é a rede de quem está atrás.
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
- Chance de shiny selvagem 4× (1/32). Vale também para os iniciais.

## Ginásio da Cidade

- **O time dos DOIS lados é MONTADO, não é mais um save** (01/09/2026). Líder e desafiante escolhem
  até 6 pokémon entre TODOS os saves com 8 insígnias, sem repetir espécie — a mesma regra da Torre,
  e literalmente a mesma tela: `montadorDeTimeHtml` e `alternarEscolhaDeTime` nasceram dentro da
  Torre e viraram função quando o ginásio passou a usá-las. Três cópias divergiriam na regra de
  "não repetir espécie", que é a parte que o jogador vê.
  O cliente manda a **identidade** de cada escolhido (`monId`/`slot`/`idx`/`shiny`), nunca um código
  de time: o servidor resolve pelo `resolverTimeDosSaves` (extraído da Torre pelo mesmo motivo) e
  recusa pokémon que a conta não tem. É o que substitui o antigo `orderedTeamCode` conferido por
  assinatura — a mesma proteção, feita antes em vez de depois. E é o que impede o defeito do shiny
  que some: quem tem o mesmo pokémon no mesmo nível em dois saves escolhia o shiny e entrava com o
  normal.
  **A ordem da escolha é a ordem de batalha**; a tela de ordem continua existindo pra reordenar
  vendo o time do líder.
- **O ID DE UM POKÉMON REPETE ENTRE SAVES — ele nunca pode ser chave de nada na conta.** O `id`
  (`mon7`, `mon12`…) sai do `nextInstanceId`, um contador que **recomeça do 1 a cada carregamento de
  página** e que o `reconcileInstanceIdCounter` só acerta com o save **CARREGADO**. Dois saves têm
  `mon7` cada um, e o mesmo save pode ter dois `mon7` se foram capturados em sessões diferentes.
  Isso derrubou duas coisas de uma vez, e as duas foram reportadas juntas em 01/09/2026 — o jogador
  escolheu 6 pokémon de um save pra desafiar um ginásio e viu **oito** apagados, um Golem e uma
  Meganium de outro save que ele não usou:
  1. **O `resolverTimeDosSaves` procurava pelo id na conta INTEIRA, antes de qualquer outra coisa.**
     O primeiro save vencia sempre, então o jogador **entrava na luta com o xará do outro save** —
     não era só a marcação que estava errada, era o time. Hoje a ordem é **save+posição+espécie**
     primeiro; o id só desempata **dentro do mesmo save** (é lá que ele é confiável, e serve pra
     quando o jogador reordenou o time depois que a tela carregou).
  2. **A espera do ginásio era gravada com a chave `m_<id>`**, então marcava todo xará. Hoje é
     `chaveDoPokemonNaConta` = **save + espécie**: único na conta (um save não tem duas da mesma
     espécie — o encontro selvagem nunca oferece uma linha que o time já tem, e o montador recusa
     repetida) e melhor que save+posição por sobreviver ao jogador reordenar o time. O cliente
     calcula a MESMA chave em `chaveDoPokemon`.
  **Por que os testes não pegaram antes:** os fixtures davam ids distintos entre saves (`a1`, `b1`),
  que é justamente o que a vida real NÃO faz. Hoje `test-torre.js` e `test-ginasio-cidade.js` têm
  fixtures que REPETEM os ids de propósito. Um deles também mentia o slot (mandava `slot:'0'` pra
  pokémon do save 1) e passava porque a busca pelo id atravessava saves e "consertava" a mentira.
- **A espera de 10 minutos é POR POKÉMON** (`neighborhoodGymMonCooldownRef`, 01/09/2026). Quem
  desafia fica 10 minutos sem poder usar **aqueles** pokémon nesse ginásio; o resto do bicharedo
  continua livre pra montar outro time e tentar de novo. Já foi por TIME (uid+slot) e por JOGADOR:
  por time não segurava nada — quem tinha 3 saves desafiava 3 vezes seguidas, uma com cada — e por
  jogador segurava demais, travava a conta inteira por causa de um time que perdeu.
  **A chave sai do pokémon que o SERVIDOR achou**, nunca do que o cliente mandou: senão daria pra
  fugir da espera inventando uma identidade. É **save + espécie** (ver a nota acima sobre o id que
  repete entre saves), e o cliente calcula a MESMA chave. Se as duas divergirem, a tela libera quem
  o desafio recusa -- ou apaga quem podia lutar.
  **A recusa NOMEIA quem está descansando**: um "espere 7 minutos" sem dizer por causa de quem faria
  a pessoa remontar o time no escuro. E a tela de montar mostra os descansando **apagados, com o
  tempo no lugar do nível** — sumir com eles faria parecer que o jogador perdeu o pokémon.
  **O timer não aparecia**, e o defeito não estava na tela: o carregador guardava só
  `result.data.cooldowns` — o campo da espera por TIME, que ficou vazio quando ela virou por
  pokémon — e jogava fora o `mons`, que é onde está quem está descansando. Nenhum pokémon aparecia
  apagado e não havia como saber quem podia usar. Reportado no mesmo dia em que a espera mudou.
  **A conferência da tela não pegou porque ela escrevia o campo já no formato final, à mão**:
  testava o desenho, não o caminho do dado até ele. Hoje `tools/test-online-dex.js` roda o
  CARREGADOR de verdade, com só a chamada de rede trocada, e confere o que chega na tela — apagados,
  minutos em cima de cada um, desabilitados, e os outros continuando livres.
  Marca vencendo ou perdendo. Na prática só pesa na derrota (vencendo ele vira líder e não desafia
  mais), mas marcar sempre evita retomar o ginásio no mesmo minuto com o mesmo time.
- **"Ginásios liderados"**: a lista dos ginásios que você lidera, de qualquer lugar
  (`listMyNeighborhoodGyms`, consulta por `leaderUid` — índice de campo único, que o Firestore cria
  sozinho). Liderar vale à distância; só CONQUISTAR um ginásio novo exige estar na cidade dele.
  Sem isso, quem virou líder em São Paulo e voltou pra São José não tinha como abrir aquele ginásio
  de novo — a tela só sabia mostrar o ginásio de onde a pessoa está.
  O `openNeighborhoodGymRemote` **já existia, escrito exatamente pra isso, e nenhum caminho o
  chamava**: a tela remota funcionava desde sempre, faltava a porta.
  O botão aparece em TODOS os estados da tela do ginásio, inclusive quando a localização falha — é
  justamente aí que ele mais serve. E a lista avisa quando falta escolher o terreno: sem terreno o
  ginásio não aceita desafio, e o líder não tinha como saber disso sem abrir.
- **Três regras estavam presas ao slot e tiveram que mudar junto.** Nenhuma foi escolha de gosto —
  sem "o time do slot N" elas deixam de ter o que contar:
  1. **A espera de 10 min deixou de ser por time** -- passou por "por jogador" e hoje é **por
     pokémon** (ver a nota acima, que é a versão que vale).
  2. **Quem vence defende com o time que venceu.** Antes um sorteio escolhia um save LIVRE do
     vencedor (`pickAutoDefenseTeamForWinner`, removido) — fazia sentido quando a defesa era um save
     inteiro. Agora ele montou um time, ganhou com ele, e é com ele que fica.
  3. **A exclusividade "um time só defende um ginásio" acabou.** Ela travava `uid+slot`, e não
     existe mais o que travar. **Consequência: um treinador pode liderar vários ginásios**, com os
     mesmos pokémon. Se um dia incomodar, o lugar de resolver é o `setNeighborhoodGymDefense` e a
     regra que cabe é "um ginásio por líder" — não dá pra voltar à antiga.
  O índice antigo (`neighborhoodGymActiveDefenses`) continua sendo **limpo** quando um líder monta
  time à mão, pra não deixar lixo apontando pra ginásio nenhum. Defesa montada grava
  `leaderTeamSlot: null`; documento antigo mantém o que tinha.
- **A defesa é um código CONGELADO**, e agora isso importa mais: como ela não vem de um save, mexer
  no save (ou apagá-lo) não muda quem defende o ginásio. O aviso de "esse ginásio vai ficar sem
  líder" ao apagar um save (`checkNeighborhoodGymDefenseForSlot`) só vale pras defesas antigas,
  presas a slot — pras novas ele não tem o que avisar, porque nada acontece.
  `tools/test-ginasio-cidade.js` cobre os dois lados: time misturando saves, as duas recusas
  (espécie repetida e pokémon que não é seu), o shiny que sumia, a espera por jogador e o time do
  vencedor.
- O **selo de terreno** nas fileiras de time (`timeComTerrenoHtml`) usa a MESMA regra do
  `applyTerrainBuff` — se as duas divergirem, a tela promete um bônus que a batalha não dá.
  Aparece na tela do ginásio, na escolha de time do desafio e nas duas telas de ordem.
- **Reordenar a defesa é uma função à parte** (`reorderNeighborhoodGymDefense`), e não um modo do
  `setNeighborhoodGymDefense`: aquele resolve reivindicação de ginásio vago, exclusividade do time
  entre ginásios e troca de terreno, e nada disso vale numa permutação.
- Ela permuta o **código guardado**, não o time do save: o save pode ter mudado de ordem ou de
  nível desde que a defesa foi montada, e o líder está reordenando o que ele vê defendendo.

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

## A Trainers League parou de ler slot vazio

- `trainersLeagueGatherEligibleCodesForUid` montava **uma referência por slot e lia todas**,
  existindo ou não: um jogador com 1 save custava o teto inteiro em leituras, e isso roda **uma vez
  por inscrito** a cada travamento de liga (mais uma vez por Doce Raro usado). Com o teto em 20 isso
  dobraria sozinho. Hoje lê a coleção: **1 save = 1 leitura**.
- **O RISCO DA TROCA É A ORDEM, e é o motivo de existir teste pra isso.** O Firestore devolve os
  documentos por ID em ordem de **TEXTO**, então com 20 slots o `"10"` cai **entre** o `"1"` e o
  `"2"`. O time de cada rodada é sorteado por ÍNDICE nessa lista, com semente, e o CLIENTE refaz o
  mesmo sorteio pra mostrar quem vai lutar (`resolveTrainersLeagueTeamCodeForRound`) — ordens
  diferentes fazem **a tela mostrar um time e a batalha usar outro**. Por isso a lista é reordenada
  na mão pelo slot numérico, que é a ordem que o cliente usa.
  O defeito só apareceria pra quem tem mais de 10 saves — ou seja, exatamente depois de subir o teto,
  e não no dia em que a troca foi feita. `tools/test-liga-treinadores.js` grava os saves fora de
  ordem de propósito e confere a ordem pela espécie de cada time; conferido que ele FALHA sem o
  `sort`.

## Moedas

- **A jornada paga: 5 por insígnia, +10 pelas oito, +20 pela Elite — 70 por jornada completa**
  (02/09/2026). Quem calcula e paga é o servidor (`claimJourneyCoins`), lendo o SAVE gravado.
- **O pagamento é por DIFERENÇA, não por evento.** A função conta do zero quanto aquele save já
  rendeu e paga o que falta, guardando o total no campo `coinsPaid` do próprio save. É o que faz as
  duas coisas ao mesmo tempo: chamar duas vezes não paga em dobro (F5 na tela de vitória, duas abas),
  e uma chamada que morreu na rede não custa vitória nenhuma — a próxima cobre as duas.
- **O SAVE VAI PRIMEIRO.** A função lê o save do servidor, então o cliente dá `await
  saveCurrentGame()` antes de chamar — com `maybeAutoSave` (debounced em 800ms) a insígnia nova
  podia nem estar lá, e a vitória só seria paga na chamada seguinte.
- **Save antigo NÃO leva retroativo, e essa é a decisão irreversível daqui.** Na primeira vez que um
  save passa pela função sem `coinsPaid`, o campo nasce valendo o que ele já teria rendido e **nada
  é pago**. Um campeão de antes do sistema receberia 70 moedas de uma vez — 23 re-sorteios de
  encontro caídos do céu. Se um dia se decidir pagar retroativo, é trocar esse ramo por um
  `jaPago = 0`; o contrário — tirar moeda que já foi paga — não tem volta.
- **`moedas` está na trava do `firestore.rules`, junto do `rareCandies`.** Não é opcional: moeda é
  poder de compra, e o que ela compra hoje é re-sorteio do encontro selvagem. Cliente escrevendo
  moeda é **shiny à vontade** — exatamente a artimanha que a semente do encontro existe pra fechar.
- **O prêmio APARECE** (`moedasGanhasHtml`), na tela de vitória e na de campeão. Prêmio que o jogador
  não vê é o erro da especialidade de novo: valia 1%, não tinha selo, e a conclusão foi "não mudou
  nada". A linha só sai quando algo foi pago — a chamada é assíncrona, e anunciar "+0 moedas"
  enquanto a rede responde seria pior que esperar meio segundo pela linha certa.

## Re-sorteio pago do encontro selvagem

- **3 moedas trocam a oferta INTEIRA — espécies e níveis** da rota atual (`MOEDAS_RESSORTEIO`, no
  cliente e no servidor; se os dois divergirem, a tela promete um preço que a cobrança não pratica).
- **O contador de re-sorteios entra na MESMA semente do encontro** (`sementeDoEncontro`, um lugar só
  pro primeiro sorteio e pro re-sorteio). É isso que mantém a trava anti save-scumming de pé: sem
  pagar, a oferta é sempre a mesma (sair do save e voltar não muda nada); pagando, ela muda; e voltar
  ao contador anterior devolve a oferta anterior, então não há vaivém de graça entre duas ofertas.
  **`wildRerolls` é gravado no save** — sem isso, recarregar zeraria a contagem e desfaria um
  re-sorteio já pago.
- **Cobra primeiro, sorteia depois.** Sortear antes de cobrar daria a oferta de graça pra quem
  fechasse a aba no meio. Se a cobrança falhar (moeda de menos, rede), nada muda na tela e o motivo
  aparece nela.
- **O botão fica ENTRE o contador de selecionados e a caixa dos selvagens**, não no rodapé: é ali
  que a decisão é tomada. Embaixo dos cards e do "Confirmar equipe" ele chegava tarde -- quem
  rolou até o fim da lista já escolheu.
  Ele carrega os dois textos: **"🪙 3 - Sortear novamente"** à esquerda e **"Possui: 🪙 N"** à
  direita, dentro do mesmo botão. Por isso a fonte dele é menor que a dos outros botões, e isso foi
  medido: a 320px sobram ~170px pra ação depois do saldo, e a frase no corpo normal (14,4px) mede
  200 -- quebrava em duas linhas. Quem tem que caber com folga é o SALDO, que cresce com 4 dígitos;
  a ação é texto fixo.
  A frase que explicava tudo isso em texto ("Você tem X. O re-sorteio troca as espécies E os
  níveis") saiu a pedido em 02/09/2026: o botão já diz o preço e o saldo.
- **COM O BÔNUS SHINY LIGADO O PREÇO SOBE A CADA RE-SORTEIO NA MESMA ROTA: 3, 6, 9...**
  (`precoDoRessorteio`, no cliente e no servidor). Sem o bônus fica nos 3 de sempre.
  O motivo é a matemática do bônus: a chance dele **escala +10 pontos por encontro sem shiny**
  (78% de já ter um no 5º encontro), então re-sortear sob o bônus é quase comprar um shiny — a preço
  fixo de 3, as 70 moedas de uma jornada virariam shiny garantido.
  **Volta pros 3 na rota seguinte**, porque o `wildRerolls` zera a cada encontro novo: o que se
  quer encarecer é insistir NA MESMA rota, não jogar.
- **O contador vem do SAVE, e isso é seguro por construção.** O servidor lê `wildRerolls` do save
  gravado — que o cliente escreve. Mentir que é zero não compensa: ele entra na **semente da
  oferta**, então o re-sorteio barato devolve a MESMA oferta de antes. Quem falsifica o contador
  não recebe pokémon novo nenhum.
  Por isso o cliente faz `await saveCurrentGame()` **antes** de chamar a cobrança: sem ela, dois
  re-sorteios seguidos leriam o mesmo contador velho e o segundo sairia pelo preço do primeiro.
- **A recusa diz quanto falta E o preço CERTO** ("Você tem 5 moedas — o re-sorteio custa 9"), senão
  o botão promete um preço e a cobrança pratica outro. Ele também já nasce desabilitado abaixo do
  preço da vez.
- **O PREÇO MEDIDO, e é a maior mexida de dificuldade desta série.** Com as 70 moedas de uma jornada
  completa gastas na jornada seguinte são ~23 re-sorteios, ou 2 a 3 por encontro. Medido em 4.000
  jornadas de cada caso, a chance de ver um shiny numa jornada:

  | re-sorteios por encontro | ofertas na jornada | jornadas com shiny |
  |---|---|---|
  | 0 (hoje) | 8 | **22,6%** |
  | 1 | 16 | 39,0% |
  | 2 | 24 | 52,2% |
  | 3 | 32 | **62,5%** |

  Ou seja: gastar tudo em re-sorteio quase **triplica** a chance de shiny por jornada. Não foi
  compensado em nada — se incomodar, os lugares de mexer são o **preço** (`MOEDAS_RESSORTEIO`) e o
  **pagamento** (`MOEDAS_POR_GINASIO` e companhia), e o mais direto é o preço.
- O servidor **não sorteia a oferta** — ele só cobra. Quem sorteia é o cliente, com a semente dele:
  o servidor não conhece rota nem pool, e mandar a oferta de lá duplicaria as tabelas de encontro,
  que é justamente o que o projeto evita.
- `tools/fake-firestore.js` ganhou **`getAll` dentro da transação** por causa disto: o `Transaction`
  do Firestore tem, e sem ele qualquer função que leia dois documentos de uma vez morre com
  "tx.getAll is not a function" — erro do harness, não do código testado. Passa pela mesma trava de
  leitura-depois-de-escrita.

## Mochila (inventário) e Loja

- **O ESTOQUE NÃO É UMA LISTA GRAVADA.** É uma leitura do que a conta já tem:
  **Doce Raro** = o contador `rareCandies` do documento da conta (o servidor escreve na Torre, o
  `useRareCandy` desconta); **Bônus Shiny** = os CUPONS ainda não ativados, que são o save que
  venceu a Elite (`eliteShinyGranted` sem `eliteShinyUsed`) e a notificação de campeão de liga.
  Inventar um armazém no cliente seria pior de duas formas: as **regras do Firestore não deixam o
  cliente escrever campo de prêmio** — e não podem deixar, uma linha no console viraria doce
  infinito, que é nível infinito —, e os prêmios passariam a existir em dois lugares, com duas
  contas que divergem no primeiro erro. **Um inventário de verdade (com itens compráveis) exige
  escrita no servidor, e é aí que a Loja vai precisar de uma Cloud Function.**
- **`game.rareCandies` é a única fonte do doce.** Ele era lido de `game.tower.rareCandies` — o que
  dava no mesmo enquanto o doce só existia na tela da Torre. Aberta pela Mochila, `game.tower` é
  **null**, e a tela de gastar o doce não abriria nunca. Hoje o campo vem do documento da conta no
  carregamento e as respostas da Torre e do `useRareCandy` o atualizam.
- **O prêmio mudou de lugar, e a notificação parou de ser o cofre.** A notificação de campeão e a
  tela de campeão da jornada continuam sendo **onde a pessoa descobre que ganhou**; o que elas
  deixaram de fazer é guardar e ativar. Um prêmio guardado em três telas diferentes era o motivo de
  ninguém achar o que tinha. As funções `activateShinyBonus` e `activateEliteShiny` do cliente foram
  removidas — quem ativa é o `usarItem`, e ele fala direto com as mesmas Cloud Functions.
  **Cuidado que continua valendo:** apagar a notificação de campeão apaga o cupom, porque é ela que
  o servidor lê. É o mesmo comportamento de antes, e é por isso que a confirmação de apagar
  notificação nomeia as que têm prêmio dentro.
- **A pilha:** cinco doces são **UM** slot com "5x", não cinco slots.
- **A grade tem piso de 12 slots e mora dentro de uma `.box`**, como a da Pokédex — e o slot tem a
  MESMA medida da célula de lá (52px, quadrado). Solta sobre o fundo escuro da página, o slot vazio
  (creme com `opacity:.6`) virava um bloco **cinza**: parecia item bloqueado, não espaço livre.
  Slot vazio é `<div>` e não `<button>` desabilitado: não há o que fazer nele, e um botão vazio
  ainda recebe foco pelo teclado.
- **"Excluir" só vale pro que dá pra jogar fora de verdade.** O cupom de liga é uma notificação, e
  apagá-la é apagar o cupom. O **Doce Raro não pode ser descartado** — é um contador que só o
  servidor mexe, e não existe função pra devolver um; o botão fica desabilitado **dizendo por quê**.
  Um botão que falha é pior que um botão apagado com o motivo do lado.
- **A Mochila volta pra tela de ONDE VEIO** (`inventarioVoltarPara`). Ela é aberta de três lugares, e
  dois estão DENTRO de um save carregado (a notificação e a tela de campeão): um "Voltar" fixo pra
  home tirava o jogador da jornada toda vez que ele fosse buscar o prêmio — que é exatamente o que
  aqueles botões mandam fazer. Vindo da home ela sai pelo `openSaveSelect`, que recarrega os dados
  da conta e é o que faz o contador de moedas e o de doces chegarem atualizados.
- **A LOJA ainda não vende nada, e mostra isso em vez de ficar vazia.** Mesma grade e mesmo quadro de
  cima da Mochila (são a mesma leitura: um monte de quadradinhos, clico num e leio o que é). Os itens
  aparecem com preço e o **botão Comprar desabilitado** — um botão apagado não promete nada; um botão
  vivo que não compra, sim. As duas frases que explicavam isso em texto saíram a pedido em
  02/09/2026: o botão desabilitado já diz o que elas diziam, e duas linhas azuis em cima da grade
  viravam parede.
- **`moedas` é escrito SÓ pelo servidor** (ver a seção Moedas): a jornada paga e o re-sorteio do
  encontro selvagem cobra. A Loja ainda não gasta nada.

## Home

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

## Montador de time (Torre e Ginásio da Cidade)

A tela onde se escolhe pokémon de QUALQUER save pra montar um time. Uma função só
(`montadorDeTimeHtml`) desenha as TRÊS telas que fazem isso — a Torre, o desafio do Ginásio da
Cidade e a defesa do Ginásio da Cidade. Três cópias divergiriam na regra de "não repetir espécie",
que é justamente a parte que o jogador percebe.

- **Virou LISTA, uma linha por pokémon** (02/09/2026). Era uma grade de quadradinhos agrupada por
  save: dava pra ver o sprite e o nível, e mais nada. Com três saves cheios são 18 quadros iguais, e
  a pergunta que se faz ali — "quem eu ponho contra um time de Pedra?" — não se responde olhando
  sprite. Cada linha traz **sprite, nome, nível, os selos de tipo, de que time o bicho é** e o
  **ícone da Pokédex** (o mesmo `pokedexIcon()` do resto do jogo), que abre a ficha da espécie — era
  uma lupa 🔍 até 02/09/2026. A lista é **paginada de 10 em 10**.
  Atenção: o botão continua se chamando `.wild-dex`, a classe que nasceu no encontro selvagem, e lá
  ele **ainda é a lupa**. Se um dia as duas telas tiverem que combinar, é o `renderWild` que muda.
- **Paginada de 10 em 10** (`MONT_POR_PAGINA`). São **10 saves** possíveis, então a lista chega a 60
  linhas — e 60 numa tela de 320px é rolagem demais pra uma decisão que se toma olhando poucos de
  cada vez. Os botões de página ficam **depois** da lista (num celular, quem chega ao fim das dez já
  está embaixo, e é ali que a mão está), com a conta do que se está vendo (`11–18 de 18`).
  **Com uma página só eles não aparecem**: quem tem um save tem seis pokémon, e um "1 de 1" é um
  controle que não controla nada.
- **Ordenar ou filtrar volta pra primeira página.** Filtrar por Fogo estando na página 3 deixaria a
  tela vazia — a lista encolheu e a página 3 não existe mais.
- **E a página guardada é clampada na hora de desenhar, GRAVANDO a correção.** Ela fica velha por um
  caminho que não passa por ordenar nem filtrar: desmarcar um escolhido que estava fora do filtro
  encolhe a lista em uma linha, e isso apaga a última página debaixo de quem está nela. Se o clamp
  só corrigisse o que é desenhado, o valor velho **ressurgiria** quando a lista voltasse a crescer —
  o jogador desmarca um, fica na página 1, marca outro e a tela pula pra página 2 sem ele ter
  pedido. O que está guardado tem que ser o que está na tela.
- **Escolher não troca de página.** A ordem da lista não depende de quem está escolhido, então a
  linha tocada fica onde estava; se a tela pulasse pro topo a cada toque, montar seis viraria um
  exercício.
- **A ordem de escolha continua sendo a da ESCOLHA, não a da página** — paginar é só uma janela
  sobre a mesma lista ordenada. Um `1º` na página 1 e um `2º` na página 2 é o normal.
- Cuidado ao mexer em teste que leia esta tela: `tools/test-online-dex.js` confere os três pokémon
  descansando e **eles não cabem numa página só** — ele atravessa as duas. Olhar só a primeira
  acusaria dois de três, e o defeito seria do teste.
- **Ordenação (Nível ⬇, A–Z, Time) e filtro por tipo num `<select>`.** O padrão é **nível
  decrescente**: quem monta time pra lutar procura o mais forte primeiro. "Time" reproduz o
  agrupamento antigo, pra quem pensa em "meu time principal".
  Todas as ordens têm **desempate explícito** — sem ele dois pokémon de mesmo nível trocam de lugar
  entre um render e outro, e a lista pisca debaixo do dedo de quem vai clicar.
- **O combo só oferece tipo que ALGUÉM tem**, com a contagem (`Fogo (3)`). Como o filtro corre sobre
  a mesma lista, tipo escolhido nele nunca devolve vazio — **não existe estado de "nenhum
  resultado", e isso é de propósito**: chegou a ter uma mensagem de lista vazia, que era código
  inalcançável. O que pode sobrar é um filtro VELHO de outra tela, e aí ele é **ignorado** e a lista
  volta inteira; mostrar tudo é melhor que mostrar nada.
- **O filtro NUNCA esconde um escolhido.** Marcar um Charizard e filtrar por Água o tiraria da tela
  — e como desmarcar é clicar nele de novo, o pokémon ficaria preso no time sem como sair.
- **A lupa é IRMÃ do card, nunca filha** — a mesma armadilha do encontro selvagem: `<button>` dentro
  de `<button>` é HTML inválido, o navegador fecha o de fora sozinho e o clique de dentro se perde,
  com a tela continuando a PARECER certa. De quebra ela sobrevive ao card desabilitado (descendente
  de button desabilitado não recebe clique nenhum), e é justamente com o time cheio que dá vontade
  de ver a ficha de quem ficou de fora.
- **A ordem de escolha é a ordem de batalha, e agora ela tem coluna própria** (`1º`, `2º`…), de
  largura fixa mesmo vazia: sem isso a linha inteira pula pro lado no instante do toque. Alinhados
  numa coluna, os números viram o que são de verdade.
- **Ordenação e filtro são estado de TELA** — não entram no `serializeGame`, e `abrirMontador()` zera
  os dois em toda entrada. Sem isso um filtro de Fogo ligado na Torre chegaria no ginásio parecendo
  que metade do bicharedo sumiu.
- **O combo fica em linha PRÓPRIA.** Dividindo espaço com os três botões, a 320px ele ficava tão
  estreito que o próprio rótulo saía cortado ("Todos os tipos (12" sem fechar o parêntese). O texto
  de dentro de um `<select>` é desenhado pelo sistema e não dá pra medir, então a saída é não
  disputar largura.
- **A Batalha Online NÃO usa este montador, e não é esquecimento.** Lá o time é escolhido por
  ÍNDICE, entre códigos que o cliente mandou ao entrar na fila, e o servidor **recusa um código
  novo** na hora da escolha — aceitar seria deixar montar time depois de ver o adversário. Trocar
  aquela tela por um montador exigiria derrubar essa trava.
- O `.tower-pick-check` (o numerinho da grade) saiu junto: virou a coluna `.mont-num` e ficou sem
  nenhum uso. As classes `.tower-pick*` **continuam vivas** — o modal do Doce Raro e a escolha de
  pokémon do online ainda usam a grade.
- `tools/test-montador.js` cobre as três telas, o aninhamento da lupa, a lupa clicável com o card
  desabilitado, as três ordenações, o filtro (inclusive o escolhido que não some e o filtro velho
  ignorado), a espécie repetida entre saves e o teto de 6.

## Torre dos Treinadores

- **30 andares, média do 65 ao 152 (+3 por andar), e a torre deixou de ser algo pra ZERAR**
  (02/09/2026). Os dezoito últimos passam do nível 99 — o teto do JOGADOR — de propósito: o que a
  torre mede é **até onde cada um chega**, não quem termina.
  **O teto tem que ficar sempre longe o bastante pra ninguém encostar nele**: começou em 10 andares
  (58 a 85, calibrado pra ser vencível todo dia), foi a 20 (65 a 122) e no mesmo dia gente já
  chegava no 20 — daí os 30. Mudar esse número é seguro e não precisa de nada além de trocá-lo: a
  torre do dia se refaz sozinha e quem tinha zerado a menor continua do andar seguinte.
  **A lista de nomes de NPC precisa de FOLGA sobre o número de andares.** Com 30 nomes e 30
  andares, todo dia usaria todos e só a ordem mudaria — a torre pareceria a mesma torre
  reembaralhada. São 45 nomes pra 30 andares, e  confere que o elenco muda de
  um dia pro outro.
- **O TOTAL DE ANDARES NÃO APARECE EM LUGAR NENHUM.** A tela diz "Andar 7", nunca "Andar 7 de 20", e
  a abertura fala em "a média começa em 65 e sobe de 3 em 3, sem parar". A torre tem que parecer não
  ter fim: dizer o total transforma uma subida sem teto numa barra de progresso, e o jogador troca
  "até onde eu consigo ir?" por "quanto falta?". Os 20 existem porque alguma hora ela precisa
  acabar, não porque alguém deva chegar lá.
- **Mudar o número de andares REFAZ a torre do dia** (`towerGetToday` compara o que está gravado com
  o `TOWER_FLOORS` de agora). Sem isso a mudança só valeria no dia seguinte — a torre de hoje já
  estava gravada com o formato antigo — e, pior, **quem tinha ZERADO a torre de 10 andares ficava
  travado** no "você já venceu a torre hoje", sem poder jogar mais nada no dia. Reportado em
  02/09/2026, horas depois da mudança.
  A semente é a mesma (`torre-<data>`), então a torre refeita é a MESMA torre ampliada, não um
  sorteio novo.
  **E a subida também se destrava** (`towerGetRun`): subida marcada como zerada numa torre MENOR que
  a de hoje volta a ficar ativa, no andar seguinte ao último que ela venceu. Ela não perde nada — os
  10 vencidos continuam vencidos, ela só passa a ter pra onde ir. Quem zerou a torre DE HOJE
  continua zerado.
- **Perder não volta pro começo.** O jogador fica no MESMO andar e tenta de novo; o time não é
  apagado. Refazer oito andares já vencidos pra chegar de novo onde parou não media nada, e era o
  que a torre cobrava a cada derrota.
  **Armadilha que o teste pegou:** o `startTrainerTowerRun` zerava o andar, porque no modelo antigo
  ele só era chamado no começo da subida. Como ele virou também o "trocar de time", trocar mandava
  o jogador de volta pro andar 1 — anulando a regra inteira. Hoje ele MANTÉM o andar.
- **Só aparecem os andares já alcançados.** São 20; mostrar 13 cartões apagados de "???" no topo
  transformava a tela numa lista do que o jogador não pode fazer. O servidor já escondia o time dos
  não alcançados (`towerVisibleFloors`), então "tem time" É "já cheguei aqui" — o cliente só passou
  a filtrar por isso.
- **Dois rankings, numa chamada só.** O **de HOJE** mostra o andar mais alto que cada treinador
  alcançou na torre do dia; o **GERAL** conta em quantos dias cada um terminou no topo. São coisas
  diferentes e as duas importam: o geral diz quem é bom nisso há tempo, o de hoje diz quem está na
  frente AGORA — e é ele que faz o jogador voltar antes da virada pra tentar passar alguém.
  O de hoje sai do MESMO documento que o fechamento do dia lê (`trainerTowerDays/{dia}/players`),
  ordenado por `bestFloor` — nenhuma estrutura nova, e nenhum campo a manter em sincronia.
  No modal o de hoje vem **primeiro**: é a disputa que ainda dá pra mudar; o geral é histórico e não
  muda com o que a pessoa fizer nos próximos minutos. Sem abas, porque num modal de 320px elas
  custariam mais toque do que economizam rolagem — os dois títulos separam, e a caixa rola por
  dentro (`max-height:80vh`) quando as duas listas vêm cheias (medido: 20 linhas cabem em 608px,
  com o botão Fechar sempre alcançável).
- **O PÓDIO SÃO OS TRÊS ANDARES MAIS ALTOS DO DIA, e todos eles levam Doce Raro** (`TORRE_PODIO`,
  03/09/2026). **Mas só o mais alto pontua no ranking geral.** São perguntas diferentes: o doce é o
  prêmio de participação, o ponto é o de vencer — dar ponto pro 2º e pro 3º misturaria "quem chegou
  mais longe" com "quem apareceu", e o ranking geral deixaria de medir o que ele mede.
- **Os degraus são de ANDAR, não de posição na lista.** Com cinco treinadores empatados no andar 20,
  os cinco estão no PRIMEIRO degrau, e o segundo degrau é o próximo andar que teve gente. Dia com
  menos de três andares distintos tem menos degraus — não se inventa um terceiro.
- **O empate premia todos**, como sempre: se dois pararam no andar 14 e ninguém passou disso, os
  dois ganham o doce e o ponto. O ranking geral conta **em quantos dias o treinador ficou no andar
  mais alto** (`topDays`); o `clears` antigo (dias em que zerou os 10 andares) fica no documento
  como história e não ordena mais nada.
- **As duas travas de dia são SEPARADAS** (`lastPrizeDate` pro doce, `lastTopDate` pro ponto). Elas
  marcam dias diferentes — quem sobe no pódio todo dia mas só às vezes chega ao topo tem uma
  avançando e a outra não. Uma trava só faria o segundo prêmio sumir em silêncio, e
  `tools/test-torre.js` cobre exatamente esse caso (2º ontem, 1º hoje).
- **A tela do ranking de hoje MARCA o pódio** com 🥇🥈🥉 e um 🍬 ao lado do nome, e a medalha sai dos
  três ANDARES distintos — não de "as três primeiras linhas". Prêmio que o jogador não vê é o erro
  da especialidade de novo.
  **Zerar os 20 não paga doce sozinho** — quem zera está no topo por definição, e pagar nos dois
  lugares seria pagar duas vezes.
  **Por que existe um documento por DIA** (`trainerTowerDays/{dateId}/players/{uid}`): o da subida
  (`trainerTowerRuns/{uid}`) é sobrescrito na virada, então depois da meia-noite não haveria o que
  ler pra saber quem foi mais longe ontem. São no máximo 20 escritas por jogador por dia.
  **O fechamento roda dentro do cron que gera a torre do dia seguinte** — é o único instante em que
  se sabe que o dia anterior acabou, e evita mais uma função agendada. É idempotente pelo campo
  `awarded`, porque o cron roda de hora em hora. A conta do "dia anterior" usa o
  `trainersLeagueDateStrPlusDays` que já existia: uma segunda regra de data (a minha, em UTC) ia
  discordar da do jogo em algum fuso.
- (Histórico: eram 10 andares, médias 58 a 85, escala escolhida pra um campeão da Elite (~67)
  chegar ao andar 5. Ver a nota acima pro modelo de hoje.)
- Times de 6 evoluções finais, níveis espalhados ±3 com os dois extremos garantidos.
- Mewtwo e Eevee fora do pool.
- (Histórico: a recompensa era 1 Doce Raro por torre VENCIDA. Hoje é de quem vai mais longe no dia.)
- **O time da subida é procurado por IDENTIDADE, não por espécie+nível.** A busca antiga pegava o
  primeiro que casasse: quem tinha o mesmo pokémon no mesmo nível em dois saves (um shiny, um
  normal) escolhia o shiny e subia com o normal — perdendo o visual E o buff de 1,20×. O cliente
  manda `monId`/`slot`/`idx`/`shiny` e o servidor vai do mais específico pro mais genérico;
  os dois últimos níveis existem só pra não quebrar cliente antigo em cache.
  `node tools/test-torre.js` cobre os dois lados (escolher o shiny e escolher o normal).

## Batalha Online

- **Dá pra ligar a busca de dentro da jornada** (`botaoBuscaOnlineHtml`, nas telas `preBattle`,
  `battling`, `victory` e `defeat`). A busca em si SEMPRE foi global — ela roda em qualquer tela e o
  convite aparece por cima do que estiver aberto (ver `agendarBuscaGlobal`); o que faltava era poder
  LIGAR sem ir até a Batalha Online, e aí a jornada ficava pra trás. `startOnlineSearchAqui` é a
  mesma `entrarNaFilaOnline`, só que sem trocar de tela.
  Fica fora da Torre e das ligas de propósito: ali o jogador já está numa disputa organizada.
- **O histórico carrega SEMPRE, inclusive com uma busca rodando.** Ele ficava depois do `return` da
  busca no `openOnlineBattle`, e o resultado era uma tela morta: quem tinha busca em segundo plano
  abria a Batalha Online, via "Procurando oponente", cancelava — e a tela dizia *"Carregando seu
  histórico..."* **pra sempre**, porque ninguém mais ia buscar. `onlineHistorico` só é escrito num
  lugar e nunca é limpo, então a tela ficava assim até recarregar a página. Reportado em
  01/09/2026, e o botão de buscar partida das telas de batalha da jornada (30/08) foi o que tornou
  busca em segundo plano comum o bastante pra alguém esbarrar nisso.
- **Nenhuma tela pode ficar "Carregando..." pra sempre.** O erro do `carregarHistoricoOnline` era
  só um `console.error`, e o jogador ficava olhando a frase sem saber se era a internet dele, se
  era o jogo, nem o que fazer — e sem nada no log do servidor, porque a falha nem chegava lá. Hoje
  ele **tenta duas vezes** (essa função COLD-STARTA a cada chamada — é rara, a instância já
  morreu —, então a primeira tentativa é a mais frágil: rede de celular oscilando ou deploy em
  rollout derrubam ela), tem **prazo próprio de 12s** (o SDK espera 70, e 70 segundos de
  "Carregando..." é indistinguível de travado) e, se ainda assim não vier, a tela **diz o que
  houve** e oferece "Tentar de novo".
- **Aceitar um convite no meio da revelação CONCLUI a batalha da jornada antes de sair.** O
  resultado já foi calculado pelo `runBattle`, mas quem aplica (insígnia, derrota, nível de quem
  desmaiou) é o `finishBattle`, no fim da revelação — sair antes dele deixava a luta sem efeito
  nenhum, e o ginásio tinha que ser enfrentado de novo.
- **O convite NÃO espera a batalha terminar**: ele tem 15 segundos de prazo, e do outro lado há
  alguém esperando. Segurar até o fim da revelação (que dura mais que isso) faria a partida expirar
  pros dois.
- **O aviso "inscrições abertas pra Liga Clássica das XXh"** aparece embaixo desse botão, e só pra
  quem AINDA NÃO ESTÁ NA LIGA — o que é mais que "não inscrito neste ciclo": quem está disputando um
  ciclo já sorteado não consegue se inscrever no próximo (a própria tela bloqueia), e avisar seria
  convidar pra uma porta fechada. Quem responde isso é o `isAccountActiveInLeague`.
  **Inscrever-se apaga o aviso na hora e zera a folga** (`game.ultimaChecagemDaLiga`): sem isso quem
  acabava de se inscrever continuava vendo o convite nas batalhas seguintes, porque a cópia em
  memória só era relida 5 minutos depois — reportado em 01/09/2026. Pisca no mesmo ritmo do Bônus Shiny da home (`shiny-bonus-pulse`):
  as duas coisas são janelas de tempo que expiram. Os dados vêm de duas leituras
  (`atualizarAvisoDaLiga`), no máximo uma vez a cada 5 minutos e disparadas do `runBattle` — e ela
  **nunca chama render()**: rodaria no meio da animação da batalha e mataria a transição da barra
  de vida. O aviso entra no próximo desenho natural da tela.

- **Não é turno a turno.** É confronto a confronto: o motor resolve uma dupla de cada vez, e entre
  confrontos abre janela de escolha (10s no inicial, 5s nas trocas).
- **Não existe cron.** O estado guarda um prazo, e quem consultar depois dele dispara a resolução.
  Se os dois fecharem a aba, a partida congela em vez de gastar recursos.
- **Prazos são carimbos do servidor.** O cliente sincroniza o relógio (`serverNow` vem em toda
  resposta). Comparar com `Date.now()` local desloca a contagem — relógios de celular não batem.
- Folga de 600ms antes de resolver: escolhas em trânsito ainda contam.
- Pareamento e desafio do lobby criam a MESMA pendência, com 15s pra aceitar. Só volta pra fila
  quem tinha aceitado — recolocar quem não aceitou criava fantasmas eternos na fila.
- Presença do lobby: carimbo de tempo renovado a cada 4s, expira em 20s.
- **O time é escolhido DENTRO da batalha** (fase `teamPick`, 15s), depois que os dois aceitam —
  não antes de entrar na fila. Quem busca oponente não fica preso a um time enquanto espera.
- Como o servidor não conhece os saves, o cliente manda **todos os times elegíveis** ao entrar na
  fila (ou no lobby) e depois escolhe **por índice**. É isso que dá um padrão pra quem não escolhe
  (entra o primeiro da lista) mesmo com a aba fechada. O servidor **nunca aceita um código novo**
  na hora da escolha: aceitaria montar time depois de ver o adversário.
- A janela de time acaba **assim que os dois escolhem** — ao contrário da janela de escolha de
  pokémon, que vale inteira sempre (lá é ritmo de batalha; aqui seria só tela parada).
- No lobby cada treinador aparece com a **faixa** de nível dos times dele (`Lv.62–70`), não com uma
  média só: qual time vai entrar nem ele decidiu ainda.

## Boss de Domingo (raide global)

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

## Liga Clássica (e as customizadas)

- **Na escolha de time, o CARD é o botão.** Havia um botão vermelho "Inscrever esse time" embaixo de
  um card que já é a coisa clicável em todo o resto do jogo. O card traz a MESMA estrela de média da
  home (o jogador reconhece o time por ela, então repetir aqui evita reaprender a mesma informação),
  e o troféu ao lado do nome saiu.
- **O MEWTWO EMPRESTADO NÃO RESTRINGE NADA.** Ele é um pokémon normal que fica no time salvo por 24h
  (e depois 7 dias de espera): qualquer código de time montado a partir do save — Liga, Trainers
  League, Torre, Ginásio da Cidade — já sai com ele dentro, quantas vezes o jogador quiser. Por isso
  **saiu o prêmio de "1 uso"** (01/09/2026): ele era anterior ao empréstimo e vinha da ideia oposta
  — um código DERIVADO, com o Mewtwo no lugar de quem tinha ido pro Prof. Carvalho, gasto numa
  inscrição só. Saíram os dois botões ("Inscrever COM o Mewtwo" na Liga e "Ativar Mewtwo pra hoje"
  na Trainers League), o `buildMewtwoTeamCode` e o consumo do prêmio.
  **O campo `mewtwoReward` CONTINUA** — é ele que marca "venceu o Mewtwo" e é o que libera o
  empréstimo (ver `checkMewtwoLoanUnlock` no servidor). O que acabou foi o gasto dele. A conquista
  "Arma Secreta" passou a valer o EMPRÉSTIMO, senão ficaria impossível; quem já a tinha pelo caminho
  antigo continua com ela.
- **A inscrição guarda um CÓDIGO do time, congelado na hora da inscrição** — de propósito: ninguém
  troca de time no meio de uma competição. Mas subir um nível com o Doce Raro não é trocar de time,
  é o mesmo time mais forte, e o servidor repropaga sozinho (`atualizarInscricoesComTime`, chamado
  dentro do próprio `useRareCandy`; só mexe em ciclos ainda em `registering`).
- **O que ficava velho era a CÓPIA na memória da aba.** A tela lê `game.registeredTeam`, e ele só
  era relido ao ABRIR a tela da Liga — então cancelar a inscrição e entrar com outro time deixava a
  lista do time ANTIGO na tela, e um Doce Raro deixava o nível antigo, até sair da Liga e voltar.
  `refreshLeagueView` não resolvia: ele cuida do ciclo e do ranking, não da sua inscrição — quem
  relê é o `checkLeagueRegistrationStatus`. Hoje inscrever manda reler, cancelar limpa na hora, e o
  Doce Raro invalida a cópia (e relê, se a Liga estiver aberta).
  `tools/test-liga-inscricao.js` dirige os três caminhos com os colaboradores trocados por espiões —
  o que ele tranca não é o que vai pro Firestore (isso o servidor já faz), é a tela não continuar
  mostrando uma inscrição que não existe mais.

## Trainers League

- **O "mínimo pra formar" vale só pro RESTO, e resto só existe quando outra liga já se formou.**
  A regra divide os inscritos em grupos de 16 e manda o último grupo pra amanhã se ele tiver
  `TRAINERS_LEAGUE_MIN_TO_FORM` (4) ou menos. A condição era `groups.length > 0`, então um dia com
  4 inscritos dissolvia o ÚNICO grupo e cancelava o dia — e no dia seguinte repetiria com os
  mesmos 4, pra sempre. Hoje é `groups.length > 1`, e com um grupo só o mínimo não vale: 2 pessoas
  já são uma liga (com 1 não dá, o round-robin sai com 0 rodadas).
- **Nenhum caminho pode deixar o ciclo num estado transitório.** Quem grava `status:'locked'` é o
  `trainersLeagueLockGroupInto`, chamado uma vez por grupo — com ZERO grupos ele nunca roda, e o
  ciclo ficava parado no `'locking'` que a própria trava tinha acabado de gravar. Efeito em
  cascata, medido na produção de **31/08/2026**: a tela caía no ramo de 'locking' e anunciava
  *"Chaveamento sorteado — a primeira rodada é às 11h30"* sem chaveamento nenhum; o agendador
  (roda de minuto em minuto) via 'locking' + hora passada e re-travava a cada ~2 minutos, porque
  trava vencida é roubável (`TRAINERS_LEAGUE_CLAIM_LEASE_MS`); e cada volta mandava OUTRA
  notificação de adiamento pros mesmos inscritos — **21 notificações iguais** pra dois deles em
  1h30. Hoje, sem nenhum grupo, o ciclo vai pra `'complete'` com `noLeagueReason`, que é o que a
  tela usa pra dizer "hoje não teve liga" em vez de anunciar um chaveamento que não existe.
- A divisão em grupos virou uma função PURA (`trainersLeagueSplitGroups`) exportada pro teste: sem
  isso ela só era alcançável através do relógio (a trava só roda depois das 11h) e do Firestore.
  `tools/test-liga-treinadores.js` tranca as duas coisas — a tabela de quem forma liga (0, 1, 2, 4,
  16, 17, 20, 21, 30, 34 inscritos), que ninguém some entre "joga hoje" e "fica pra amanhã", e que
  o ciclo nunca termina em estado transitório.
- **O horário de início se ajusta pra frente**: `startTime = max(11h30, agora)`. É o que permitiu
  destravar o dia 31/08 às 11h56 e ainda jogar as 3 rodadas (11h56, 12h26, 12h56) em vez de perder
  o dia.

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

## Mapa de Kanto

- SVG desenhado no próprio arquivo, **nenhuma imagem de fora**. Já houve dois episódios de imagem
  hotlinkada que funcionava local e morria publicada (ver `GYM_BADGE_VISUALS`).
- **Só o caminho já percorrido é desenhado**, mais o trecho atual pontilhado. Desenhar a jornada
  inteira virava espaguete: o trajeto real de Kanto se cruza várias vezes (Celadon → Fuchsia →
  Saffron → Cinnabar → Viridian) e num celular isso lia como rabisco. A visão linear do que falta
  é a **trilha de insígnias** (`kantoTrailHtml`), que é outra coisa e fica em outro lugar da tela.
- `game.routeHistory` guarda a rota escolhida por trecho. É estado de **exibição** — nenhuma regra
  lê. `currentRoute` sozinho não servia: ele é sobrescrito no trecho seguinte, e o mapa perdia a
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
