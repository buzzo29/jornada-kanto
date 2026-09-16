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
  calado: são ONZE listas hoje, e **157 das 250** espécies têm pelo menos um especial — 9
  autodestruição, 43 sono, 17 anulação, 6 Metrônomo, 10 Recuperar, 23 drenagem, 19 Fúria, 82
  confusão, 7 Fúria do Dragão, 1 Sketch, 13 Dança da Chuva e 2 Sino Curativo, com sobreposição. O teste varre as
  listas em vez de contar, que é o que impede o próximo número de envelhecer do mesmo jeito.)
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

## Os golpes do pokémon (escolhidos pelo jogador) — hoje são TRÊS

Cada pokémon leva **até TRÊS golpes** (`MAX_GOLPES`), escolhidos na captura e trocados quando o nível traz um
golpe novo. É a **primeira vez que uma escolha do jogador entra na conta de DANO** — até aqui todo
golpe valia 60 (`MOVE_POWER`) e o motor só escolhia o TIPO.

- **Só golpe de DANO.** Status (Hipnose, Growl, Harden) fica de fora: os efeitos que não são dano já
  são os **golpes especiais** do jogo, com mecânica própria e chance por confronto.
  **Autodestruição e Explosão também ficam de fora**, e não é esquecimento: elas JÁ SÃO a mecânica de
  autodestruição, nas mesmas 9 espécies. Como golpe comum de 200 e 250 de poder, **sem o custo de
  cair junto**, seriam a escolha óbvia de todo mundo que as tem e ainda modelariam a mesma coisa
  duas vezes.
- **O NÚMERO É UMA CONSTANTE, `MAX_GOLPES`, e foi 2 até 09/09/2026.** Virou **3** a pedido.
  Ele aparecia em **nove lugares** — o auto-preenchimento, a marcação da tela, a validação do
  confirmar, a fila de aprendizado, o texto do cabeçalho e o do botão. Com o número solto, mudar de
  2 pra 3 era achar os nove; hoje é uma linha. **Não vale pro NPC**: o `equiparNpc` dá o moveset
  INTEIRO da espécie de propósito — o teto é a regra de quem ESCOLHE, e o NPC não escolhe.
  **O PREÇO MEDIDO: a jornada concluída sobe de 64,35% para 70,28%** — **+5,93 pontos, 8,4σ** (10
  blocos de 1.000 jornadas de cada lado). É quase metade do que o moveset dos NPCs tinha tirado
  (−12,56), e vem do mesmo lugar: **cobertura de tipo**. O 8º ginásio cai de 1.495 pra **1.185**
  game overs e o 6º de 746 pra **541**; o Brock quase não se move (895 → 799).
  **Efeito colateral na TELA DE ESCOLHA, e ele é grande:** com o teto em 3 ela só abre pra quem tem
  **4 ou mais** golpes disponíveis. Um Venusaur nível 60 tem exatamente 3 e passou a ser preenchido
  sozinho — a tela ficou bem mais rara no começo da jornada.
  **Custo de tela medido a 320px:** a fileira do time ganha uma linha de golpe (+15px por pokémon) e
  a tela de ordem vai de **1.114 pra 1.189px, +6,7%**, sem rolagem horizontal.
- **"Até três", não "três".** Medido: no **nível 5 só 16 das 250 espécies** têm mais de dois golpes de
  dano — 176 têm menos de dois, e **8 não têm nenhum em nível nenhum** (Kakuna, Metapod, Abra, Ditto,
  Unown, Wobbuffet, Delibird, Smeargle; o que elas aprendem é Harden, Teleport, Transform, Sketch).
  Quem tem 2 ou menos disponíveis **não vê tela**: escolher 2 entre 2 não é escolha, e uma tela de
  uma resposta só é pior que tela nenhuma.
- **QUEM NÃO TEM GOLPE CAI NO MOTOR DE TIPO, e isso é o desenho, não migração preguiçosa.** Vale pras
  8 espécies acima E pra todo save gravado antes desta feature. Sem a queda elas ficariam sem atacar.
  `melhorAtaque` devolve **null** nesse caso, e é o null que faz o `bestAttackType` seguir pro motor
  de sempre, logo abaixo. Um objeto vazio no lugar dele deixaria o pokémon sem golpe.
- **A tabela `GOLPES` (id → [tipo, poder]) é a SEXTA duplicada** entre `index.html` e
  `functions/index.js` — é o mínimo que o cálculo de dano precisa, e o dano roda dos dois lados.
  `GOLPES_PT` (nome) e `APRENDIZADO` (quem aprende o quê) ficam **só no cliente**: nome é
  apresentação — a mesma regra do `MOVE_BY_TYPE` — e o servidor nunca precisa saber quem aprende o
  quê, porque os golpes escolhidos viajam na instância.
  As três saem de `data/golpes.json` por `tools/gerar-tabelas-golpes.js`.
- **A comparação dos DOIS MOTORES passou a equipar golpes**, em metade das voltas — sem isso ela
  lutaria com o motor de tipo dos dois lados e uma divergência só apareceria em produção. É a mesma
  lição do item de atributo. Conferido: com 0,1 de diferença no STAB de um dos lados, **25 das 300
  batalhas divergem**. O `playerMoveId` entrou no resumo porque dois golpes de tipos diferentes
  podem dar o mesmo dano — sem o id a comparação daria verde com um motor batendo de Raio e o outro
  de Investida.

### O fluxo: onde cada pergunta acontece
- **Capturou → `escolhaDeAtaques`**, no topo do `startLevelDistribution`. É o funil por onde passam
  os dois braços do encontro selvagem (`proceedAfterTeamLocked` e `chooseEeveeEvolution`), e vem
  **antes** da distribuição de propósito: o jogador acabou de capturar, e é do bicho novo que ele
  está pensando.
- **Subiu de nível → `aprenderAtaque`**, no topo do `continueFromEvolution`. Fica **DEPOIS da
  evolução** porque a evolução troca a espécie, e é a tabela da forma NOVA que vale daqui pra frente
  — igual ao jogo original, que não volta pra ensinar o que a forma anterior sabia.
- **A EVOLUÇÃO DESTRAVA O QUE É NOVO NA FORMA NOVA** (`golpesDaEvolucao`), e isso não é a mesma
  coisa que reabrir a janela. A Gen 2 lista quase tudo de quem evolui por pedra **no nível 1**, e a
  janela conta só nível — então esses golpes ficavam **inalcançáveis pra sempre**. Medido: **28 dos
  112 degraus (25%)**, **38 golpes**, 1,4 por degrau afetado e no máximo 3. O Gyarados nunca
  aprendia **Pancadaria (90)** nem Mordida, o Charizard nunca aprendia Ataque de Asa, o Exeggutor
  nunca aprendia Bomba de Ovo (100), o Victreebel nunca aprendia Folha Navalha.
  **O que NÃO se faz é zerar o `nivelDosAtaques`**: isso re-ofereceria tudo que a forma antiga já
  tinha listado e o jogador já tinha recusado ou deixado passar — um Charmeleon que escolheu 2 entre
  5 seria perguntado de novo sobre os outros 3 só por ter evoluído. A conta é a **diferença entre as
  duas listas no nível de hoje**, e quem guarda qual era a forma antiga é o `especieDosAtaques`,
  carimbado quando a fila esvazia. Sem esse carimbo os golpes da evolução voltariam em toda
  distribuição de níveis dali pra frente.
  **Medido:** a jornada concluída sobe de 63,41% pra **64,42%** (8.000 de cada lado, 1,0 ponto,
  1,3σ) — e com isso a feature inteira fica em **0,80 ponto abaixo** do jogo sem golpes (1,1σ,
  ruído), contra 1,81 antes.
  **O `evolucaoDepois` só é consumido depois que a fila esvazia**: limpo antes, a volta da tela de
  aprendizado cairia no `teamOrder` em vez de continuar a jornada.
- **O Bônus de Kanto entrou na condição** (`aprendizadosPendentes()` ao lado de `evs.length`): ele é
  a ÚLTIMA coisa que sobe nível na jornada, e sem isso um golpe cruzado ali só seria perguntado
  depois da primeira luta da Elite.
- As duas seguem o desenho do `evoChoice`: **a marca fica no POKÉMON** (`escolherAtaques`), a fila é
  derivada por uma função, e a tela é só apresentação — quem valida é a ação. `confirmarAtaques`
  revalida que os dois marcados são golpes que a espécie realmente aprende.
- **A recusa é GRAVADA** (`ataquesRecusados`). Sem isso a pergunta voltaria no próximo nível, e
  voltaria pra sempre.
- **A base é aprendizado por NÍVEL, e só.** Reportado em 09/09/2026: uma Starmie que não foi
  perguntada sobre o **Psychic**. Não é furo — **Psychic é TM nas duas gerações** (TM29), e a
  Starmie, que evolui por pedra, não ensina **nenhum** golpe de dano novo por nível na Gen 2 (a
  lista dela é Raio de Bolhas, Investida e Giro Rápido, todos nível 1, todos que o Staryu já tinha).
  O mesmo vale pro Psychic do Alakazam e pro Terremoto de meio Kanto. Ensinar golpe por TM é outra
  feature — precisa decidir quais TMs o jogador tem —, e o `data/golpes.json` só cadastra nível.
- **`nivelDosAtaques` é a janela do que ele CRUZOU agora.** Sem ela, um pokémon nível 40 abrindo o
  save receberia de uma vez a pergunta de tudo que aprendeu no caminho.
- **Quem tem VAGA aprende sem perguntar** (menos de 2 golpes): não há o que trocar.
- **As duas telas são ponto seguro de gravação.** O jogador PENSA nelas, e fechar a aba ali não pode
  perder a captura nem repetir a pergunta.
- **SAVE ANTIGO ESCOLHE, um pokémon por vez, ao ABRIR o save** (`escolhaDoSavePendente`, nos DOIS
  caminhos: `continueSave` e `continueCompleteSave` — o segundo é o do save campeão, que é
  justamente quem tem mais pokémon de nível alto esperando). O `hydrateTeamMember` **marca**
  `escolherAtaques` em vez de preencher: escolher pelo jogador seria decidir no lugar dele a decisão
  mais forte do jogo — medido, o par de golpes vale **79 pontos** de taxa de vitória entre o melhor e
  o pior par.
  Quem tem 2 ou menos disponíveis não vê tela (o resolvedor preenche sozinho), então um time de 6
  costuma render 3 ou 4 telas, não 6.
  **`game.escolhaDepois` guarda pra onde voltar** — a tela em que o save estava. É uma CHAVE no save
  e não uma função, pelo mesmo motivo do `evolucaoDepois` e do `releaseDepois`: a tela de escolha é
  ponto seguro de gravação, e função não sobrevive ao save. Fechar a aba no meio da fila volta pra
  ela, e o destino não é sobrescrito pela própria tela de escolha.
  **Consequência conhecida:** enquanto o dono não abrir aquele save, os pokémon dele continuam sem
  golpe — então na Torre e no Ginásio da Cidade eles lutam no motor de tipo. É a mesma regra de
  sempre ("quem não tem golpe cai no motor de tipo"), e se conserta sozinho na primeira abertura.
- **O inicial não escolhe**: no nível 5 os sete têm UM golpe de dano só. Ele já sai com o dele e
  passa a ser perguntado a partir do primeiro golpe novo.

### Onde os golpes valem (e onde não)
- **Valem**: jornada, Torre e Ginásio da Cidade — os três montam o time a partir dos SAVES, e o campo
  viaja junto (`resolverTimeDosSaves` devolve `ataques`; o `createInstance` da Torre recola, pelo
  mesmo motivo que já recolava o shiny).
- **⚠️ E VALEM NAS LIGAS E NO ONLINE DESDE 16/09/2026** — ver a seção **OS GOLPES ESCOLHIDOS CHEGAM
  NA LIGA E NO ONLINE**. Até lá não valiam, e a razão escrita aqui era: *"o time é um código
  (`especie:nivel:shiny`), o `decodeTeamCode` recusa um quarto campo, e mexer nisso é mexer na trava
  anti-falsificação"*. **A trava continua intocada** — o que mudou é que os golpes passaram a viajar
  **AO LADO** do código, dentro do match, como os `slots` já faziam, e o servidor valida o que chega.
- **Os NPCs não têm golpe escolhido** — líder de ginásio, rival, treinador da Torre. Todos vêm do
  `createInstance`, que não preenche o campo, então eles lutam no motor de tipo, com o poder
  implícito de 60. **Isso é a maior consequência da feature, e o número está abaixo.**

### O log
- O confronto carrega `playerMoveId`/`enemyMoveId` ao lado do tipo. **O tipo continua mandando na
  COR** do selo; o id só troca a PALAVRA. Sem id (log velho, pokémon sem golpe escolhido) o selo sai
  **idêntico** ao que saía antes — conferido nas 250 espécies e em todos os tipos delas.
  Sem isso, um Gyarados de Hidro Bomba aparecia batendo de "Jato d'Água".
- **O jogador VÊ os dois golpes nas QUATRO telas de ordem** (`golpesDoTimeHtml`), as mesmas onde o +
  de item aparece — sem isso ele escolhe dois golpes e não tem onde conferir o que escolheu.
  Sai vazio pra quem não tem golpe, inclusive na **defesa do ginásio da cidade**, que vem de um
  código de time e por isso nunca carrega golpe.
  **Custo medido a 320px**: a fileira vai de **110px pra 127px** (2 linhas de golpe: 142px) e a tela
  inteira de **968 pra 1.085px, +12%**. Sem rolagem lateral. Os selos de golpe são **menores que os
  de tipo** (.5rem contra o padrão) porque são dois NOMES por linha — "Deslizamento de Rochas" tem 22
  letras — numa coluna que a 320px mede 167px; no tamanho dos selos de tipo, um par comprido
  quebrava em três linhas.

### O PREÇO MEDIDO
- **A jornada concluída cai de 65,22% pra 64,42%** (era 63,41% antes de a evolução destravar os
  golpes da forma nova -- ver acima) — 8.000 jornadas de cada lado (4 × 2.000, o smoke
  estoura a memória do Node acima disso), **0,80 ponto, 1,1σ** — ou seja, dentro do ruído. Sem o
  destrave da evolução era 1,81 ponto e 2,4σ, o que já era pequeno; hoje não dá pra distinguir de
  zero com esta amostra.
- **O FORMATO da dificuldade muda mais que o total.** Em 2.000 jornadas, os game overs no **Brock
  vão de 419 pra 404** e os do **Giovanni de 187 pra 148** -- o começo fica igual e o fim afrouxa um
  pouco. Antes de a evolução destravar os golpes, o Brock ia a **447**: era ali que o time chegava
  fraco, e é ali que o Gyarados com Pancadaria em vez de Investida se sente.
  A causa é o PODER, e ela é direta: o melhor golpe disponível vale em média **40,5 no nível 5**
  (contra os 60 implícitos de sempre) e **89,4 no nível 60**. Ou seja, **o jogador fica mais fraco
  que os líderes no começo e mais forte no fim** — porque os NPCs continuam nos 60 fixos.
- **A cobertura de tipo quase não muda**, e isso foi medido porque parecia o risco maior: os tipos de
  ataque por espécie caem de **1,76 pra 1,56**, os confrontos com golpe resistido sobem de **11,1%
  pra 12,9%**, e os **sem golpe útil (o teimoso) até caem** (1,0% → 0,8%) — porque um golpe pode ser
  de um tipo que a espécie não tem.
- **ESCOLHER BEM É A DECISÃO MAIS FORTE DO JOGO, e por muito.** 12.000 batalhas 6x6 nível 60, mesmos
  times e mesma semente, só o par de golpes mudando: com os **dois melhores contra os dois piores do
  adversário, 89,72%**; ao contrário, **10,51%**. São **79 pontos de amplitude** — o shiny (1,20×), o
  terreno (1,15×) e a Faixa de Foco (+4,98) não chegam perto. Com os dois lados escolhendo bem a
  batalha volta pro empate (50,37%, contra 50,52% do controle sem golpe nenhum).
  A tela ordena por poder decrescente e mostra o poder de cada um justamente por isso.
- **O TIPO do golpe sai por extenso, num selo próprio** (`linhaDeGolpe`), ao lado do nome e do poder.
  A cor sozinha não diz qual é: o roxo do Fantasma e o do Psíquico se parecem, e é justamente entre
  esses dois que a escolha costuma decidir. No cabeçalho da tela de aprendizado o nome fica numa
  linha e o tipo + poder na de baixo (`.golpe-novo`) — inline os três quebravam no meio ("Poder" numa
  linha, "55" na outra), porque ali o `.mon-sub` não está dentro de um `.btn` e não herda o
  `display:block` de lá.
  Os cards da tela de aprendizado **não dizem "Esquecer este"**: a pergunta já está no cabeçalho
  ("Escolha qual retirar") e repeti-la em cada card é a mesma frase três vezes na mesma tela.

### As quatro correções de 09/09/2026 (relatadas pelo jogador, e três achadas junto)

O relato foi: *"a Chikorita tem Investida no level 1 e não está vindo; no level 12 ela aprendeu
Folha Navalha e deveria aparecer uma tela dizendo isso; no level 22 ela aprendeu Investida e não
perguntou qual tirar; e o Togepi deveria aparecer o Metrônomo, porém não exibe nada"*.

- **A PREMISSA ESTAVA ERRADA E O INCÔMODO ESTAVA CERTO.** Rodando `chooseStarter` de verdade, os
  sete iniciais recebem sim o golpe de nível 1 (a Chikorita sai com Investida, `nivelDosAtaques`=5)
  — não existe caminho em que o inicial nasça sem golpe. O que o jogador não tinha era **como saber
  disso**: o segundo golpe entrava em silêncio.
  **O QUE O PRINT NÃO PROVA, e esta seção chegou a afirmar que provava:** que aquela Meganium tinha
  Investida. `[Golpe de Corpo, Folha Navalha]` **não é assinatura de uma troca no slot 0** — é a
  saída literal de `ataquesPadrao(Meganium Lv.32)`, que é justamente a função do pokémon que NUNCA
  escolheu golpe (save gravado antes da feature), e é também o que sai da tela de escolha quando o
  jogador clica os dois primeiros cards, porque ela lista por poder decrescente: Golpe de Corpo (85),
  Folha Navalha (55), Investida (35). Os dois caminhos chegam ao print **sem a Investida ter
  existido um segundo**, e nenhum dos dois exige que o relato esteja errado. O caminho "ele trocou
  no 31" exige **uma tela de troca** — exatamente a que o jogador diz que não apareceu.
  A lição é a de sempre aqui: reconstruir um estado final não identifica o caminho que levou a ele.
- **O SILÊNCIO ERA O DEFEITO, e a tela nova é a correção pedida** (`golpeAprendido`,
  `anunciarGolpesAprendidos`). Quem tem VAGA continua aprendendo **sem perguntar** — não há o que
  trocar, e perguntar seria a tela de uma resposta só —, mas agora **avisa**. Segue o desenho da
  tela de evolução: um ANÚNCIO, uma tela por passada listando tudo, e um "Continuar".
  Medido em 300 jornadas: **859 anúncios, 2,86 por jornada** (mediana 3, maior 6), e **94% deles
  trazem um golpe só**. É barato, e é o segundo golpe de **todos os sete iniciais**.
  A 320px ela cabe em três linhas mais o botão, sem rolagem lateral.
- **O GOLPE SUMIA NA EVOLUÇÃO, e esse era o defeito de verdade.** A Gen 2 re-lista no **nível 1**
  quase tudo que a forma anterior ensinava mais tarde — Folha Navalha é 8 na Chikorita e **1** na
  Bayleef, Trovão é 41 no Pikachu e a Raichu nem ensina. Como `aprendizadosPendentes` lia só a
  tabela da forma NOVA, esses golpes caíam abaixo do `nivelDosAtaques` e ficavam **inalcançáveis
  pra sempre** sempre que a evolução e o nível do golpe caíam na mesma distribuição de níveis.
  `golpesDaEvolucao` não resgatava: ele só cobre o que a forma nova ensina e a antiga não.
  Medido: **61 dos 117 degraus** perdiam pelo menos um golpe assim (76 golpes), e em 300 jornadas
  simuladas isso aconteceu **90 vezes** — Trovão (120) do Raichu, Derrubada (90) do Donphan, Talho
  (70) do Ursaring, Bomba de Ovo (100) da Blissey. Hoje a **janela vale pras duas formas**, e o
  resgate só alcança golpe que a forma NOVA também ensina: **90 → 30**, e os 30 que sobram são os
  que a forma nova realmente não sabe (Raichu sem Trovão, Donphan sem Derrubada, Scizor sem Ataque
  de Asa) — que é a regra do jogo original e fica como está.
- **TIRAR UM GOLPE TRAVAVA O JOGO NUM CARROSSEL INFINITO.** `responderAprendizado` punha o golpe
  novo no lugar do escolhido e não anotava nada — e o retirado voltava pra fila no instante
  seguinte, porque o nível dele ainda está DENTRO da janela sempre que os dois foram aprendidos na
  mesma distribuição. Medido com um Nidoran♂ nível 30 (Chute Duplo no 12, Ferrão Venenoso no 17):
  a tela reabria pros dois **alternadamente, 40 vezes em 40**, e a jornada parava ali sem saída.
  **Tirar um golpe agora é recusar ele** (`ataquesRecusados`) — a mesma regra do "não aprender", e
  o que o jogo original faz: golpe esquecido não volta sozinho. As mesmas 40 voltas viram 3 telas.
- **O TOGEPI NÃO EXIBIA NADA PORQUE NÃO TINHA O QUE EXIBIR — e a fileira passou a anunciar o
  Metrônomo.** `APRENDIZADO.togepi` é `[[21,'ancientpower'],[37,'doubleedge']]`. O buraco real era
  maior e vinha de antes: o `tipoDoGolpe` dava curto-circuito nas espécies do `METRONOMO`, que
  atacavam com tipo **sorteado** e nunca chegavam no `melhorAtaque` — o golpe escolhido delas nunca
  valia um ponto de dano. Na época isso se resolveu devolvendo **lista vazia** pra elas.
  **⚠️ ESSE DESENHO ACABOU EM 10/09/2026**: o Metrônomo passou a DISPUTAR com os golpes próprios em
  vez de substituí-los, elas voltaram a escolher golpe como todo mundo, e a fileira mostra **os
  dois** — os selos cheios dos escolhidos mais o tracejado do Metrônomo. Ver a seção **O METRÔNOMO
  SORTEIA E DEPOIS ESCOLHE**. A conta das "oito que não atacam", que tinha virado 8 + 4, voltou a
  ser **uma**: o Ditto.
  Quem não tem golpe **nem** especial (Abra, Ditto, Kakuna, save antigo, a defesa do ginásio da
  cidade — que vem de código de time) continua saindo vazio: ali não há o que dizer.
- **Três batalhas clonavam o time com `createInstance` e JOGAVAM FORA os golpes escolhidos** — o
  mesmo defeito que o `shiny` já tinha tido nos mesmos três lugares, e o comentário dele estava
  ali do lado: a batalha por **código de treinador**, o **desafio do Mewtwo** e a tela de ordem do
  **desafio do Ginásio da Cidade**. Nos dois primeiros o time inteiro caía no motor de tipo com o
  poder implícito de 60; no terceiro a fileira saía muda num modo em que os golpes VALEM.
- **`game.escolhaDepois` vazava e roubava a distribuição de níveis seguinte.**
  `escolhaDoSavePendente` gravava o destino ANTES de saber se a tela ia abrir — e a fila do save
  antigo se resolve sozinha sempre que todo mundo tem 2 ou menos golpes disponíveis, que é a regra
  no começo da jornada. O campo é serializado, então ficava gravado esperando: na PRÓXIMA captura, o
  jogador confirmava os dois golpes do bicho novo e ia parar na tela em que o save estava semanas
  antes, **pulando a distribuição de níveis daquele ginásio**. Hoje o destino é devolvido quando a
  tela não abre.
- **As telas de golpe entraram na rede do F5** (`aprenderAtaque` e `golpeAprendido`), junto das de
  evolução: as quatro são ponto seguro de gravação e as quatro são alcançadas com
  `evolucaoDepois:'special'` (Elite e esconderijo da Rocket). Sem isso o Continuar depois de um F5
  largava o jogador no `preBattle` no meio da Elite.
- **CUSTO MEDIDO DE TUDO ISSO JUNTO: nada.** Conclusão **64,33% → 65,43%** (6.000 jornadas de cada
  lado, rodando o MESMO bot contra as duas versões pelo `--html`), **+1,10 ponto, 1,3σ** — dentro do
  ruído, e para o lado esperado (recuperar golpe perdido só ajuda). O formato não se move: os game
  overs no Brock vão de 1.358 pra 1.322 e no Giovanni de 400 pra 378.
- `tools/test-ataques.js` tranca as quatro coisas: que o anúncio abre e é ANÚNCIO (não pergunta),
  que a Folha Navalha sobrevive ao salto 5→16, que o que a forma nova não ensina **não** volta, que
  o carrossel termina, e que as quatro do Metrônomo não escolhem e anunciam o que usam.

### As TRÊS telas de golpe (o desenho, 09/09/2026)

A da CAPTURA (escolher 2), a de TROCA e o ANÚNCIO **dividem os mesmos blocos**, e é uma cópia só:
as três contam a mesma coisa, e enquanto eram montadas em separado já tinham divergido no texto e
no tamanho da fonte. Os blocos são `golpe-cab` (o sprite num ladrilho + a frase) e
`cartaoDeGolpe` (nome do golpe, selo do tipo, e o poder separado por um risco).

- **O CARD CLICÁVEL É O MESMO CARD DO POKÉMON da tela que mostra a ordem do time** (10/09/2026,
  a pedido): borda de 2px, cantos de 5px, sombra leve e a faixa da cor do tipo — os quatro valores
  do `.team-grid-card`, conferidos no navegador.
  **QUEM CARREGA A FAIXA É O BOTÃO, não o cartão de dentro**, e essa é a diferença que se vê. Ela
  nasceu no cartão e ali ficava DENTRO da moldura de 3px do botão comum: lia-se como um risco solto
  no meio do card em vez da borda dele. O botão comum é pesado de propósito — ele é um botão de
  AÇÃO; aqui a lista é de CARDS que por acaso se clicam, e o peso brigava com isso.
  O estado **selecionado** continua sendo o amarelo do `.btn.selected`, com o 1º/2º na coluna do
  número — na tela de captura a prioridade é enxergar o que já foi escolhido, e ali a faixa some um
  pouco contra o amarelo. É aceito.
- **O RISQUINHO DA ESQUERDA é da cor do TIPO do golpe** (09/09/2026, a pedido), e é o mesmo desenho
  do card de pokémon da tela de ordenar o time (`.team-grid-card`): borda de 5px com a cor vindo
  **inline**, porque ela muda de card pra card. Ele repete a informação do selo de propósito — o
  selo se lê, o risquinho se **reconhece** de relance, e é ele que separa dois cards antes da
  leitura começar.
  **Armadilha:** dentro do botão de opção existe `.btn.golpe-opcao .golpe-cartao{border:none}`, que
  zerava o risquinho junto — a cor só aparecia no cartão do cabeçalho. A regra devolve a largura e
  o estilo da borda esquerda; a cor continua inline.
- **A FONTE DO NOME DO GOLPE É A MESMA DO NOME DO POKÉMON NO QUADRO DE BATALHA** (`.fighter`,
  **.85rem**), a pedido. Era .95rem. As duas telas são a mesma leitura — um nome curto em caixa
  alta que se lê de relance — e tamanhos diferentes pra a mesma coisa é o que faz a interface
  parecer montada por partes.
- **QUEM É COLORIDO É O SELO DO TIPO, e só ele.** O cartão já teve um ladrilho com emoji do tipo à
  esquerda e o fundo inteiro tingido; as duas coisas saíram no mesmo dia em que entraram — com o
  cartão tingido E o selo colorido, a mesma cor aparecia duas vezes na mesma linha e nenhuma se
  destacava. O cartão é neutro e o selo carrega a cor.
- **O selo é o `typePill` DE VERDADE**, o mesmo da Pokédex, da fileira do time e da batalha. Usar
  a função em vez de recriar a cor é o que garante que Sombrio aqui seja o mesmo marrom de lá — e
  é isso que o teste tranca (ele compara com `TYPE_COLORS.Rock`, não com um hexadecimal escrito
  à mão). Dentro do cartão ele sai menor (.5rem, padding 1px 6px); fora, no tamanho do jogo.
- **O rótulo "Tipo:" saiu.** Ele era redundante ao lado de um selo que o jogo inteiro já usa pra
  tipo — hoje se lê só "SOMBRIO".
- **O selo fica EMBAIXO do nome do golpe, em linha própria.** Ao lado dele, a posição do selo
  dançava de card pra card: era empurrado pra longe quando o nome era comprido ("Deslizamento de
  Rochas") e colava no nome quando era curto — e é justamente entre dois cards que o olho compara.
- **O sprite do cabeçalho fica SOLTO, sem ladrilho atrás.** Ele chegou a ter um quadrado cinza
  claro de fundo e saiu: o sprite já é uma silhueta recortada sobre o creme da caixa, e o ladrilho
  só acrescentava uma borda que se lia como moldura de imagem faltando.
- **A frase não é negrito; só o NOME do pokémon é.** Ela inteira em 700 competia com o cartão logo
  abaixo, que é onde a informação está.
- **O "Nível N" saiu dos cards da captura.** Ele dizia em que nível a espécie ensina aquele golpe:
  informação de tabela, e que não ajuda a escolher entre golpes que ele JÁ tem disponíveis.
- **O texto da captura virou instrução**, não explicação de mecânica: era *"Ele já aprendeu 4
  golpes até o nível 24, mas só leva 2. Na batalha ele usa sempre o que tirar mais dano dos dois"*
  e hoje é *"Escolha 2 para permanecer com Qwilfish, o resto será esquecido"*. O que o jogador
  precisa saber ali é o que fazer e o que ele perde, não como o motor escolhe.
- **Saiu o `linhaDeGolpe`**, que era o formato antigo: as três telas usam o cartão, e uma função
  de apresentação sem chamador é exatamente o tipo de coisa que fica anos no arquivo.

### CADA TAPA SORTEAVA UM GOLPE NOVO (13/09/2026) — e o log nomeava tudo errado

Reportado com print: *"a Clefairy usou metronome porém atacou com Raio Solar 3x, depois com Canhão
de Choque 4x, esses ataques não são assim de repetir"*. E tinha razão duas vezes.

- **⚠️ ERA DEFEITO DE MOTOR, não só de log.** O `golpesDaTroca` lê o número de tapas do PRIMEIRO
  golpe e depois chama o `calcDamage` de novo pra cada tapa — e pra quem **sorteia golpe a cada
  ataque** (o Metrônomo) cada tapa sorteava um golpe NOVO. Um Tapa Duplo de 3 virava **Tapa Duplo +
  Rapidez + Mega Dreno**, cada tapa com o poder do que tinha caído, e o diário gravava o ÚLTIMO
  deles como o golpe da linha. Na tela isso saía como "Rapidez 3x", "Raio Solar 3x", "Canhão de
  Choque 4x" — golpes que não são de vários tapas.
  Hoje os tapas seguintes repetem o golpe do primeiro (`op.golpeFixo`), e o ajudante
  `golpeComoEscolhido` reusa o `melhorAtaque` com uma lista de UM item: refazer a conta à mão ali
  seria uma segunda fonte de verdade pro dano.
- **⚠️ E O WRAPPER `calcDamage` DO CLIENTE ENGOLIA O 4º ARGUMENTO.** A primeira versão do conserto
  passava o golpe fixo e **ele nunca chegava no motor** — o sintoma ficou idêntico ao defeito. O
  wrapper existe porque o motor legado está comentado ali do lado; ele tinha três parâmetros e o
  `op` nasceu depois. O teste **lê o código** pra cobrar o repasse.
- **O GOLPE PASSOU A VIAJAR POR LINHA** (`mv` no diário). O log nomeava TODA linha de um lado com o
  golpe do MATCHUP — o último usado —, o que é falso pra quem troca de golpe no confronto. Log
  gravado antes do campo cai no golpe do matchup, como sempre saiu.
- **E O TAPA E O NOME VÊM DO MESMO GOLPE REAL na reconstrução.** O `expandirTapas` lia só as
  CONTAGENS de tapa e as aplicava em ordem nos golpes inventados, enquanto o nome vinha de outro
  lugar: era ele quem casava o tapa de um golpe com o nome de outro. Hoje cada golpe real entra na
  fila inteiro — quantos tapas, QUAL golpe e se foi Metrônomo — e o inventado recebe os três juntos.

**O PREÇO MEDIDO, e ele é grande pras duas que tinham Tapa Duplo:**

| 1x1 contra um painel de 8 | antes | depois | |
|---|---|---|---|
| **Clefable Lv.50** | 55,0% | **38,7%** | **−16,3** |
| **Clefairy Lv.40** | 22,3% | **15,1%** | **−7,2** |
| Togetic Lv.40 | 37,8% | 37,8% | 0,0 |
| Togepi Lv.30 | 17,8% | 17,3% | −0,4 |
| Cleffa Lv.20 | 31,3% | 30,9% | −0,4 |

Faz sentido e é a assinatura do defeito: **só a Clefairy e a Clefable têm golpe de vários tapas**
(o Tapa Duplo), e eram elas que ganhavam até **cinco sorteios do Metrônomo num ataque só** — cada
tapa podendo cair num Hiper Raio. As outras três não têm multi-tapa e não se movem.
⚠️ **Isso reinterpreta um número deste arquivo:** os "+49,7 pontos" que a seção do Metrônomo
registra pra Clefable foram medidos COM o defeito. O ganho real da mecânica é menor.

- **CONFERIDO QUE NÃO ENCOSTOU EM MAIS NADA, por impressão:** um time SEM espécie de Metrônomo dá o
  **MESMO hash** antes e depois, em 600 batalhas semeadas; com Metrônomo no time o hash muda, como
  tem que mudar. O sorteio deixou de rodar uma vez por tapa, então a semente anda diferente — e só
  ali.
- **A FRASE PEDIDA** (*"Togepi usou METRONOME(selo) e atacou com RAIO SOLAR(selo)"*) sai na linha de
  status da batalha exatamente assim, com os dois selos. **No LOG ela muda a linha inteira**: a
  forma da casa é "X atacou Y com GOLPE", e enfiar o Metrônomo ali dava "atacou Y com Metrônomo e
  atacou com Raio Solar" — dois "atacou" na mesma frase. Lá ela vira *"Togepi usou Metrônomo e
  atacou Machop com Raio Solar e tirou −98 de HP"*.
- **⚠️ ELA SÓ SAI QUANDO O SORTEADO GANHOU A DISPUTA** (`mt`). Desde 10/09/2026 o Metrônomo DISPUTA
  com os golpes próprios; quando o próprio vence, não houve Metrônomo naquele ataque e anunciá-lo
  seria mentira. E o crédito não vale quando o sorteado É um dos próprios: ali ele teria sido usado
  de qualquer jeito. Medido: **10.216 de 10.216** golpes próprios saem sem a frase.
- **E NA JORNADA NÃO MOVE NADA: 56,00% contra 55,98%, −0,02 ponto, 0,0σ** (6 blocos de 1.500 de
  cada lado, 9.000 no total), com 3 de 6 blocos pra cada lado. Faz sentido: são 5 espécies em 250,
  e elas aparecem nos dois lados da luta. O que muda de verdade é a força DELAS, na tabela acima.
- `tools/test-especiais.js` tranca o par: nenhum golpe troca de golpe no meio dos tapas, nenhum selo
  `Nx` em golpe que não é de vários tapas (na TELA, que é onde o defeito aparecia), o wrapper
  repassando o `op`, os dois motores fixando o golpe, e as duas frases.

### A CONFUSÃO: O ADVERSÁRIO SE ACERTA (10/09/2026)

Pedida assim: *"os pokemons que possuem o ataque confusão têm 10% de chance de deixar o adversário
confuso. Esse evento ocorre logo no início da partida. Caso dê positivo, o adversário ataca ele
mesmo (fazer o cálculo como se fosse um espelho atacando ele, mesmo pokémon, com mesmo level,
stats, e poder do ataque) e após isso acontecer, faça a mecânica trabalhar como se estivesse
começando uma nova luta"*. É o **oitavo golpe especial**, ao lado do sono, da autodestruição, do
Metrônomo, do Disable, do Recuperar, da drenagem e da fúria.

- **É ABERTURA, não resolve o confronto** (`continue`, como o Recuperar, a anulação, a drenagem e a
  fúria). Só a autodestruição e o sono resolvem. A luta acontece inteira depois — que é o pedido ao
  pé da letra.
- **NÃO MATA: piso de 1 de HP**, a mesma regra da drenagem. Um efeito de abertura que resolvesse o
  confronto sozinho seria um confronto sem um único golpe na tela, e o pedido diz que a luta vem
  DEPOIS. Medido: 60 de 60 confrontos com confusão têm luta depois dela.
- **⚠️ ONZE GOLPES CONFUNDEM, não só a Confusão — e são 82 espécies, não 23.** A primeira versão só
  olhou o golpe `confusion` e foi reportada na hora: *"alguns pokémons também possuem confusão que
  você não colocou, mas porque o nome é outro, como o Zubat, Tentacool, Magnemite, que possuem
  Supersonic"*. Os onze da Gen 3 que confundem o ALVO:

  | | golpes |
  |---|---|
  | **status** | Supersom (21 espécies), Raio Confuso (14), Bravata (7), Beijo Doce (6), Bajulação (4) |
  | **de dano** | Confusão (20), Psicoraio (4), Soco Dinâmico (3), Feixe de Sinal, Pulso de Água, Soco Tonto (1 cada) |

- **FICAM DE FORA o Outrage, o Petal Dance e o Thrash**, e isso é decisão, não esquecimento: eles
  confundem o **PRÓPRIO USUÁRIO** no fim da sequência, que é outro efeito. O **Teeter Dance** não
  existe no aprendizado por nível da base.
- **CADA ESPÉCIE GUARDA O NOME DO GOLPE DELA**, como o `SONIFEROS` — sem isso o Zubat confundiria
  com "Confusão" e quem conhece o jogo notaria na hora, que é exatamente o relato. Quando ela
  aprende mais de um, fica com o que aprende **MAIS CEDO**: é o que ela carrega pela maior parte da
  vida. E cada nome tem o **tipo** dele no `TIPO_DO_ESPECIAL`, então o selo do Zubat sai no cinza do
  Normal e o do Misdreavus no roxo do Fantasma.
  **A lista saiu da base por script, não foi escrita à mão.**
- **O MEWTWO aprende Confusão no nível 1 e ficou de fora**: o `tentarGolpeEspecial` corta o bloco
  inteiro quando QUALQUER um dos dois é Mew ou Mewtwo, então a entrada seria letra morta — o mesmo
  motivo que já o tirou do Disable e do Recuperar. (São 83 na base, 82 aqui.)
- **ELA VEM POR ÚLTIMO no sorteio**, e isso é de propósito: acrescentar um efeito no FIM da fila não
  dilui nenhum dos que já estavam medidos — quem cai na chance composta é ela. Um Alakazam (Disable
  + Recuperar + Confusão) confunde em 0,9 × 0,9 × 10% = **8,1%**.
- **O DANO É SEM TIPO** (`op.semTipo` do `calcDamage`), como no jogo oficial. Nem multiplicador de
  tipo, nem STAB, nem o redutor de subtipo — o que sobra do espelho é o que o pedido descreve:
  mesmo nível, mesmos atributos e o poder do golpe dele.
  **NASCEU COM TIPO e durou uma versão.** O espelho aplicava a tabela contra ELE MESMO, e Fantasma
  contra Fantasma é **2×**: um **Haunter tirava 299 dos próprios 300 de HP**. Medido na troca:

  | | com tipo | sem tipo |
  |---|---|---|
  | média | 35,0% da própria vida | **30,0%** |
  | deixa com metade ou menos | 19,1% | **12,3%** |
  | deixa em 1 de HP | 3,8% | **1,6%** |
  | o Haunter | 96% | **69%** |

- **⚠️ A CAUDA QUE SOBRA É DE ATRIBUTO, e ela é o certo:** o espelho é ELE MESMO, então quem é frágil
  e forte se arrebenta e quem é duro mal se arranha. Medido no nível 45: **Haunter 85%** (ataque 50,
  defesa 45), Gengar 62%, Alakazam 54% — e no outro extremo **Shuckle 3%** (defesa 230) e Chansey
  15%. Não há o que consertar aí: é a mesma conta que decide todo golpe do jogo.
- **E SEM CRÍTICO** (`op.semCritico`), também como no jogo oficial, e a pedido. Medido antes de
  tirar: **43% dos golpes que deixavam o confuso em 1 de HP eram críticos** — e o crítico dobra o
  dano **sem selo nenhum** na linha da confusão (o campo `c` do registro vai zerado), que é a mesma
  classe de defeito dos "dois golpes impossíveis" da reconstrução.
  **O RNG É CONSUMIDO DO MESMO JEITO**: a opção anula o resultado, não a chamada. Os dois motores
  têm que ler a mesma quantidade de números da mesma semente, senão a batalha diverge do 2º golpe
  em diante. O teste prova isso pelo lado do resultado: o golpe NÃO crítico dá exatamente o mesmo
  número com e sem a opção (1.860 de 1.860).
- **O `q` DO REGISTRO É DE QUEM CONFUNDIU, não de quem apanhou.** É a convenção do diário (o `q` do
  sono também é de quem usou o golpe), e é ela que faz a animação mover a barra do lado certo: o
  passo comum inverte o `q` pra achar quem APANHA. Trocar isso move a barra errada, e o defeito não
  aparece como erro — aparece como o pokémon errado perdendo vida.
- **A CÓPIA DO ATACANTE NÃO É FIRULA.** O `calcDamageNew` **escreve** `lastMove`, `lastMoveType` e
  `lastCrit` no atacante, e o atacante aqui é o próprio alvo. Sem a cópia, o golpe que o pokémon usa
  na luta seguinte sairia trocado no log. O teste cobra isso diretamente.
  A cópia também zera o `_anulado`: a anulação é contra o OPONENTE, e o espelho é ele mesmo.
- **⚠️ O SERVIDOR CHAMA A FUNÇÃO DE OUTRO NOME** — `calcDamage`, sem o `New`. Copiar o bloco do
  cliente pro servidor derrubou a suíte com `ReferenceError`. É a mesma lição do `brockTeam` ×
  `enemyTeam` que a fúria já tinha custado: ao copiar entre os dois motores, conferir os NOMES.
- **A FRASE DO LOG NOMEIA OS DOIS GOLPES**: o que CONFUNDIU (por espécie) e o que ele usou EM SI,
  que é o que explica o número — *"💫 Zubat deixou Machop confuso com Supersom, e ele se acertou com
  Vingança"*. No aviso do meio da batalha ela sai curta, sem golpe nenhum, como a do sono: ali se lê
  em um segundo. O jogador está olhando pra uma barra que desce sem ninguém ter atacado, e o que ele
  precisa saber é de quem foi o golpe: dele mesmo.
  Ela vale **2 passos** no `passosDaAbertura`, como a drenagem e a fúria: a frase tem que sobreviver
  ao movimento que ela anuncia.
- **O SELO É 💫**, e o TIPO é o do golpe de cada espécie (`TIPO_DO_ESPECIAL`): Normal no Supersom,
  Fantasma no Raio Confuso, Sombrio na Bajulação, Lutador no Soco Dinâmico.
- **Medido: ela sai em 5,7% dos confrontos** e em **20,6% das batalhas 3x3** — era 1,6% e 6,4%
  quando a lista tinha só as 23 da Confusão. Com o dano sem tipo e sem crítico o golpe do espelho
  ficou em **25,4% da própria vida** em média, e o "deixa em 1 de HP" caiu de 3,8% para **0,1%**.
- **O PREÇO NA JORNADA: dentro do ruído.** 69,98% contra 69,32% de conclusão — **+0,66 ponto, 1,2σ**
  (10 blocos de 1.500 jornadas de cada lado, 15.000 de cada), já com as 82 espécies e os onze golpes.
  Faz sentido mesmo saindo em 5,7% dos confrontos: ela cai dos DOIS lados — um terço do bestiário
  confunde, e os líderes também. É a mesma conclusão da drenagem e do sono.
  (Com as 23 da primeira versão dava +0,10 ponto, 0,2σ.)
- **QUATRO CONTAS DE TESTE ESTAVAM INCOMPLETAS, e a confusão só as tornou frequentes.** Toda conta
  de "quanto ele perdeu de vida" somava os golpes do adversário — e existem duas formas de perder HP
  que não são golpe do outro lado: o **dano da drenagem** (`absorbdano`) e agora a confusão. As duas
  têm a MESMA forma (o `q` é de quem CAUSOU, e o HP some do lado OPOSTO), e as quatro contas passaram
  a descontar as duas juntas. **O buraco do `absorbdano` era anterior** e passava porque a
  combinação era rara; com 23 espécies confundindo, ele apareceu em ~1 rodada em 3.
- **E DUAS TRAVAS DE ORDEM tiveram que aprender o que já era regra**: o par do moribundo agora
  tolera um revide de **vários tapas** (é UM golpe que ocupa N passos — apareceu quando a Clefairy
  entrou no Metrônomo e passou a sortear Tapa Duplo), e a trava do sono aceita o **sono DUPLO**
  (quando os dois se dormem ninguém ganha troca livre) e o **revide na frente da linha do sono**.

### A RECONSTRUÇÃO MOSTRAVA DOIS GOLPES IMPOSSÍVEIS (10/09/2026)

Relatado pelo dev e por jogadores: *"às vezes um pokémon tira só uma fração de HP do inimigo,
depois apanha, e depois termina de matar com o MESMO golpe tirando muito mais dano e sem crítico"*.

- **NÃO ERA SENSAÇÃO: os números eram impossíveis mesmo.** As linhas 1 e 3 da reconstrução são o
  MESMO pokémon, com o MESMO golpe, contra o MESMO alvo. A única coisa que faz dois golpes assim
  diferirem é o sorteio de `0,85 + rng*0,15` do `calcDamageNew`: no máximo **1,18×** (1,00/0,85).
  Fora o crítico, que a linha anuncia com selo próprio.
- **A CAUSA ERA A FAIXA DA DIVISÃO**, o `firstHitPct`, que ia de **30% a 70%** do dano total — ou seja,
  até **2,33×** entre os dois golpes. Medido em 5.009 confrontos reconstruídos:

  | razão entre o 1º e o 3º golpe | |
  |---|---|
  | até 1,18× (o que um golpe real varia) | 21,7% |
  | 1,18× a 1,5× | 29,5% |
  | 1,5× a 2× | 28,6% |
  | mais de 2× | 20,2% |

  **78,1% ficavam fora do que a fórmula consegue produzir**, média 1,57×, pior 2,36× (um Golbat
  tirando 137 e depois 58 do mesmo Onix).
- **HOJE A FAIXA É 46% a 54%**, teto de razão **1,17×** — dentro da banda da fórmula por construção.
  Medido depois: **0,7% → 0%** fora da banda, média 1,09×, pior 1,26×.
  **A variação continua existindo** (nenhuma luta divide igual a outra, e a semente continua saindo
  do próprio confronto pra o log e a animação concordarem); ela só deixou de sair da banda do que o
  motor sabe fazer.
- **⚠️ O QUE ISSO NÃO CONSERTA, e está medido:** a linha do PERDEDOR continua sendo a soma dos golpes
  dele — **2,44× um golpe real**, contra **1,23×** das duas linhas do vencedor. Ela fica porque é UMA
  linha só, e ali não há com o que comparar na tela: o que denunciava era o PAR do vencedor.
  Se um dia incomodar, a saída medida é declarar a multiplicidade (reusar o selo `Nx` dos golpes de
  vários tapas: *"Golbat atacou Onix com Mordida 3x e tirou −195"*), e o preço é a animação crescer
  — o confronto reconstruído tem **4,9 golpes reais** em média contra as 4 linhas de hoje, e cada
  golpe animado leva a pausa de 1s do nome.
- **O SONO É A EXCEÇÃO, e ela é estrutural.** Nele as trocas livres saem REAIS (uma linha cada) e só
  o RESTO é reconstruído, então um golpe de verdade fica ao lado de um somado e a razão não tem por
  que caber na banda. Medido: **3 casos em 3.128 (0,1%), todos com sono**. O teste os exclui e cobra
  **ZERO** no resto — tolerar 2% esconderia uma faixa reaberta.
- **O MOTOR NÃO MUDA EM UM PONTO**, e isso foi conferido por impressão: o mesmo build com a faixa
  velha e com a nova dá o MESMO hash em 6.188 confrontos. A reconstrução só é chamada pelo
  `sequenciaDoConfronto`, que é apresentação — e o teste cobra que ela não exista no servidor.

### O METRÔNOMO SORTEIA E DEPOIS ESCOLHE (10/09/2026)

Pedido assim: *"hoje a Togepi e a Cleffa só utilizam metronome, mesmo tendo outros ataques em seu
moveset ... após o level 21 ele aprende o Poder Ancestral ... sempre vai sortear um ataque para o
metronome, assim como é hoje, e então vai fazer o cálculo do que tira mais dano, esse poder sorteado
pelo metronome ou o Poder Ancestral? E vai usar na batalha o que tirar mais dano"*.

- **A PREMISSA ESTAVA CERTA, e o defeito era grande:** o `tipoDoGolpe` — o caminho do DANO — dava
  curto-circuito nas espécies do Metrônomo. Elas atacavam com um **TIPO sorteado, poder implícito de
  60**, e nunca chegavam no `melhorAtaque`. Ou seja, o Poder Ancestral do Togepi (nível 21) e a
  Folha Mágica da Cleffa (17) **não valiam um ponto de dano em lugar nenhum**. Era tão verdade que
  o `ataquesDisponiveis` devolvia lista VAZIA pra elas de propósito, e a ficha da Pokédex trazia um
  aviso dizendo "na batalha ele usa o Metrônomo, não estes golpes".
- **AGORA O SORTEIO É DE GOLPE, não de tipo**, e ele entra na MESMA disputa dos golpes escolhidos:
  sai o que tirar mais dano contra quem está na frente. Quem ainda não tem golpe próprio (o Togepi
  antes do 21) continua só no Metrônomo, exatamente como era.
  **É isso que mantém a aposta de pé:** o sorteio pode entregar um Hiper Raio (150) ou uma Constrição
  (10); o que mudou é que ele nunca fica ABAIXO do que a espécie já tem.
- **REUSA O `melhorAtaque` em vez de repetir a conta.** É ele que sabe do STAB, do subtipo, do golpe
  de vários tapas, da anulação e do golpe teimoso. Duas contas em paralelo divergiriam no primeiro
  ajuste — foi o que já aconteceu entre a escolha e o dano quando o `EXPOENTE_TIPO` era um valor em
  cada lugar. A chamada monta uma cópia rasa do atacante com `ataques = próprios + sorteado`.
- **⚠️ O BOLO DO SORTEIO VAI ORDENADO** (`POOL_METRONOMO`), e isso não é estética: as tabelas de
  golpes dos dois arquivos estão escritas em ordens diferentes, e sortear por índice numa lista não
  ordenada faria o cliente e o servidor tirarem golpes DIFERENTES com a mesma semente — a mesma
  batalha terminando diferente dos dois lados. `tools/test-especiais.js` compara o bolo e cobra 500
  sorteios idênticos com a mesma semente.
  São os **156 golpes de dano** da tabela — eram 155 até 13/09/2026, quando o `cut` entrou pra o
  HM01 ter o que ensinar (ver a seção dos HMs): o bolo é derivado do `GOLPES`, então acrescentar um
  golpe ao jogo desloca a semente do sorteio. Autodestruição e Explosão não estão nela (nunca
  estiveram) e é o certo: elas JÁ SÃO o efeito de 10% do Metrônomo, com o custo de cair junto.
- **A LISTA HOJE SÃO 6** — Cleffa, Clefairy, Clefable, Mew, Togepi e Togetic. Ela foi a 7 em
  10/09/2026 (entraram Snorlax, Clefairy e Clefable, que aprendem Metrônomo por nível no original e
  tinham ficado de fora por serem "espécies comuns em time de jogador e de líder") e voltou a 6 em
  **11/09/2026, quando o SNORLAX saiu a pedido** — ver o item próprio dele, mais abaixo.
  **⚠️ O SNUBBULL SAIU**, e ele era um dos 4 originais. É consistente com o dado (ele não aprende
  Metrônomo por nível na Gen 3 — está na tabela de divergências desta seção), mas **custa a ele**:
  medido 1x1 contra um painel de 8, ele vai de **13,1% pra 3,3%** de vitória. Ele passou a lutar com
  o moveset dele (Mordida, Lambida, Investida, Fúria), que é pior que um sorteio com 30% de efeito.
  Se a intenção era MANTER o Snubbull, é uma linha no `METRONOMO` — e a régua está aqui.
- **⚠️ O SNORLAX SAIU DA LISTA EM 11/09/2026, a pedido — e esta seção já apontava esse lugar como a
  alavanca** ("se incomodar, os lugares de mexer são a LISTA (tirar Snorlax, que é a mais comum em
  time de jogador)"). Ele também **não aprende Metrônomo por nível na Gen 3** — estava aqui por
  pedido, exatamente como o Snubbull esteve —, então sair é o que o dado diz.
  **ELE É O CASO OPOSTO AO DA CLEFABLE, e é isso que faz a remoção ser barata:** o único golpe de
  dano por nível da Clefable é o Tapa Duplo (poder 15), e sem o sorteio ela luta a vida inteira com
  ele; o Snorlax leva **Hiper Raio (150), Golpe de Corpo (85) e Cabeçada (70)**. Ele nunca dependeu
  do Metrônomo pra ter o que bater — o que ele perde é o **efeito**, não o dano.
  **CUSTA A ELE, e o número é por nível** (1x1 contra um painel de 8, mesmo nível dos dois lados,
  4.800 batalhas em cada célula):

  | | com Metrônomo | sem | |
  |---|---|---|---|
  | Snorlax Lv.30 | 82,2% | 75,3% | **−6,9** (9,6σ) |
  | Snorlax Lv.45 | 74,6% | 62,6% | **−12,1** (16,7σ) |
  | Snorlax Lv.60 | 75,0% | 72,0% | −3,0 (4,2σ) |
  | Snorlax Lv.80 | 75,9% | 72,9% | −3,1 (4,2σ) |

  **O buraco é no Lv.45, e ele tem causa:** ali o Snorlax já tem o Golpe de Corpo (33) mas ainda
  **não tem o Hiper Raio (51)** — é a janela em que o próprio arsenal dele é mais fraco, e é
  justamente onde o sorteio mais valia. Depois do 51 ele tem o golpe mais forte da tabela e o
  Metrônomo raramente ganha dele, que é por que o custo cai pela metade no Lv.60.
  **E O QUE ELE PERDE MESMO É O EFEITO**: medido em 2.000 confrontos de um Snorlax Lv.60, ele saía
  com **231 explosões, 193 sonos e 142 anulações** (28% dos confrontos com algum efeito) e agora sai
  com **zero**. Ele deixou de ter especial nenhum — a ficha da Pokédex dele fica sem a seção.
- **O CUSTO NA JORNADA: nada. 69,38% contra 69,70%**, **−0,32 ponto, 0,5σ** (10 blocos de 1.500
  jornadas de cada lado, **15.000 de cada**, desvio tirado de ENTRE os blocos). Não dá pra
  distinguir de zero.
  **E A FORMA TAMBÉM NÃO SE MOVE** — 2 blocos de 2.000 de cada lado: 1º ginásio 347→322, 5º 200→179,
  6º 248→257, 8º 417→426. Nenhum passa de 1,1σ, e nenhum tem direção consistente entre os blocos.
  (Uma primeira amostra ÚNICA de 2.500 tinha dado 180→226 no 1º ginásio, o que pareceria efeito
  real: é impossível por mecanismo — o Snorlax só mora em rota de trecho 7 e 8 —, e em blocos a
  diferença inverteu de sinal. **Amostra única não é medição neste simulador**, que é o que este
  arquivo já registra sobre o σ binomial.)
- **⚠️ MAS ESTA MUDANÇA É DE UM LADO SÓ, e isso a separa de todas as outras desta série.** Conferido
  nos 16 ginásios das duas regiões: **nenhum líder tem Snorlax no time**, e ele não está no
  `WILD_POOL_LEG8`. Ou seja, ao contrário da drenagem, do sono e da Fúria do Dragão — que caem dos
  dois lados e por isso somem na conta —, esta só tira poder do JOGADOR. A jornada não se move
  mesmo assim porque o Snorlax só aparece em **2 rotas, nos trechos 7 e 8** (Mansão Pokémon e
  Victory Road): quando ele entra no time, a jornada está quase acabando.
  **Onde ele continua valendo é na Torre**, que sorteia evoluções finais pro time dos NPCs — lá o
  Snorlax do adversário também perdeu o Metrônomo.
- **O MEW ENTROU, e ele é o único da lista fora do `SPECIES`.** Ele é o chefe da raide, e o
  `bossInstance` do servidor carimba `speciesId: 'mew'` — então a entrada NÃO é letra morta: é por
  ela que o Mew da raide sorteia o golpe.
  **Ele continua imune ao bloco de EFEITOS** (explosão, sono, anulação): o `ehImuneAEspecial` corta
  no `tentarGolpeEspecial`, e o golpe sorteado sai por outro caminho (o `tipoDoGolpe`, no dano). Um
  Mew que explodisse acabaria com a raide da semana num golpe. Conferido: **0 efeitos em 2.000
  tentativas** com o rng travado em 0,01.
  **E A RAIDE NÃO SE MOVE, medido: 651 → 646 ataques** pra derrubar (time nível 70). O Mew perde
  58% do dano relativo (ele troca o Psíquico com STAB por um golpe qualquer), mas isso não muda
  nada: com o teto de dano desligado ele derruba **cada pokémon do time em UMA troca** dos dois
  jeitos, então cada ataque continua entregando os mesmos 6 golpes.
- **O QUE SAI NA PRÁTICA, medido num Togepi Lv.25 (Poder Ancestral, Pedra):**

  | contra | Poder Ancestral sai em |
  |---|---|
  | Charizard (Fogo/Voador — Pedra é 4×) | **92,2%** |
  | Geodude (Pedra/Terra — Pedra é 0,5×) | 21,9% |
  | Machamp (Lutador — Pedra é 1×) | 17,1% |

  É exatamente o que a mecânica promete: contra quem o golpe próprio arrebenta ele sai quase sempre,
  e contra quem ele é ruim o sorteado assume.
- **O PREÇO POR ESPÉCIE É GRANDE, e é o número que importa** (1x1 contra um painel de 8, mesmo nível):

  | | antes | agora | |
  |---|---|---|---|
  | Clefable Lv.50 | 4,2% | **53,9%** | +49,7 |
  | Togetic Lv.40 | 17,9% | **55,4%** | +37,5 |
  | Clefairy Lv.40 | 1,3% | **29,2%** | +27,9 |
  | ~~Snorlax Lv.60~~ | 62,5% | 74,2% | +11,7 |
  | Cleffa Lv.20 | 23,4% | 34,3% | +10,9 |
  | Togepi Lv.30 | 18,4% | 20,4% | +2,0 |
  | **Snubbull Lv.40** | 13,1% | **3,3%** | **−9,8** |

  A Clefairy e a Clefable eram os casos mais absurdos: o único golpe de dano delas por nível é o
  **Tapa Duplo, poder 15**, e elas lutavam a vida inteira com ele. O Togepi quase não se move porque
  o Poder Ancestral (60, sem STAB) raramente ganha do sorteio.
  **A LINHA DO SNORLAX ESTÁ RISCADA porque ele SAIU DA LISTA em 11/09/2026** (a pedido) — ela fica
  como história do que a mecânica lhe deu, não do que ele tem hoje. A medição de quanto a saída lhe
  custou é outra, e está no item dele acima.
- **O CUSTO DE ANIMAÇÃO É PEQUENO E VAI NOS DOIS SENTIDOS.** O sorteio pode cair num golpe de vários
  tapas, e aí o confronto ganha passos; mas ele também acaba mais rápido quando o golpe é forte.
  Medido: Togepi **2,59 → 2,94** passos por confronto, Snorlax **2,52 → 2,33**, Clefable
  **5,03 → 4,22** (ela era a pior de todas, presa num Tapa Duplo de 2 a 5 golpes).
  (A linha do Snorlax é HISTÓRIA: ele saiu da lista em 11/09/2026 e hoje não sorteia nada.)
  **As LINHAS DE LOG não se movem** (2,59 → 2,57 no Togepi): o log soma os tapas numa linha só.
- **DUAS TRAVAS CONTAVAM PASSO DE ANIMAÇÃO ONDE A REGRA FALA DE LINHA DE LOG**, e o Metrônomo tornou
  isso visível: com 7 espécies sorteando golpe a cada ataque, um Míssil Agulha de 5 tapas passou a
  cair em qualquer confronto. As duas passaram a contar linha (`!(g.t > 1)`), que é a MESMA regra
  que o `TETO_GOLPES` já usa. O que a casa promete — "a luta cabe em duas ou três linhas" — continua
  valendo e continua sendo cobrado.
- **E TRÊS FIXTURES DE TESTE TIVERAM QUE TROCAR DE DONO**: a Clefairy era o dono declarado do Tapa
  Duplo e a Clefable era quem media o poder cru. As duas entraram no Metrônomo, e quem sorteia golpe
  a cada ataque nem sempre usa o que está em `ataques` — o teste passaria a medir outra coisa.
  Viraram **Jigglypuff**, que aprende os mesmos golpes e não sorteia nada.
- **SAIU O AVISO DA FICHA** ("na batalha ele usa o Metrônomo, não estes golpes") e **saiu a chance de
  30% do selo do Metrônomo**, os dois a pedido. O 30% era a chance de o sorteio cair num dos três
  efeitos; dizer só isso fazia parecer que nos outros 70% ele não acontecia. Hoje o especial pode vir
  **sem chance declarada** (`chance: null`), e a ficha desenha só o nome — os outros continuam
  dizendo a chance deles.
- **A FILEIRA DO TIME MOSTRA OS DOIS**: os golpes escolhidos MAIS o selo tracejado do Metrônomo.
  Antes ele aparecia NO LUGAR deles, porque ali eles não valiam nada.
- **O PREÇO NA JORNADA: +1,61 ponto de conclusão** (69,71% contra 68,10%), 10 blocos de 1.500
  jornadas de cada lado — **15.000 de cada**, 2,6σ pelo desvio ENTRE BLOCOS. Fora do ruído, e para
  o lado fácil, que é o esperado: seis das sete espécies ficaram mais fortes e elas aparecem nos
  dois lados da luta, mas o jogador escolhe quem leva e os líderes não.
  Só +1,6 apesar dos +50 pontos da Clefable porque são **7 espécies em 250** — o jogador raramente
  tem uma no time.
  **ESSA ALAVANCA FOI PUXADA em 11/09/2026**: o Snorlax saiu da lista, a pedido, e a conclusão da
  jornada voltou 0,32 ponto (0,5σ, ruído — ver o item dele acima). A outra que sobra, se um dia
  precisar, é fazer o sorteado disputar com um REDUTOR em vez de entrar no poder cheio.
- **O `usaGolpesEscolhidos` MORREU.** Ele existia só pra devolver lista vazia às espécies do
  Metrônomo; com elas escolhendo golpe como todo mundo, ele não tinha o que responder. As "doze que
  não escolhem" voltaram a ser **uma**: o Ditto.

### A FÚRIA É UMA PASSIVA (10/09/2026)

Pedida assim: *"todos os pokemons que possuem o ataque de furia, ao iniciar uma batalha, tem 30% de
ativar furia, e quando isso acontece, ele ganha +10 de atributo em todos os stats ... exibir a
mensagem que o pokemon entrou em Furia e exibir crescendo a barra de hp dele ... caso ele consiga
usar a furia em 2 confrontos seguidos, continuar acumulando"*. Ela é o **sétimo golpe especial**, ao
lado do sono, da autodestruição, do Metrônomo, do Disable, do Recuperar e da drenagem — e a de
maior chance do bloco: **30% por confronto**, empatada com o Metrônomo (que rende efeito em 3 das
10 vezes) e o dobro da autodestruição.

- **A LISTA são as 19 espécies que aprendem Fúria por NÍVEL**, a mesma regra das outras seis listas:
  a linha do Charmander, Onix e Steelix, Primeape, Tauros, Kangaskhan, a linha do Totodile,
  Dunsparce, Doduo e Dodrio, Cubone e Marowak, Beedrill, Snubbull e Granbull.
- **ELA VEM PRIMEIRO NO SORTEIO, antes até do Metrônomo**, e isso é decisão: é uma ABERTURA que não
  resolve o confronto, e deixá-la pra depois faria o **Snubbull** — o único dos 19 que tem outro
  especial — nunca entrar em fúria, porque o Metrônomo corta o sorteio ali mesmo. O preço é o de
  sempre nas chances compostas: o Metrônomo dele passa a sair 30% menos.
- **É `continue`, não `return true`**: como o Recuperar, a anulação e a drenagem, a luta acontece
  inteira — com ele maior. Só a autodestruição e o sono resolvem o confronto.
- **ACUMULA, e o acúmulo é POR BATALHA.** Entrar em fúria em dois confrontos seguidos vale +20, e
  assim por diante — é o que faz dela um prêmio de quem fica de pé. Zera no começo da batalha
  seguinte, no mesmo lugar em que a marca da autodestruição já zerava.
  Quanto ela acumula de verdade está medido no fim desta seção: no caso favorável (um Tauros que
  enfrenta seis fracos e sobrevive a todos) a segunda entrada aparece em cerca de metade dos
  confrontos com fúria; num 6x6 de verdade, em **21,6%**.
- **O BÔNUS É FLAT E ENTRA POR ÚLTIMO** (`withFuria`), depois de shiny, terreno, especialidade e
  item — que são multiplicadores. Entrando antes, eles o inflariam: +10 num shiny em terreno viraria
  +14, e "+10 de atributo" deixaria de ser 10. É a mesma regra do item de atributo, que está uma
  linha acima na cadeia. Conferido: num shiny em terreno o ganho continua sendo exatamente 10.
- **⚠️ O HP É O ÚNICO DOS SEIS QUE PRECISA DE MÃO, e é aí que mora a armadilha.** Os outros cinco
  são lidos das `effective*` na hora do dano; o **teto de vida é um número GRAVADO na instância**.
  Então a fúria escreve `maxHp` e sobe a vida atual junto — e **devolve os dois no fim da batalha**.
  Sem devolver, um Tauros que entrou em fúria três vezes saía da luta com o teto **+30 pra sempre**,
  e a barra dele na tela de time mudava de tamanho sozinha. Pior: o vazamento **se acumulava pela
  jornada inteira**, e foi ele que fez a primeira medição dar +2,2 pontos — um número que era do
  defeito, não da mecânica.
  A devolução é EXATA: sai o mesmo número que entrou, do teto e da vida. Quem já caiu fica em 0 —
  devolver vida a um pokémon desmaiado o ressuscitaria.
  É o mesmo cuidado que o buff de terreno já tinha (ver "O buff de terreno mexe no TETO de HP").
  `tools/test-especiais.js` cobra as três coisas em 800 pokémon: o acúmulo não sobra na instância, o
  teto volta ao que era, e nunca sobra vida acima do teto.
- **⚠️ E A DEVOLUÇÃO ESCAPAVA PELA DERROTA, até 11/09/2026.** O bloco que devolve o teto vivia solto
  antes do `return` da vitória, e o `return` da DERROTA passava por cima dele — então tudo que este
  item promete valia só quando o jogador ganhava. **Medido: 983 pokémon de 3.000 saíam de uma
  derrota com o teto errado (até +30), contra ZERO nas vitórias**, e como o `_furia` é zerado no
  começo da batalha seguinte o teto inflado deixava de ter de onde ser recalculado — ficava errado
  pra valer, no save e na barra da tela de time.
  Hoje as duas portas chamam a MESMA função (`encerrarBatalha`), e é ela também que solta os
  marcadores de confronto. Ver a seção **O CICLO QUE PERDIA O SAVE**.
- **⚠️ NO ONLINE ELA VAZAVA POR OUTRO CAMINHO, e o conserto lá é outro.** O `battleResolveMatchup`
  grava só o `hp` de volta no estado; o `maxHp` guardado continua o limpo, e o `battleHydrate` do
  confronto seguinte usa esse. Sem aparo, o pokémon reentrava com `hp` ACIMA do teto — barra passando
  de 100% e até +10 de vida de graça por confronto em que ele entrou em fúria e sobreviveu.
  Lá o `encerrarBatalha` **não serve**: o diário daquele confronto já contou a subida da barra, e
  devolver o empréstimo antes de responder faria a soma do log não fechar com o `playerHpAfter`. O
  conserto é aparar o `hp` no teto guardado na hora de gravar.
- **A BARRA SOBE NA TELA, e é isso que o jogador vê.** A entrada no diário vai pelo mesmo caminho da
  cura: `amount` NEGATIVO no passo animado (os laços fazem `hp - amount`), então a barra cresce. A
  frase acompanha esse passo — *"Tauros entrou em fúria e cresceu"*, e **a partir da segunda vez ela
  diz qual é** (*"entrou em fúria pela 2ª vez"*): sem o número, a mesma frase duas vezes seguidas
  pareceria a mesma coisa acontecendo à toa.
  Ela vale **1 passo** no `passosDaAbertura` — mexe UMA barra, como a cura — e cede o lugar ao nome
  do golpe assim que a luta começa. Fora da tabela, a frase valeria pra sempre: foi exatamente o
  defeito que a anulação teve (ver a seção dos passos da abertura).
  Medido: em 60 confrontos com fúria, **60 mostram a frase no passo em que a barra sobe** e 60 viram
  linha no log.
- **O SELO É 😤 e o tipo é Normal** (`TIPO_DO_ESPECIAL`), como o resto do bloco.
- **⚠️ E ELE APARECE NO QUADRO DO LUTADOR desde 14/09/2026** (a pedido: *"coloque um sinal também no
  pokémon que está com Fúria ativa"*), ao lado do 🌟, 🔺, 🎖️ e dos ⚔️🪶 das duas danças — todos saem
  da mesma função (`selosDoConfronto`, que era `selosDaDanca` até a fúria entrar nela).
  **⚠️ MAS ELA É DIFERENTE DAS DANÇAS NUM PONTO QUE IMPORTA: ela ACUMULA por batalha.** Um pokémon
  pode atravessar três confrontos furioso com a marca do diário **só no primeiro** — então o selo
  sai de um CAMPO do matchup (`playerFuria`/`enemyFuria`, o acumulado), e não da marca. Lido do
  diário, ele sumiria justamente nos confrontos em que o bônus é maior. Há caso de teste para
  exatamente isso (a "fúria herdada").
  **O NÚMERO SAI A PARTIR DA SEGUNDA VEZ** (😤2), como a frase do log já faz: sem ele, um Tauros com
  +30 de tudo mostra o mesmo selo de um com +10. Na primeira ele sai limpo.
  Confronto gravado antes do campo existir sai sem selo — log velho não pode sumir.
- **ELA MORA NA FICHA DA POKÉDEX, não no cartão do golpe** — e essa é a diferença que importa: quem
  escolhe golpe não escolhe passiva. O cartão do golpe Fúria **não diz mais nada** (o `obsDoGolpe`
  dela saiu — e desde 15/09/2026 essa função devolve uma LISTA de observações, não uma frase),
  e a ficha da espécie a anuncia junto do sono e da anulação, com a chance.
- **A MECÂNICA ANTERIOR FOI DESFEITA, e vale registrar por quê.** A Fúria nasceu como um golpe que
  ganhava **+6 de poder a cada troca**. Medido: implementada ao pé da letra (crescendo só quando SAI)
  ela **nunca saía** — começa em poder 20 e o motor escolhe pelo dano, então perdia pra qualquer
  alternativa: **0,0%** dos confrontos. Crescendo por troca ela chegava a 28,4%, mas aí custava
  **−22,7 pontos** de vitória contra o golpe que substituía (o empate só vinha lá pelos +30 por
  troca). Como passiva ela deixa de disputar uma vaga de golpe e passa a valer pra quem já tem — que
  é o que a palavra "passiva" promete.
- **O PREÇO NA JORNADA: +1,06 ponto de conclusão** (69,11% contra 68,05%), 12 blocos de 1.500
  jornadas de cada lado — **18.000 de cada**, 2,5σ pelo desvio ENTRE BLOCOS. Fora do ruído, e para
  o lado fácil. Ela **se concentra no 8º ginásio**: os game overs lá vão de **383 para 327** em
  3.000 jornadas, contra ±20 em todos os outros. Faz sentido — é no fim que o time do jogador tem
  mais espécies de Fúria de pé por vários confrontos seguidos, que é quando o acúmulo aparece.
  Só +1 ponto porque **os líderes também têm**: o Onix do Brock, o Steelix da Jasmine, o Charizard
  do rival. Ela cai dos dois lados, como o sono e a drenagem.
- **⚠️ MAS O EFEITO POR BATALHA É GRANDE, e a jornada esconde isso.** Medido num 6x6 com o painel
  CALIBRADO NO EMPATE (as 6 espécies de Fúria nível 60 contra 6 sem Fúria de BST pareado, nível 63,
  onde o controle fica em 46,95%): **84,01% com a fúria contra 46,95% sem — +37 pontos**, 12.000
  batalhas de cada lado. Nenhum item chega perto (a Faixa de Foco é +4,98).
  **O número honesto é a conversão em NÍVEL**, porque esse painel é hipersensível — ali 1 nível vale
  ~17 pontos. Subindo o nível do adversário até reencontrar os 46,95%, a fúria vale **≈2,3 níveis**
  (o empate volta com o inimigo em Lv.65,3). Pra comparar: o shiny (1,20×) vale ~15 níveis e o
  terreno (1,15×), menos. Ou seja, ela fica **abaixo dos buffs de time** e acima da especialidade.
- **O ACÚMULO É MODESTO, e é ele que segura o preço.** Medido em 3.000 batalhas 6x6: **98,1% das
  batalhas têm alguém em fúria**, mas quem entra fica em **1,23 vez em média** — 78,4% param em
  1× (+10), 20,1% chegam a 2× (+20) e só 1,5% a 3× (+30). O maior visto foi 3. Um pokémon precisa
  vencer confrontos seguidos pra acumular, e é isso que faz o teto se cuidar sozinho.
  Se um dia parecer forte demais, os lugares de mexer são a **chance** (`CHANCE_FURIA`) e o
  **bônus** (`FURIA_BONUS`) — e a régua está aqui.
- **OS DOIS MOTORES sobem igual, e a comparação das 300 batalhas cobre isso**: ela sorteia times
  entre as 250 espécies, então a fúria aparece em **93 das 300** — e o teste passou a COBRAR que
  apareça. Sem essa linha, a comparação daria verde sem nunca tocar na mecânica, e atributo que
  diverge faz a mesma batalha terminar diferente no cliente e no servidor.


### O CONGELAMENTO: O PRIMEIRO STATUS POR ATAQUE (16/09/2026)

Pedido assim: *"a qualquer momento da partida que for usado algum ataque que tenha a possibilidade
de congelador, por exemplo: Blizzard, ele vai ter 10% de chance de congelar o adversario, e quando
isso acontecer, o adversario nao consegue atacar, e a cada turno ele tem 20% de descongelar"* — com
o ciclo inteiro escrito passo a passo, e a razão: *"eu decidi te falar o ciclo completo porque a
chance de congelar é por ataque dentro do confronto, e nao somente no inicio ou no fim da batalha
como as habilidades passivas"*.

- **⚠️ E É ISSO QUE O SEPARA DE TUDO QUE VEIO ANTES.** Os onze efeitos do `tentarGolpeEspecial` são
  sorteados **na ABERTURA** e valem **por CONFRONTO** (o marcador `_especialContra`); este é
  sorteado **a cada golpe que sai**, quantas vezes for. É a primeira mecânica do motor em que o
  mesmo pokémon pode ser atingido pelo mesmo efeito **duas vezes no mesmo confronto** — e foi
  justamente isso que desenterrou o defeito do `findIndex` (ver o item próprio, abaixo).
- **SÃO QUATRO GOLPES, 10% cada** (`GOLPES_QUE_CONGELAM`): Soco de Gelo, Raio Congelante, **Nevasca**
  e Pó de Neve. São exatamente os do FireRed.
  **⚠️ E OS OUTROS QUATRO GOLPES DE GELO DA TABELA NÃO CONGELAM, e isso é fiel:** Aurora Beam baixa
  Ataque, Icy Wind baixa Velocidade, Icicle Spear é multi-tapa puro e o Iceball escala. O teste
  varre a tabela por TIPO e cobra que só os quatro estejam na lista — assim um golpe de Gelo novo
  não entra por engano nem fica de fora em silêncio.
- **A CHANCE DE DEGELO É 25%, não os 20% do pedido** — e foi o próprio pedido que decidiu: o ciclo
  de exemplo que veio junto descrevia 25%, e quando perguntei qual valia, a resposta foi *"o do
  exemplo"*. Dá **4,0 turnos de gelo em média** (medido, 3,97 em 20.000 sorteios); 23,5% dos
  congelamentos passam de 5 turnos e o pior visto foi 32.
  **Na prática ele dura muito menos: 1,77 turnos**, porque o confronto acaba antes.
- **⚠️ DEGELAR NÃO CONSOME O TURNO, e isso DIFERE DO JOGO ORIGINAL.** Lá o pokémon degela e perde a
  vez; aqui ele degela **e ataca na mesma troca** — é o pedido ao pé da letra (*"ele consegue se
  descongelar e aparece a frase ... e então ele realiza o ataque normalmente"*), e é o que mantém o
  ciclo legível: a frase do degelo e o golpe dele saem juntos, em vez de mais um turno em branco.
- **O TIPO GELO É IMUNE**, como no original (`podeCongelar`). Quem já caiu e quem já está congelado
  também não congelam — o segundo porque a marca seria sobrescrita e o log passaria a nomear o
  golpe errado.
- **O SORTEIO RODA DEPOIS DE O GOLPE CONECTAR**, nunca antes: um ataque que não saiu não congela, e
  um alvo que CAIU também não.
- **⚠️ O CONGELAMENTO DESTA TROCA PEGA O SEGUNDO NA MESMA TROCA.** É o pedido ao pé da letra — no
  exemplo, o Articuno congela o Dragonite e *"agora o dragonite não conseguiu atacar porque tá
  congelado"*, no mesmo turno. Ele só alcança quem ataca **DEPOIS**: se o congelado for o mais
  rápido, ele já bateu antes de o gelo chegar, e o efeito vale a partir da troca seguinte. É a mesma
  assimetria que o `segundoCaiu` já tem, e ela é a do jogo — quem conecta primeiro leva vantagem.
- **⚠️ O `rng` É O DA BATALHA, e só é lido quando o golpe PODE congelar.** O `tentarCongelar` sai
  antes do `rng()` quando o golpe não está na tabela ou o alvo é imune — lido sempre, ele deslocaria
  a semente de **toda** batalha que não tem golpe de gelo nenhum. É a mesma armadilha que o Remoinho
  quase trouxe, e há trava pras duas saídas antecipadas.
- **A MARCA É SOLTA NO `encerrarBatalha`** (`p._congelado = null`), junto com o `_rolamento` e o
  `_furia`. Ela é um campo da instância e o time vai pro SAVE: sem soltar, um pokémon sairia da
  batalha congelado **pra sempre** — e como o campo começa com `_` (não vai pro Firestore), o save
  nem guardaria o motivo: ele voltaria descongelado no F5 e congelado até lá. É o mesmo vazamento
  que o teto de HP da Fúria teve, e lá ele escapou pela porta da DERROTA por semanas.

**AS TRÊS FRASES, e a ORDEM entre elas é o ciclo:**

| linha | quando sai | frase |
|---|---|---|
| `congelou` | **DEPOIS** do golpe que congelou | *Blissey ficou congelado com NEVASCA!* |
| `gelado` | no lugar do golpe dele | *Blissey não consegue atacar por estar congelado* |
| `degelou` | **ANTES** do golpe dele | *Blissey não está mais congelado!* |

- **A frase do congelamento nomeia o GOLPE, não quem congelou** — foi o pedido, e faz sentido: o que
  o jogador precisa ligar é o EFEITO ao GOLPE, pra saber que aquele ataque pode fazer isso de novo.
  O nome sai do campo `mv`; log gravado antes dele cai numa versão sem golpe, que continua contando
  o que aconteceu.
- **⚠️ "COM" E NÃO "PELO", e é a única palavra que mudei do pedido.** Os quatro nomes PT têm gêneros
  diferentes — Soco de Gelo, Raio Congelante e Pó de Neve são masculinos, mas **NEVASCA é feminina**,
  e *"congelado pelo Nevasca"* sai errado. A preposição neutra serve aos quatro sem precisar de uma
  tabela de gênero pra uma frase só. O teste cobra os quatro.
- **A do `gelado` existe pra explicar uma barra parada:** sem ela o jogador vê o pokémon não atacar e
  procura bug onde é regra. É a mesma razão do *"mas não teve efeito"* da imunidade.
- **O `q` da linha é de QUEM ESTÁ CONGELADO**, não de quem congelou — a convenção do `acordou` e da
  Fúria: estas linhas são sobre UM pokémon, não sobre um causador e um alvo.

**O SEGUNDO E MEIO DE LEITURA** foi pedido com estas palavras (*"a cada frase, esperar aquele 1,5s
para o usuario conseguir ler o que aconteceu"*), e quem o entrega é a tabela `passosDaAbertura`: as
três valem **1 passo** cada, o que as faz virar passo próprio da animação e ganhar a marca `leitura`.
Sem entrada na tabela a frase valeria pra **SEMPRE** — o defeito que a anulação teve.

**⚠️ A ORDEM DAS LINHAS CUSTOU DUAS VERSÕES, e a segunda parecia certa.** As linhas nasceram
empilhadas no FIM do `doExchange`, junto do `acordou` — e o log saía *"Blissey ataca / Blissey
degelou"*, a ordem invertida da cena. A segunda versão as pôs por slot mas ainda no fim, e o
re-congelamento saía *"congelou / degelou"*. Hoje cada linha mora no **slot de quem ela descreve**,
em ordem de VELOCIDADE: as de entrada (`degelou`, `gelado`) antes do golpe daquele lado, e a
`congelou` logo depois do golpe que a causou.
**O invariante que o teste cobra é o que isso existe pra sustentar:** percorrendo o log linha a
linha, **quem está congelado nunca aparece atacando**. Conferido em 766 confrontos, e ele acusa 965
casos com o bloqueio removido.

#### ⚠️ E ELE DESENTERROU O DEFEITO DO `findIndex`, por uma porta nova

O `ondeEstaNaSequencia` do `avisoDoConfronto` procurava **o primeiro** `{x, q}` igual na sequência.
Isso dava o certo por acidente: até aqui **nenhuma abertura repetia a mesma linha, do mesmo lado, no
mesmo confronto**. O congelamento repete — o mesmo pokémon perde a vez três turnos seguidos (três
linhas `gelado` do mesmo `q`) e pode congelar de novo depois.

Com o `findIndex`, todas apontavam pro primeiro índice e **só a primeira ganhava frase**: as outras
ficavam com "Trocando golpes..." no passo delas, com a pausa de leitura e nada escrito. É o mesmo
defeito que a Faixa de Foco e o desempate já tiveram (11/09/2026), agora por outra porta.

Hoje o emparelhamento é **posicional**: o k-ésimo `{x,q}` do DIÁRIO é o k-ésimo `{x,q}` da
SEQUÊNCIA. As duas listas guardam a ordem do motor, então isso é exato.
**Conferido que não é motor, por impressão:** o mesmo build antes e depois dá o **MESMO hash** em
900 batalhas semeadas.

**O QUE ISSO VALE, MEDIDO — e a conclusão é que a mecânica é RARA e PESADA.**

**⚠️ SÓ 12 DAS 250 APRENDEM UM DOS QUATRO por nível, e 10 os levam** no moveset padrão do Lv.70:
Shellder, Seel, Dewgong, Lapras, Jynx, Articuno, Swinub, Piloswine, Remoraid e Smoochum. Das que
levam, o motor **escolhe** o golpe de gelo em 65% dos ataques contra um painel de 8.

| 1x1 contra um painel de 8, mesmo nível, 2.000 batalhas por célula | sem | com | |
|---|---|---|---|
| **Articuno Lv.50** | 61,0% | **69,0%** | **+8,0** |
| **Jynx Lv.50** | 52,5% | **57,0%** | **+4,6** |
| Smoochum Lv.30 | 9,5% | 11,3% | +1,8 |
| Swinub Lv.30 | 0,0% | 1,8% | +1,8 |
| Lapras Lv.50 | 61,7% | 63,3% | +1,5 |
| Piloswine, Dewgong, Shellder, Seel, Remoraid | — | — | **0,0** |

**⚠️ OS CINCO ZEROS TÊM CAUSA, e ela não é a mecânica: eles NÃO LEVAM um golpe de gelo no nível
testado.** O Dewgong Lv.50 leva Aurora Beam (que é Gelo e **não congela**), o Piloswine leva
Derrubada e Escavar. Só Jynx e Articuno usam o golpe contra os 8 do painel; Lapras usa contra 3.
É a mesma conclusão do Rolamento: **o motor está certo em recusar**.

**NA BATALHA: sai em 0,7% das batalhas 3x3** e em 0,18% dos confrontos, com **1,77 turnos perdidos
por congelamento**. As linhas de gelo são **0,2% do log**.

**O PREÇO NA JORNADA: nada. 58,31% contra 57,14% de conclusão** — **+1,17 ponto, 1,2σ** (8 blocos de
800 jornadas de cada lado, **6.400 de cada**, desvio tirado de ENTRE os blocos, **5 de 8 blocos** pro
lado do gelo). Ruído puro, e por dois motivos somados: são **10 espécies em 250**, e elas caem dos
DOIS lados — o Articuno é raro de rota e a Jynx aparece em time de líder.

- **Se um dia incomodar**, as réguas são a **chance por golpe** (`GOLPES_QUE_CONGELAM`, que é por
  GOLPE — dá pra deixar a Nevasca em 10% e o Pó de Neve em 5%) e a **chance de degelo**
  (`CHANCE_DESCONGELAR`, hoje 25%: baixá-la alonga o gelo, e é a alavanca mais forte das duas).
- **⚠️ E VALE SABER O QUE ELE NÃO ALCANÇA:** a mecânica vive no `doExchange`, então ela vale na
  jornada, na Elite, na Torre e no Ginásio da Cidade — os quatro que montam time a partir dos SAVES.
  **Nas ligas e no online ela quase não existe**, e não é exceção nova: lá o time vem de um CÓDIGO
  (`especie:nivel:shiny`), ninguém tem golpe escolhido e o motor cai no de tipo, então não há id de
  golpe pra consultar na tabela. A única porta que sobra ali é o **METRÔNOMO**, que sorteia entre
  todos os golpes de dano e pode trazer um dos quatro.
- `tools/test-especiais.js` tranca: os quatro golpes e a chance, que eles EXISTEM na tabela e são de
  tipo Gelo (a lição da Lâmina Solar), que os outros golpes de Gelo **não** congelam, que 10 espécies
  os LEVAM de verdade (a lição da Fúria, que ao pé da letra saía em 0,0%), as duas chances medidas
  com **um rng contínuo**, a imunidade do tipo Gelo em 3.000 trocas, o alvo caído e o já congelado, o
  invariante da ordem, as três frases palavra por palavra nos quatro golpes, a pausa de 1,5s, a marca
  solta em 400 batalhas, as duas saídas antecipadas do rng, e **120 batalhas com gelo garantido
  batendo golpe a golpe nos dois motores**.
  **⚠️ A comparação das 300 batalhas NÃO serve pra isso**: são 10 espécies em 250 e o gelo sairia em
  ~2 delas, o que faz a trava falhar sozinha **uma vez em sete** — o pior tipo de teste que existe,
  o que passa quase sempre. Por isso ela tem painel próprio.

#### ⚠️ E AS TRÊS LINHAS NÃO SAÍAM NO LOG — o defeito que só o NAVEGADOR pegou

A lista de `x` que viram frase no `passosHtml` era **escrita à mão**, uma fileira de 17 nomes. O
congelamento nasceu fora dela, e as três linhas caíam no **ramo do golpe comum**:

```
Blissey atacou Articuno com Nevasca e tirou −0 de HP.
Blissey atacou Articuno com Pancada e tirou −0 de HP.
```

Duas coisas erradas na mesma linha: um **`−0 de HP`** (o que este log evita em toda regra, pelo
mesmo motivo do *"mas não teve efeito"* da imunidade) e o nome de **um golpe que a Blissey nem
tem** — o campo `mv` da linha do congelamento virava o golpe dela.

- **⚠️ NENHUMA DAS 31 TRAVAS PEGOU, e a razão é a lição:** elas liam o **DIÁRIO** e a **SEQUÊNCIA**,
  e as duas estavam certas. O defeito era do **HTML**. Quem pegou foi desenhar a tela no navegador.
- **O conserto não foi acrescentar três nomes à lista: foi a lista deixar de existir.** Quem decide
  hoje é o **`ehGolpeEspecial`**, que já existia e já conhecia os três. Acrescentar nomes deixaria a
  armadilha armada pro próximo especial.
  **Duas exceções, e as duas têm razão:** o `disable` ESTÁ no `ehGolpeEspecial` e fica de fora
  (as anulações já foram desenhadas antes de tudo, porque acontecem na abertura do confronto), e
  `faixa`/`desempate` NÃO estão nele (são avisos do MEIO da luta) e precisam entrar.
- **Conferido que o conserto não tocou em mais nada:** varrendo 494 confrontos com especial e 19
  marcas diferentes, as **decisões que mudaram foram exatamente as 16 linhas de gelo**.
- **O SELO ❄️ veio junto**, e pelo mesmo tipo de conferência: as três saíam **mudas** na linha de
  status enquanto todo o resto do bloco tem o seu (😴 💫 🌪️ 😤 🐉). As três dividem o mesmo ícone de
  propósito — elas são o mesmo evento em três momentos (pegou / perdeu a vez / passou), e ícones
  diferentes fariam procurar três mecânicas onde há uma.

**MEDIDO NO NAVEGADOR, a 320px:** as quatro frases cabem sem rolagem lateral, as duas mais longas em
**2 linhas (41px)** e a do degelo em 1 (21px) — o mesmo perfil que a confusão, o Remoinho e a Fúria
já têm. O log do confronto do exemplo fica em **500px, 22 linhas, zero `−0 de HP`**; varrendo 182
confrontos com gelo, **zero** também.

`tools/test-especiais.js` passou a **ler o HTML do log** por causa disto: nenhuma linha de gelo vira
`−0 de HP`, as 888 linhas de gelo saem com a frase delas, a decisão vem do `ehGolpeEspecial` (e não
de uma lista à mão), o `disable` fica de fora, e as três têm o ❄️.

**⚠️ E ELE CUSTOU QUATRO ERROS DE MEDIÇÃO SEGUIDOS, todos da mesma família — a lição fica:**

| o que eu fiz | o que a medição disse |
|---|---|
| `ataquesPadrao(id, nivel)` em vez de `ataquesPadrao(instancia)` | **zero** espécies levam golpe de gelo |
| `best.id` em vez de `best.golpe` | o motor **nunca** escolhe o golpe de gelo (0 de 80) |
| `r.playerWon` em vez de `r.win` | **0,0%** de vitória pra todas as dez |
| `inst()` do teste, que não preenche `hp` | congela em **0,00%** (66,7σ) |

Nenhum deles é defeito do jogo, e os quatro pareciam ser. **Conferir a FORMA do retorno antes de
medir** é mais barato que interpretar um zero.

### A QUEIMADURA: O PRIMEIRO STATUS QUE NÃO PASSA (16/09/2026)

Pedida assim: *"faça o mesmo com os ataques que causam queimar, segue como funciona na bulbapedia,
lembrando que estamos seguindo as regras da geração III, ou seja, quando um pokemon sofrer
queimadura, ele perde 1/16hp a cada turno e reduz pela metade o dano que um Pokémon queimado causa
com golpes físicos, Pokémon do tipo Fogo não podem mais ser queimados. Adicionar algum símbolo no
pokemon que está queimado"*.

- **⚠️ ELA É O CONTRÁRIO DO CONGELAMENTO NO QUE MAIS IMPORTA: ela NÃO PASSA.** O gelo sorteia degelo
  a cada turno e dura 1,77 turno na prática; a queimadura pega e fica **até o fim da BATALHA**. É a
  diferença entre um efeito que se espera passar e um que se acumula — e é ela que faz o selo na
  tela ser obrigatório, porque o jogador precisa saber por que o pokémon dele está batendo metade
  três confrontos depois.
- **SÃO SETE GOLPES** (`GOLPES_QUE_QUEIMAM`): Soco de Fogo, Brasa, Lança-Chamas, Explosão de Fogo,
  Roda de Fogo e Onda de Calor a **10%**, mais o **Fogo Sagrado a 50%** — os valores oficiais.
  A lista saiu do dado (Showdown, mod da Gen 3), o mesmo caminho dos quatro do gelo.
  **⚠️ DOIS FICARAM DE FORA, e os dois por razão de dado:** o **Will-O-Wisp** é golpe de STATUS
  (poder 0, e a base só cadastra dano) e o **Blaze Kick** ninguém aprende por nível nas 250 —
  cadastrá-los seria letra morta, a lição da Lâmina Solar.
  **⚠️ O FOGO SAGRADO SÓ EXISTE NO HO-OH**, que é INTOCÁVEL: a entrada não roda hoje e fica por ser
  o que o dado diz, a mesma decisão do Lugia no `RECUPERACAO` e no `REMOINHO`.
- **⚠️ E O REDEMOINHO DE FOGO É O ÚNICO GOLPE DE FOGO DA TABELA QUE NÃO QUEIMA** — fiel: ele é o de
  PRENDER (que virou multi-tapa aqui) e não tem efeito de status. Há trava varrendo a tabela por
  TIPO, pra um golpe de fogo novo não entrar por engano nem ficar de fora em silêncio.
- **O TIPO FOGO É IMUNE**, como no original. Um detalhe bonito que caiu de graça: **as 22 espécies
  que levam um golpe que queima são exatamente as 22 do tipo Fogo** — então elas nunca se queimam
  entre si, e o espelho é seguro sem precisar de regra nenhuma.
- **O DANO É 1/16 DO TETO, por turno, e ELA PODE MATAR** — como no jogo original. O **mínimo é 1**:
  com o arredondamento, um pokémon de teto menor que 16 levaria ZERO e a queimadura viraria enfeite
  — e uma linha de `−0 de HP` é o que este log evita em toda regra.
- **⚠️ MAS ELA NUNCA DERRUBA OS DOIS NA MESMA TROCA**, e essa foi a única decisão de mecânica que
  este pedido obrigou. A regra é de 12/09/2026, pedida com estas palavras: *"não existe de os 2
  cairem juntos, somente na auto destruição"*. Foi por ela que o revide moribundo deixou de matar, e
  a queimadura reabria a porta pelo outro lado: o adversário cai no golpe, e no fim da mesma troca a
  queimadura leva quem o derrubou.
  **Medido antes da trava: 95 dos 99 casos de morte dupla passaram a ser dela** — ou seja, ela virou
  a causa dominante de algo que o jogo tinha acabado de eliminar. Hoje quem chega por último cede:
  se o outro lado já está em 0, a queimadura para em 1 de HP. Medido depois: **174 de 174** mortes
  duplas são autodestruição.

**A METADE DO ATAQUE FÍSICO entra pela MESMA porta da Dança da Pluma** (`withQueimadura`, um degrau
do `effectiveAttack`) — que já é exatamente este efeito, ×0,5 no Ataque, com outro gatilho. Sendo um
degrau do atributo, ela vale de graça nos **seis** pontos do motor que leem ataque físico, e nenhum
caminho novo nasce sem ela. O Ataque Especial não é tocado, que é a regra.

**⚠️ ELA ENTRA DEPOIS DOS MULTIPLICADORES E DO FLAT**, como a dança: "metade do ataque" é metade do
que o pokémon TEM na hora do golpe. Conferido num shiny: 156 → 78, exato.

**⚠️ E AQUI ESTÁ O NÚMERO QUE IMPORTA — o valor dela é DEFENSIVO, e a medição de quem queima
esconde isso.** Pra quem usa o golpe, o ganho é de +1 a +3 pontos. Pro alvo, o custo é enorme
(1x1 contra um painel de 8, queimadura forçada, 1.200 batalhas por célula):

| queimado | vitória cai | |
|---|---|---|
| **Gyarados** | 76,9% → **40,1%** | **−36,8** |
| **Snorlax** | 65,6% → 40,0% | −25,6 |
| **Dragonite** | 55,1% → 35,7% | −19,4 |
| **Rhydon** | 18,3% → **0,1%** | −18,3 |
| Machamp | 39,4% → 24,9% | −14,5 |
| Starmie | 53,3% → 42,0% | −11,3 |
| Venusaur | 27,1% → 20,9% | −6,2 |
| **Alakazam** | 60,8% → 58,2% | **−2,7** |

**A distância entre o Gyarados (−36,8) e o Alakazam (−2,7) É a mecânica**: neste motor quem decide
físico × especial é o **TIPO do golpe** (`isSpecialType`, regra da Gen 1). Medido nas 250: **115
espécies atacam sempre pelo físico** (a queimadura morde inteiro), **91 sempre pelo especial** (ela
não tira um ponto de dano) e 44 variam conforme o alvo. É o mesmo desenho que a Dança da Pluma já
tinha, com o gatilho invertido.

**⚠️ E A ESCOLHA DO GOLPE NÃO SABE DA QUEIMADURA, e isso é herdado — não é decisão nova.** A `nota`
do `melhorAtaque` compara poder × tipo × STAB e **não olha o atributo**, então um pokémon queimado
continua escolhendo pelo poder cru e pode insistir num físico que agora vale metade. A Dança da
Pluma vive com isso desde 12/09/2026, pelo mesmo motivo. Se um dia incomodar, o lugar é a `nota` —
e o cuidado é o de sempre: ela tem que mudar nos DOIS motores e nos dois lugares (a escolha e o
dano), senão o motor escolhe por uma regra e aplica outra.

**NA TELA são três coisas, e a terceira é a que foi pedida:**

| | |
|---|---|
| `queimou` | *🔥 Snorlax ficou queimado com LANÇA-CHAMAS!* — no passo do golpe que causou |
| `queima` | *🔥 Snorlax perdeu 35 de HP pela queimadura* — a cada turno |
| **o selo 🔥** | no quadro do lutador, ao lado do 🌟, 🔺, 🎖️, ⚔️ e 🪶 |

- **⚠️ A LINHA DO DANO TRAZ O NÚMERO, e ela é a única do bloco de status que traz:** a linha de um
  especial não ganha o "e tirou −N de HP" automático, e sem o número a soma das linhas não fecharia
  com a barra — o jogador veria a barra descer mais do que o log conta. É a mesma razão pela qual a
  Fúria do Dragão escreve os 40 dela.
- **⚠️ O SELO SAI DE UM CAMPO DO MATCHUP** (`playerQueimado`/`enemyQueimado`), **não da marca do
  diário** — e é o MESMO caso da Fúria: a queimadura ATRAVESSA confrontos, então um pokémon pode
  lutar três deles queimado com a marca só no primeiro. Lido do diário, o selo sumiria justamente
  nos confrontos em que o jogador mais precisa dele. Há caso de teste para exatamente isso (a
  "queimadura herdada": o pokémon entra já queimado, sem marca nenhuma, e o selo sai).
  Confronto gravado antes do campo sai sem selo — log velho não pode sumir.
- **⚠️ O PASSO DA ANIMAÇÃO NÃO INVERTE O LADO**, e essa é a armadilha da mecânica. O passo comum lê
  o `q` como QUEM BATE e desce a barra do OUTRO; aqui o `q` é de **quem está queimado** — não há
  causador nesta troca, ela foi aplicada turnos atrás. Invertido, a barra que desce é a do pokémon
  errado, e o defeito não aparece como erro: aparece como o adversário perdendo vida do nada. É o
  mesmo cuidado que a cura, a fúria e o dreno já têm, pelo lado oposto.
- **⚠️ E A LINHA NÃO GRAVA `hp`, pela mesma razão do REMOINHO:** o campo quer dizer "a vida do ALVO
  depois do golpe", e o alvo de uma linha comum é o lado OPOSTO ao `q`. Gravando ali a vida de quem
  PERDE, toda conta que lê o diário a atribui ao outro lado.
- **A pausa de 1,5s** vem da entrada no `passosDaAbertura` (1 passo cada), como as três do gelo.

**⚠️ ELA É A QUARTA DA FAMÍLIA "HP QUE SUMIU SEM SER GOLPE DO ADVERSÁRIO"** — ao lado do
`absorbdano`, da `confusao` e da `furiadragao` — **e a PRIMEIRA em que o `q` é de QUEM PERDE**; nas
outras três ele é de quem CAUSOU, e por isso todas as contas do teste invertem o `q` pra achar o
lado. Somada ao `danoSemGolpe` sem mais nada, ela seria contada no lado errado nas **oito** contas.
Hoje quem responde "quanto o lado X perdeu sem ser golpe do outro" é uma função só
(`perdeuSemGolpe`), e não cada conta invertendo à mão — a mesma lição que fez o `danoSemGolpe` virar
função quando a Fúria do Dragão entrou.

**MEDIDO NA BATALHA: ela sai em 2,4% das batalhas 3x3** e em 0,80% dos confrontos, com 180 turnos de
dano e **12 mortes pela queimadura** em 15.793 confrontos. As linhas dela são 0,6% do log.

**O PREÇO NA JORNADA: NADA — 57,57% contra 57,63%, −0,05 ponto, 0,0σ** (7 blocos de 800 jornadas de
cada lado, **5.600 de cada**, desvio tirado de ENTRE os blocos, **3 de 7 blocos** pro lado da
queimadura). Ruído absolutamente puro, e por dois motivos somados: são 22 espécies em 250, e elas
caem dos DOIS lados — o Charizard do rival, o Arcanine do Blaine, o Houndoom de rota.

- **Se um dia incomodar**, as réguas são a **chance por golpe** (`GOLPES_QUE_QUEIMAM`, que é por
  GOLPE), o **dano por turno** (`QUEIMADURA_DANO`) e o **corte do ataque** (`QUEIMADURA_FISICO`). O
  corte é a alavanca mais forte de longe — é ele que vale os −36,8 do Gyarados.
- **⚠️ E ELA NÃO ALCANÇA as ligas nem o online**, pela mesma razão do gelo: lá o time vem de um
  CÓDIGO e ninguém tem golpe escolhido, então o motor cai no de tipo e não há id pra consultar na
  tabela. A única porta que sobra é o **METRÔNOMO**.
- **⚠️ E O TRI ATTACK FICOU DE FORA, de propósito.** Ele existe na tabela (Normal, 80) e na Gen 3
  tem 6,67% de causar **um dos três** status — só que o dado do Showdown não o marca como `brn` (ele
  modela o sorteio com `onHit`), e dois dos três status ainda não existem no jogo. Cadastrá-lo hoje
  seria inventar. Fica registrado pro dia em que a paralisia entrar.
- `tools/test-especiais.js` tranca 40 pontas: os sete golpes e as duas chances, que eles EXISTEM na
  tabela e são de tipo Fogo, que o Redemoinho de Fogo é o único de Fogo que não queima, que 22
  espécies os LEVAM de verdade (a lição da Fúria), a chance medida com **um rng contínuo**, a
  imunidade do Fogo em 3.000 trocas, o alvo caído e o já queimado, o 1/16 com piso de 1 (num teto
  de 10), o corte do físico e o Sp.Atk intocado, o corte exato num shiny, **os dois nunca caindo
  juntos fora da autodestruição**, as duas frases palavra por palavra, o selo 🔥 no lado certo, a
  **queimadura herdada**, o lado da barra na animação, a linha sem `hp`, o HTML do log sem `−0 de
  HP`, a marca solta em 400 batalhas, as duas saídas antecipadas do rng, e **120 batalhas com
  queimadura garantida batendo golpe a golpe nos dois motores**.

#### ⚠️ E O SELO 🔥 ENTREGAVA A QUEIMADURA ANTES DE ELA ACONTECER (16/09/2026)

Reportado assim: *"o emoji de quando o pokemon ta queimando, ta aparecendo logo quando o pokemon
entra na luta, mesmo se o golpe que for dar o queimar for tipo o sexto golpe"*.

- **A CAUSA: ele saía do CAMPO do matchup, que é o estado no FIM do confronto.** O campo existe pela
  razão certa (a queimadura ATRAVESSA confrontos, então a marca do diário não serve — ver acima), e
  o defeito era o outro lado da mesma moeda: lido sem o passo, ele anuncia no primeiro quadro uma
  queimadura que só vai acontecer seis golpes depois.
- **⚠️ ELE É O CONTRÁRIO DOS OUTROS CINCO SELOS DAQUELE QUADRO, e é por isso que precisou de regra
  própria.** O 🌟, o 🔺, o 🎖️, o ⚔️ e o 🪶 valem o confronto inteiro porque são **ABERTURA** — já são
  verdade antes do primeiro golpe. A queimadura acontece **NO MEIO**, como a Faixa de Foco — e a
  Faixa fica escondida até o passo dela exatamente pelo mesmo motivo (*"mostrá-la antes entregaria
  o desfecho"*).
- **O `selosDoConfronto` passou a receber o PASSO**, e quem decide é o `queimouAteAqui`:
  - há marca `queimou` deste lado no diário → o selo sai a partir do **passo dela** (`i + 1`, a
    convenção de sempre: `passo === k + 1` quer dizer "animando `seq[k]`");
  - **não há marca → a queimadura é HERDADA**, e aí o selo vale desde o primeiro quadro: ele entra
    no confronto já queimado, e ali o selo é verdade desde o começo. *Procurar a marca e não achar
    significa "veio de antes", não "não houve"* — é o caso que uma leitura ingênua erraria.
  - **sem `passo` o selo vale**, e isso é o log relido dias depois: ali o confronto já acabou e ele
    é o resumo, não um anúncio.
- **AS CINCO CHAMADAS PASSAM O PASSO** — o `fighterHtml` (as três primeiras telas), as duas da liga
  assistida (`game.leagueWatchHitStep`) e as duas do online (`anim.passo`). Uma tela que esqueça o
  passo volta a ter o defeito, **e só nela**: por isso o teste conta as chamadas com três argumentos
  contra o total, em vez de nomear as telas.
- **CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois dá o **MESMO hash** em
  900 batalhas semeadas. O selo é apresentação inteira.
- **Medido no navegador**, num confronto em que a queimadura sai no 5º de 7 passos: o 🔥 está ausente
  nos passos 0 a 4 e presente do 5 em diante, exatamente.

### O ASTERISCO DOS TRÊS STATUS NO CARTÃO DO GOLPE (16/09/2026)

Pedido assim: *"Nos ataque de fogo, veneno e congelamento que causam esses status, coloque um * no
quadro deles, avisando '10% de chance de causar queimadura (emoji da queimadura)'"*.

São **17 golpes** (7 de queimadura, 4 de congelamento, 6 de veneno), e a linha entra no
`obsDoGolpe`, que já é a função das observações e já devolve uma LISTA desde 15/09/2026.

- **É a informação que MAIS muda a escolha e que os seis números MENOS contam.** Um Ferrão Venenoso
  de **poder 15** com 30% de envenenar vale mais, num confronto longo, que um golpe de 40 que só
  bate — e o cartão mostrava só o 15. É o mesmo raciocínio que pôs a drenagem e a trava do Comedor
  de Sonhos aqui.
- **⚠️ A CHANCE SAI DA TABELA, nunca escrita à mão, e aqui isso não é detalhe: ela VARIA de golpe
  pra golpe.** O Fogo Sagrado queima em **50%**, a Presa Venenosa envenena em **50%**, a Fumaça em
  **40%**, o Agulha Dupla em **20%**. Uma frase fixa de "10%" — que é o que o pedido escreveu como
  exemplo — **mentiria em cinco dos dezessete golpes**. E golpe novo numa das três tabelas já nasce
  com o aviso.
  O teste prova que ela é DERIVADA mexendo na tabela e cobrando que a frase acompanhe: um texto fixo
  passaria em todos os casos nomeados e falharia só nesse.
- **O EMOJI É O MESMO DO LOG E DO QUADRO DO LUTADOR** (`ICONES_ESPECIAIS`): o jogador lê 🔥 aqui e
  reconhece o 🔥 no quadro do pokémon queimado, sem precisar ligar as duas coisas.
- **O AGULHA DUPLA É O CASO DE DUAS OBSERVAÇÕES** — ele é multi-tapa E envenena. Foi por um caso
  assim que o `obsDoGolpe` virou lista; com `return` de string, a segunda apagaria a primeira em
  silêncio.

**Custo de tela, medido a 320px no navegador:**

| | altura do cartão |
|---|---|
| golpe comum | 52px |
| com queimadura | 66px |
| com congelamento ou veneno | 78px (a frase cai em 2 linhas) |
| **com DUAS observações** (Agulha Dupla) | 93px |

Na TELA de escolha: **484px** com cinco golpes comuns e **537px** no pior caso possível (cinco
golpes de status, que nenhum pokémon tem) — **+11%**, sem rolagem lateral. No caso real (um golpe
de status entre quatro) o custo é **zero**: a tela fica nos mesmos 484px.

#### ⚠️ E ELE DESENTERROU UMA FRASE QUE MENTIA HÁ TRÊS DIAS

A observação dos multi-tapa era **"Golpe repete entre 2-5x" escrita à mão** — e isso virou mentira
em **13/09/2026**, quando o Chute Duplo, o Ossomerangue e a Agulha Dupla entraram com distribuição
PRÓPRIA (`TAPAS_SEMPRE_2`): eles batem **SEMPRE 2 vezes**, e o cartão prometia de 2 a 5.
**Três golpes em catorze.**

- **Só ficou visível agora** porque a Agulha Dupla ganhou uma segunda linha e as duas foram lidas
  juntas — *"Golpe repete entre 2-5x"* logo acima de *"20% de chance de causar envenenamento"*.
- **Hoje a faixa sai da TABELA**, como as chances: `min === max` vira *"Golpe repete 2x"* e o resto
  continua *"Golpe repete entre 2-5x"*. Golpe novo com distribuição própria já nasce com a frase
  certa.
- **É a mesma lição da lista à mão do `passosHtml`**, que deixou as três linhas do congelamento
  caírem no ramo do golpe comum: **texto fixo que descreve uma tabela envelhece quando a tabela
  cresce**. Os dois defeitos nasceram no mesmo lugar do pensamento.

`tools/test-especiais.js` tranca: os 17 golpes avisando e **nenhum de fora**, as cinco chances que
não são 10%, que ela é derivada (mexendo na tabela, a frase acompanha), o emoji sendo o mesmo do
log, o Agulha Dupla com as duas observações, e a faixa de tapas batendo com a tabela nos catorze
golpes. Conferido que ele acusa 5 falhas com a chance fixa em 10%, 2 com a faixa de tapas fixa e 6
com o veneno sem aviso.

### O ENVENENAMENTO (16/09/2026)

Pedido assim: *"faça a mesma mecanica para pokemons que causam Poison ... tirando 1/8 de hp maximo e
pokemon de aço tem imunidade, e o pokemon continua com esse status até ele morrer, mesma coisa com a
queimadura"*, com a Bulbapedia como fonte.

É a **terceira** mecânica POR ATAQUE, e a **mais simples das três**: só dano, sem tocar em atributo
nenhum. O que ela tem de próprio é o **dobro** do dano da queimadura.

- **SÃO SEIS GOLPES** (`GOLPES_QUE_ENVENENAM`), e aqui as chances **VARIAM** — ao contrário do gelo
  (todos 10%): Ferrão Venenoso 30%, **Agulha Dupla 20%**, Fumaça 40%, Lama 30%, Bomba de Lodo 30% e
  **Presa Venenosa 50%**. São os valores oficiais, tirados do dado (Showdown, mod da Gen 3).
- **⚠️ FICARAM DE FORA: Pó Venenoso, Tóxico e Gás Venenoso** (golpes de STATUS, poder 0, e a base só
  cadastra dano) e a **Cauda Venenosa** (ninguém a aprende por nível nas 250). A mesma regra que
  tirou o Will-O-Wisp da queimadura.
- **⚠️ A PRESA VENENOSA É "GRAVE" NO ORIGINAL** — o veneno que escala 1/16, 2/16, 3/16… Aqui ela
  entra como veneno **NORMAL**: o pedido fixou 1/8, e o veneno grave é outra mecânica. Ter o golpe
  funcionando com 1/8 é mais próximo do jogo do que não ter o efeito nenhum.
- **⚠️ O AGULHA DUPLA É O ÚNICO DA LISTA QUE NÃO É DE VENENO** (ele é Inseto) — e é também o único
  que **já é um golpe de VÁRIOS TAPAS**. A chance vale por **ATAQUE**, não por tapa: o
  `tentarEnvenenar` roda uma vez por golpe no `doExchange`, como os outros dois status. No original
  só o segundo tapa pode envenenar; a diferença some da tela e fica registrada aqui.
- **⚠️ O ÁCIDO É O ÚNICO GOLPE DE VENENO DA TABELA QUE NÃO ENVENENA**, e é fiel: na Gen 3 ele baixa
  a Defesa Especial. É o mesmo par que o Redemoinho de Fogo faz na queimadura, e há trava varrendo a
  tabela por tipo.

**⚠️ O VENENO ENTROU NA LISTA DE IMUNES POR DECISÃO MINHA, e vale saber por quê.** O pedido dizia só
*"pokemon de aço tem imunidade"*, mas a **Bulbapedia — a fonte citada no próprio pedido** — põe os
dois, e é a mesma simetria dos outros dois status (o Gelo não congela, o Fogo não queima).
Medido, é isso que sustenta a mecânica: **24 das 26 espécies que levam um golpe da lista são de
Veneno**. Sem ela, elas se envenenariam com os próprios golpes, e o espelho de um time de Veneno
viraria uma troca de veneno mútua. Se um dia for pra valer só o Aço, é tirar um termo do
`podeEnvenenar` — e a régua está aqui: **41 espécies são imunes** hoje (4 de Aço + 37 de Veneno).

**O DANO É 1/8 DO TETO, o DOBRO da queimadura, e ELE PODE MATAR** — como no original. Mínimo de 1,
pelo mesmo motivo de lá: com o arredondamento, um teto pequeno levaria ZERO e o veneno viraria
enfeite.

**⚠️ OS DOIS STATUS DE DANO POR TURNO DIVIDEM UMA FUNÇÃO SÓ (`danoDeStatus`), e isso não é economia
— é o que faz a trava dos "dois nunca caem juntos" valer.** Em blocos separados, a queimadura
pararia em 1 olhando o adversário vivo e o veneno o mataria logo depois: **a trava daria verde em
cada metade enquanto o par quebrava a regra**. Medido depois: **158 de 158** mortes duplas são
autodestruição.

#### ⚠️ E A FAIXA DE FOCO PASSOU A SEGURAR O DANO DE STATUS

A trava do item pegou um furo de verdade: **a queimadura e o veneno matavam por baixo da Faixa**.

- **No jogo original o Focus Sash só protege de dano DIRETO**, então tecnicamente estava certo.
  **Aqui ela protege dos dois**, e a razão é a promessa que a casa fez pro item — *"quem carrega a
  Faixa nunca termina um confronto em 0 sem ela ter disparado antes"*. Essa trava existe porque a
  **autodestruição já tinha furado a Faixa uma vez e o jogador reportou** (*"equipei o charizard com
  Faixa de foco e ele morreu direto quando chegou com 0 de hp"*).
- Um item que promete segurar a morte e falha justamente na morte silenciosa — a que não tem golpe
  na tela pra explicar — é pior que não ter o item.
- Ela continua sendo **UMA**: gasta ali, e o turno seguinte de veneno leva o pokémon.

**NA TELA são três coisas, as mesmas da queimadura:**

| | |
|---|---|
| `envenenou` | *🟣 Snorlax foi envenenado com BOMBA DE LODO!* — no passo do golpe que causou |
| `veneno` | *🟣 Snorlax perdeu 77 de HP pelo veneno* — a cada turno, **com o número** |
| **o selo 🟣** | no quadro do lutador, **só a partir do passo em que o veneno pega** |

- **O 🟣 É A COR DO TIPO, e não uma caveira:** ☠️ se lê como MORTE, e o envenenado continua lutando.
- **O selo segue a regra que o 🔥 acabou de ganhar** — ele só aparece no passo do evento, porque o
  veneno também acontece NO MEIO do confronto. Envenenamento **herdado** (sem marca no diário) vale
  desde o primeiro quadro. A função `statusAteAqui` serve aos dois.
- **O `q` da linha é de QUEM PERDE**, e por isso o passo da animação **não inverte o lado** — a
  mesma armadilha da queimadura, e a linha do motor é literalmente a mesma.

**O QUE ELE VALE, MEDIDO — e ele é UNIFORME, ao contrário da queimadura.** 1x1 contra um painel de
8, veneno forçado, 1.200 batalhas por célula:

| envenenado | vitória cai | |
|---|---|---|
| **Rhydon** | 30,8% → **9,9%** | **−20,9** |
| Starmie | 51,9% → 38,1% | −13,8 |
| Gyarados | 70,3% → 56,9% | −13,4 |
| Dragonite | 43,7% → 31,0% | −12,7 |
| Alakazam | 52,3% → 43,8% | −8,5 |
| Snorlax | 63,0% → 56,8% | −6,3 |
| Machamp | 42,9% → 42,2% | −0,8 |

**A diferença pra queimadura é o FORMATO, não o tamanho.** Lá o custo ia de −2,7 (Alakazam) a −36,8
(Gyarados) porque ela corta o **ataque físico** — quem bate pelo especial quase não sentia. Aqui é
só dano, então ele cai parecido em todo mundo: o **Alakazam sente −8,5** contra os −2,7 da
queimadura.

**MEDIDO NA BATALHA: sai em 4,5% das batalhas 3x3** e em 1,51% dos confrontos, com 347 turnos de
dano e **27 mortes pelo veneno** em 15.912 confrontos. As linhas dele são 1,09% do log.

**O PREÇO NA JORNADA: NADA. 57,66% contra 58,08% de conclusão** -- **−0,42 ponto, 0,6σ** (8 blocos
de 800 jornadas de cada lado, **6.400 de cada**, desvio tirado de ENTRE os blocos, e apenas **3 de 8
blocos** pro lado do veneno). Ruído puro, e a direção é até negativa. Faz sentido pelos dois motivos
de sempre: são 26 espécies em 250 e elas caem dos DOIS lados -- o Venusaur do rival, o Muk da rota,
o Vileplume da Erika.

**⚠️ E ESTA MEDIÇÃO PRECISOU SER REFEITA, pela lição de método que vale guardar:** a primeira rodou
contra o `index.html` do repo enquanto eu **mexia nele** pra conferir que as travas acusavam com os
defeitos religados. Dois blocos saíram vazios e os outros não eram confiáveis. Hoje o A/B roda sobre
**duas cópias congeladas** (`--html` dos dois lados), e mexer no repo durante a medição deixou de
contaminá-la.

- **Se um dia incomodar**, as réguas são as **chances por golpe** (`GOLPES_QUE_ENVENENAM`, que são
  por GOLPE) e o **dano** (`VENENO_DANO`). O dano é a alavanca mais forte, e ele é o dobro da
  queimadura por pedido.
- **⚠️ E ELE NÃO ALCANÇA as ligas nem o online**, pela mesma razão dos outros dois: lá o time vem de
  um CÓDIGO e ninguém tem golpe escolhido, então o motor cai no de tipo e não há id pra consultar na
  tabela. A única porta que sobra é o **METRÔNOMO**.
- `tools/test-especiais.js` tranca 44 pontas: os seis golpes e as quatro chances medidas com **um
  rng contínuo**, que eles existem na tabela, o Ácido fora, o Agulha Dupla sendo o único de fora do
  tipo e continuando multi-tapa, 26 espécies LEVANDO de verdade, as duas imunidades (com a do Veneno
  nomeada como acréscimo), o alvo caído e o já envenenado, o 1/8 sendo o dobro da queimadura, que
  ele **não corta atributo nenhum**, os dois nunca caindo juntos, **a Faixa segurando e sendo
  gasta**, as duas frases, o selo 🟣 só a partir do passo, o lado da barra, o HTML do log sem `−0 de
  HP`, a marca solta em 400 batalhas, as duas saídas antecipadas do rng e 120 batalhas batendo golpe
  a golpe nos dois motores.

### A FÚRIA DO DRAGÃO: 40 FIXOS NA ABERTURA (11/09/2026)

Pedida assim: *"adicione a habilidade passiva furia do dragão para os pokemons que possuem esse
move, quando começar a batalha, o pokemon que tem esse move tem 10% de chance de já infligir -40hp
no inicio da batalha no adversario. Então quando entrar a furia do dragão, o oponente começa a
batalha perdendo 40 de hp e depois disso o motor deve calcular a batalha como se fosse uma nova
batalha começando"*. É o **nono golpe especial**, ao lado do sono, da autodestruição, do Metrônomo,
do Disable, do Recuperar, da drenagem, da fúria e da confusão.

- **É o mais simples do bloco inteiro, e isso é a feature:** não sorteia dano, não olha tipo, não
  olha atributo, não tem crítico. São **40**, sempre — como no jogo oficial.
- **É ABERTURA e NÃO resolve o confronto** (`continue`, como o Recuperar, a anulação, a drenagem, a
  fúria e a confusão; só a autodestruição e o sono resolvem). A luta acontece INTEIRA depois, que é
  o pedido ao pé da letra. Medido: **1.053 de 1.055** confrontos com ela têm luta depois; os 2 que
  não têm são o outro lado EXPLODINDO na mesma abertura, e isso já valia pra todas as outras
  aberturas. O teste cobra que não exista um terceiro caso.
- **NÃO MATA: piso de 1 de HP**, a mesma regra da drenagem e da confusão. Um efeito de abertura que
  resolvesse o confronto sozinho seria um confronto sem um único golpe na tela — e o pedido diz que
  a luta vem DEPOIS. Medido: **0 mortes em 1.055** disparos.
- **O DANO GRAVADO É O EFETIVO, não os 40 crus.** Num alvo com 12 de HP a linha diz **11**, que é o
  que a barra vai andar. É a regra do diário desde sempre: com o valor cru a soma das linhas passa
  do HP que o pokémon tinha. E quem já está em **1** não gera linha nenhuma — um passo de dano 0 é
  o que este log evita em toda regra.
- **SÃO 7 ESPÉCIES**: a linha do Charmander (Charmander, Charmeleon, Charizard), o **Gyarados** e a
  linha do Dratini (Dratini, Dragonair, Dragonite).
  **A lista saiu da base (`data/golpes.json`) por script, não foi escrita à mão** — são as que
  aprendem `dragonrage` por NÍVEL na Gen 3, a mesma regra das outras sete listas.
  **A intuição erra: não são "os dragões".** A linha do Charmander aprende MESMO (nível 43/48/54 no
  FireRed), e o Dragonite aprende no 22 igual ao Dratini.
  `tools/test-golpes.js` passou a cruzar esta lista com a base junto das outras cinco: ela bate
  **7/7**, e é esse cruzamento que garante que ela CONTINUE saindo do dado.
- **ELA NÃO DISPUTA VAGA DE GOLPE, e isso é DADO e não decisão:** o `dragonrage` tem **poder
  variável**, e os 22 golpes de poder variável ficaram fora da tabela `GOLPES` quando a base da
  Gen 3 entrou (ver a seção da base). Ou seja, ela nunca foi escolhível — **sem esta passiva o
  golpe não existia no jogo**, e a ficha da Pokédex é hoje o único lugar em que ele aparece. Se um
  dia o `dragonrage` entrar na tabela, esta passiva passa a modelar a mesma coisa duas vezes: há um
  teste que grita nesse dia.
- **ELA VEM POR ÚLTIMO NO SORTEIO, depois até da confusão**, e é a decisão de sempre: acrescentar um
  efeito no FIM da fila não dilui nenhum dos que já estavam medidos — quem paga a chance composta é
  ela. Medido: a linha do Charmander, que já tem **Fúria (30%)**, dispara esta em **7,04%**
  (0,7 × 10%); o Gyarados e a linha do Dratini, que não têm outro especial, ficam nos **9,99%**.
- **O `q` DO REGISTRO É DE QUEM USOU, não de quem apanhou** — a convenção do diário, a mesma do
  sono, da confusão e do dano da drenagem. É ela que faz a animação mover a barra do lado certo (o
  passo comum inverte o `q` pra achar quem APANHA). Trocar isso não aparece como erro: aparece como
  o pokémon errado perdendo vida.
- **⚠️ ELA É A TERCEIRA DA FAMÍLIA "HP QUE SUMIU SEM SER GOLPE DO ADVERSÁRIO"**, ao lado do
  `absorbdano` e da `confusao` — e a lista dos três estava **copiada à mão em QUATRO contas** do
  `tools/test-especiais.js`. Isso já tinha custado um flake antes: o `absorbdano` era o único da
  família e o teste não o descontava, e só virou visível quando a confusão tornou a combinação
  frequente. Agora a lista vive numa função só (`danoSemGolpe`), e o próximo efeito desta família
  entra numa linha. Quatro cópias garantiriam que a quarta ficasse pra trás — falhando raro e
  intermitente, que é o pior tipo de teste.
- **O SELO É 🐉 e o tipo é DRAGÃO** (`TIPO_DO_ESPECIAL`), e ele é o **único especial de tipo
  Dragão**. Isso não é enfeite: a **Fúria** comum é Normal, tem nome parecido e mora na MESMA linha
  do Charmander — o Charizard aparece na ficha com as duas, uma no cinza e outra no roxo, e é a cor
  que as separa de relance.
- **A FICHA ANUNCIA A CHANCE NOMINAL (10%), não a composta (7% no Charizard)** — e isso não é
  descuido novo: é a convenção que já vale pro Kadabra (Disable 10% + Recuperar, que na prática sai
  em 9%). O número na tela é o da REGRA daquele especial; a composição vem de quantos especiais a
  espécie tem, e escrever "7%" ali faria a mesma passiva anunciar números diferentes de espécie pra
  espécie sem nada explicando por quê. Fica registrado porque o Charizard é o caso mais visível
  disso no jogo — ele é o único que mostra dois especiais de nome parecido lado a lado.
- **VALE 2 PASSOS no `passosDaAbertura`**, como a drenagem, a fúria e a confusão: a frase tem que
  sobreviver ao movimento de barra que ela anuncia. Com 1 ela sumiria justamente no passo que
  existe pra explicar; fora da tabela ela valeria pra SEMPRE (o defeito que a anulação teve).
- **A FRASE DO LOG TRAZ O NÚMERO**, e ela é a única do bloco que traz: *"🐉 Gyarados usou Fúria do
  Dragão e tirou 40 de HP de Machoke"*. São sempre 40, e é justamente isso que surpreende quem vê um
  Dratini Lv.22 e um Dragonite Lv.70 tirando a mesma coisa. No aviso do meio da batalha ela sai
  CURTA, sem o número, como a do sono e a da confusão: ali se lê em um segundo e a barra descendo
  já mostra quanto foi.
- **O Mew e o Mewtwo são imunes**, como ao bloco inteiro: o `tentarGolpeEspecial` corta quando um
  dos dois está no confronto. Nenhum dos dois aprende o golpe, então a lista nem os mencionaria —
  o teste cobra a imunidade mesmo assim, porque um Gyarados tirando 40 por confronto do Mew da
  raide seria de graça.

**O QUE 40 SIGNIFICA, MEDIDO — e é isso que explica todo o resto.** Neste motor todo golpe é uma
fração da vida do alvo, então um número CRU pesa muito diferente conforme o nível:

| | Lv.22 | Lv.30 | Lv.45 | Lv.60 | Lv.75 | Lv.90 |
|---|---|---|---|---|---|---|
| Dratini | **22,1%** da barra | 18,1% | 13,5% | 10,8% | 9,0% | **7,7%** |
| Gyarados | 17,0% | 14,5% | 11,4% | 9,4% | 8,0% | 7,0% |
| Dragonite | 17,3% | 14,8% | 11,6% | 9,5% | 8,1% | 7,0% |

É o mesmo desenho do jogo original — **forte cedo, lembrança depois** —, e é por isso que ela não
precisa de teto: o crescimento do jogo a aposenta sozinha.

**O PREÇO POR BATALHA, num 6x6 calibrado no empate** (os 6 da Fúria do Dragão nível 60 contra 6 sem
ela de BST pareado — Snorlax, Tyranitar, Typhlosion, Marowak, Ivysaur, Geodude —, 6.000 batalhas de
cada lado): **43,92% sem contra 51,20% com, +7,28 pontos**.
(Medida com o Snorlax do painel ainda no Metrônomo, horas antes de ele sair. Os DOIS lados do A/B
tinham o mesmo painel, então a diferença continua valendo; o que mudou depois foi só o ponto de
calibragem, que sobe um pouco com o painel enfraquecido.)
**Mas o número honesto é a conversão em NÍVEL**, porque esse painel é hipersensível: medido, **1
nível dele vale 13,2 pontos** (o controle vai de 57,15% no Lv.53 a 43,92% no Lv.54). Ou seja, a
Fúria do Dragão vale **≈0,55 nível** — bem abaixo da **Fúria comum (≈2,3 níveis)**, do terreno e do
shiny (~15 níveis). Ela está mais perto da especialidade do que dos buffs de time.

**O PREÇO NA JORNADA: NADA — é o primeiro especial desta série que não move a conta nem um pouco.**
**70,05% contra 70,18%** de conclusão, **−0,13 ponto, 0,2σ** (10 blocos de 1.500 jornadas de cada
lado, **15.000 de cada**, com o desvio tirado de ENTRE os blocos, nunca do binomial). Não dá pra
distinguir de zero, e a direção é até negativa — ou seja, ruído puro.
Faz sentido por dois motivos somados, e é a conclusão de sempre aqui: são **7 espécies em 250**, e
elas caem dos DOIS lados — o Charizard do rival (de quem escolheu o Bulbasaur) e o time quase
inteiro da Clair. Some a isso o que a tabela acima mostra: os 40 pesam justamente no COMEÇO da
jornada, e é lá que as sete são raras no time do jogador — só quem escolheu o Charmander já começa
com uma.
**MAS A FORMA SE MOVE UM POUCO, e num lugar só: o 8º ginásio.** Medido em duas amostras
independentes (3.000 e 2.500 jornadas de cada lado), os game overs lá sobem ~**12%** (607 → 683
somando as duas), enquanto o 1º, o 5º e o 6º ficam parados dentro do ruído.
**A causa tem nome: a Clair.** O time dela é `Dragonair ×3, Gyarados, Kingdra, Dragonite` —
**cinco dos seis carregam a passiva**, e ela é a ÚNICA equipe de líder do jogo em que isso
acontece (conferido nos 16 ginásios das duas regiões). Ou seja, o efeito líquido da mecânica é
tornar o último ginásio de Johto um pouco mais duro, e é aí que ela aparece.
Se um dia isso incomodar, o lugar de mexer NÃO é a chance: é o time da Clair — ele é o único ponto
do jogo onde a passiva se concentra.

- **Se um dia incomodar, os lugares de mexer são a CHANCE (`CHANCE_FURIA_DRAGAO`) e o DANO
  (`FURIA_DRAGAO_DANO`)**, e a régua está aqui. Mexer no dano é o mais forte dos dois, porque ele é
  a coisa toda: os 40 não escalam, então dobrá-los dobra o efeito no começo do jogo e quase não se
  vê no fim.
- `tools/test-especiais.js` tranca as pontas: a lista e a chance iguais nos dois motores, os 40
  exatos, o piso de 1, o dano EFETIVO na linha, o alvo já em 1 sem linha nenhuma, a imunidade dos
  chefes, a luta acontecendo depois em 100% dos casos (ou a explosão), o `q` de quem usou, a barra
  do adversário sendo a que anda, a frase aparecendo no passo 0 e sobrevivendo ao passo da barra, e
  as duas chances compostas (7% no Charizard, 10% no Gyarados). E a comparação das 300 batalhas
  entre os dois motores passou a **COBRAR que ela apareça** — sem essa linha ela daria verde sem
  nunca ser tocada, e uma divergência aqui faz a mesma batalha terminar diferente no cliente e no
  servidor.

### O SKETCH DO SMEARGLE (10/09/2026)

Reportado assim: *"como podemos fazer o Smeargle ficar mais parecido com o jogo oficial? Porque
hoje ele tá bem ruinzinho com apenas 1 ataque"*.

- **No jogo oficial ele não aprende golpe de dano NENHUM por nível.** O que ele aprende é **Sketch**,
  dez vezes (níveis 1, 11, 21… 91), e cada Sketch **copia permanentemente** o golpe que o adversário
  acabou de usar. É uma espécie de BST 250 e ataque 20 — o corpo mais fraco do jogo — em cima de um
  repertório que ela constrói lutando.
- **Aqui é a mesma coisa, e de QUALQUER adversário que ele enfrentar** (não só de quem ele derrota,
  que é o que o jogo original faz). O golpe entra no `sketch` da INSTÂNCIA — e por isso vai junto no
  save, que serializa o time inteiro. Dois Smeargle de saves diferentes têm repertórios diferentes,
  que é justamente o ponto.
- **A OFERTA REUSA O FLUXO QUE JÁ EXISTIA.** A tela *"Smeargle quer aprender um golpe novo!"* já era
  exatamente isso; só mudou de onde vem a lista. Ele continua levando até `MAX_GOLPES`, continua
  podendo recusar (e **sketch recusado fica recusado**, senão a pergunta voltaria pra sempre — é o
  carrossel infinito de 09/09/2026), e a tela de escolha lista o que ele copiou **mais o que ele já
  carrega**, pela mesma razão de sempre.
- **Ele entra nos DOIS fins de batalha** (`finishBattle` e `finishSpecialBattle`), ao lado da
  evolução no desmaio. Deixar num só era garantir que a Elite — que é o caminho especial — ficasse
  sem copiar nada; é o defeito que a evolução já teve.
  **E só nesses dois: desde 11/09/2026 ele só copia na JORNADA** — ver o item logo abaixo.
- **⚠️ O SKETCH SÓ COPIA NA JORNADA desde 11/09/2026, e o vazamento era REAL — não era só
  precaução.** Pedido assim: *"se usarem o Smeargle em uma liga online, no ginásio ou na torre dos
  treinadores, ele NÃO deve aprender novas habilidades, as habilidades dele só vai ser aprendida
  durante a jornada"*.
  **O CAMINHO QUE VAZAVA, reproduzido antes do conserto:** o **Ginásio da Cidade usa a MESMA tela
  `battling`** da jornada, e o `aceitarConvite` faz `if(game.screen === 'battling') finishBattle()`
  — aceitar um convite online **no meio da revelação de um desafio de ginásio** caía no
  `registrarSketch` com os matchups DELE. Conferido: com o contexto `neighborhoodGym` ele copiava
  o `earthquake` do adversário.
  **E o estrago seria pior que copiar de onde não devia:** o Smeargle que ele acha vem do
  `game.team`, que é a **jornada aberta** — e no Ginásio da Cidade e na Torre o time é montado a
  partir de VÁRIOS saves e não é o `game.team`. Ou seja, o golpe entraria num Smeargle que **nem
  lutou aquela batalha**.
- **A GUARDA MORA DENTRO DO `registrarSketch`, não nos chamadores** (`if(!ehJornada()) return []`),
  e isso é a decisão. Ele é a **única porta** por onde a lista cresce; fechá-la por dentro é o que
  impede um chamador futuro de reabri-la sem ninguém ver. Fechar no chamador seria confiar em três
  lugares em vez de um — e foi um chamador que criou o problema.
  Quem responde é o **`battleResultContext`**: null na jornada, `'neighborhoodGym'` no desafio do
  Ginásio da Cidade.
- **OS OUTROS MODOS JÁ NÃO CHEGAVAM LÁ, e a guarda vale pra eles assim mesmo.** A **Torre** roda na
  tela `trainerBattling`, com fluxo próprio; as **ligas** e o **online** resolvem tudo no servidor.
  Nenhum dos três chama o `registrarSketch` hoje — mas a guarda passa a valer no dia em que algum
  deles reusar este caminho, que é exatamente o que o Ginásio da Cidade fez.
  Some a isso o que já valia: adversário de liga/online luta pelo **motor de tipo** e não tem
  `enemyMoveId`, então ali nunca houve o que copiar.
- **O TESTE LÊ O CÓDIGO**, e precisa: os casos chamam o `registrarSketch` direto, então uma guarda
  movida pro chamador passaria por eles e deixaria a próxima porta aberta. Ele cobra que a guarda
  está DENTRO da função, que só **dois** lugares a chamam (`finishBattle` e `finishSpecialBattle`,
  os dois da jornada) e que o `finishNeighborhoodGymBattle` **não** chama. Conferido que ele falha
  em 2 casos com a guarda removida.
- **⚠️ FICA UM DEFEITO CONHECIDO NO MESMO CAMINHO, e ele NÃO foi mexido porque não foi pedido:**
  aceitar um convite online no meio da revelação de um desafio do Ginásio da Cidade chama o
  `finishBattle` da JORNADA, que além do sketch também faz `game.badgesEarned.push(gymAtual().badge)`
  e conta derrota — ou seja, **dá ou tira insígnia da jornada por causa de uma batalha de ginásio
  de cidade**. O conserto natural é o `aceitarConvite` olhar o `battleResultContext` e chamar o
  `finishNeighborhoodGymBattle` nesse caso; a guarda do sketch não cobre isso, porque ela protege
  só a porta dela.
- **Adversário sem golpe escolhido não vira sketch.** Liga, online e save antigo atacam pelo motor
  de tipo e não têm id de golpe — ali não há o que copiar, e é o certo: no jogo original o Sketch
  também não copia o que não é um golpe.

- **⚠️ O SKETCH ENTROU NA FICHA DA POKÉDEX EM 11/09/2026, e a mecânica NÃO foi tocada.** Pedido
  assim: *"colocar no Smeargle a habilidade passiva Sketch, só indicar na pokedex como as outras
  hoje, não precisa mexer em nada na mecânica dela, e também adicionar a explicação do que ela
  faz"*. É uma linha no `especiaisDaEspecie` e uma entrada no `EXPLICACAO_DO_ESPECIAL` — ver a
  seção **A CAIXA QUE EXPLICA O ESPECIAL**.
  **Antes disso a ficha do Smeargle saía MUDA**, e ele é justamente o único pokémon do jogo que
  constrói o próprio moveset: quem abrisse a ficha dele via BST 250 e um Tapa Duplo de poder 15, e
  nada explicando por que valeria a pena levá-lo.
  **ELE É O ÚNICO DA LISTA QUE NÃO MORA NO `tentarGolpeEspecial`**, e por isso ganhou um quarto
  valor de momento na caixa — **"Depois da batalha"**. Os outros nove abrem ou resolvem um
  confronto (ou, no Metrônomo, valem a cada golpe); este acontece quando a luta acabou, no
  `registrarSketch`. Escrever "abre o confronto" nele seria a mesma classe de erro que o sono teve.
  **SEM CHANCE DECLARADA** (`chance: null`), como o Metrônomo: ele não é sorteado, acontece sempre.
  Um "100% por confronto" ali diria menos que nada.
  **CONFERIDO QUE É SÓ APRESENTAÇÃO, por impressão do motor:** 1.500 batalhas com um Smeargle de
  repertório copiado mais o próprio `registrarSketch` dão o **MESMO hash** com e sem a entrada na
  ficha. É o mesmo método que provou que passar o diário de golpes pro matchup não mudava um ponto
  de dano.
**O PROBLEMA MEDIDO, e ele não era o que parecia.** A primeira medição usou um painel forte
(Machamp, Snorlax, Rhydon nível 50) e deu **0% pra tudo**, inclusive com o golpe mais forte do jogo
— o que sugeria que o gargalo era o atributo. Contra um painel **do tamanho dele** é o contrário:

| Smeargle Lv.30, painel de BST 215–415 | vitória |
|---|---|
| hoje (só Tapa Duplo, poder 15) | **5,9%** |
| com 3 golpes fortes do jogo (teto) | 76,3% |

No Lv.50 o de hoje cai pra **0,2%**, porque o golpe dele não cresce. **A lição é sobre a medição:**
um painel forte demais achata tudo em zero e faz o gargalo parecer outro.

**O QUE O SKETCH ENTREGA, simulado num Smeargle atravessando 40 confrontos no nível 30:**

| | copiados | leva | vitória |
|---|---|---|---|
| início | 0 | Tapa Duplo | 6,3% |
| 10 confrontos | 8 | Submissão, Batida, Quebra-Telha | 9,5% |
| 30 confrontos | 21 | Comedor de Sonhos, Submissão, Batida | 17,7% |
| 40 confrontos | 26 | Comedor de Sonhos, Submissão, Batida | **18,3%** |

Ele passa a **brigar, sem virar forte** — um Dunsparce comum de rota faz **91%** no mesmo painel.
É o mesmo desenho do Ditto, e a mesma frase serve: *ele escolhe melhor, não fica mais forte*.

- **O TAPA DUPLO CONTINUA sendo o golpe inicial dele, e isso foi MEDIDO, não herdado.** Ele é
  invenção da nossa regra de cobertura de tipo (no jogo oficial não existe), e a tentação era tirá-lo
  por fidelidade. Sem golpe nenhum ele cai no motor de tipo e ganha **2,4%**, contra **6,3%** com o
  tapa: o golpe de vários tapas rende mais que o poder implícito de 60 num corpo de ataque 20.
  Tirá-lo deixaria o Smeargle recém-capturado **pior** do que está.
- **A jornada não foi medida, e é de propósito:** o Smeargle está em 2 pools de rota, então ele
  aparece em pouquíssimas jornadas — o número sairia dominado por ruído e não diria nada. O que
  vale aqui é a medição por confronto, acima.
- **Nada disso foi pro servidor.** O `sketch` é a lista de onde a OFERTA sai; o que viaja pra
  batalha é o `ataques`, que já viajava. `tools/test-ataques.js` tranca as onze pontas.

### O golpe da forma anterior NÃO se perde na evolução (09/09/2026)

Reportado com o caso exato: a **Staryu aprende Raio de Bolhas no 28 e a Starmie não ensina esse
golpe em nível nenhum**. Quem evolui com ele tem que continuar com ele, e só dali pra frente passa
a valer o moveset da forma nova.

- **A evolução em si NUNCA tirou golpe** — medido: o `tryEvolve` troca espécie, tipos e os seis
  atributos, e não encosta no campo `ataques`. A fila de aprendizado também não tira nada: ela só
  OFERECE, e quem troca é o jogador na tela.
- **Quem tirava era a TELA DE ESCOLHA, e só ela.** Ela montava a lista com `ataquesDisponiveis`,
  que é o moveset da espécie ATUAL — então uma Starmie que passasse por ali veria quatro opções
  sem o Raio de Bolhas, e o golpe herdado sumia por não estar na tabela da forma nova. O mesmo
  valia pro auto-preenchimento silencioso (2 ou menos disponíveis), que sobrescrevia o campo.
- **`ataquesEscolhiveis(p)`** é a lista certa: o que a espécie ensina até aquele nível **mais o
  que o pokémon já carrega**. As três portas usam ela agora — a tela, o `confirmarAtaques` (que é
  quem valida de verdade) e o auto-preenchimento.
- Isso vale pra qualquer degrau, não só o da Staryu: são **13 golpes** que a forma antiga ensina
  acima do nível da evolução e a nova nunca ensina (ver "O que foi medido e NÃO foi mexido").
  Continuam inalcançáveis pra quem nunca os teve — o que muda é que quem OS TEM não os perde mais.

### A DANÇA DA CHUVA: O PRIMEIRO CLIMA DO JOGO (11/09/2026)

Pedida assim: *"10% de chance de acontecer na batalha ... vai durar por 3 confrontos, e durante
esses 3 confrontos, os ataques de tipo água vão ter um acréscimo de dano de 50%, e os ataques de
fogo, solar beam e solar blade, perdem 50% ... os ataques elétricos têm um acréscimo de 25%.
Durante a batalha, coloque algum símbolo na tela"*.

**⚠️ ELA NASCEU SORTEADA ANTES DA BATALHA E DUROU UMA VERSÃO.** "10% de chance de acontecer na
batalha" foi lido como um dado só, rolado no `simulateGymBattle`. O pedido era outro, e foi
esclarecido no mesmo dia: *"ele é por batalha mas a chance é sorteada quando o pokémon que possui
essa habilidade passiva entra no confronto que deve ser ativada ou não"*.
**O "POR BATALHA" É O EFEITO, NÃO O SORTEIO** — e essa é a frase que resume a seção inteira. O dado
rola na ABERTURA de cada confronto em que um dos 13 entra, como todo o resto deste bloco; o que é
POR BATALHA é a **DURAÇÃO**: começou, ela atravessa `CHUVA_EM_CONFRONTOS` (3) confrontos, e é **o
único efeito do motor que passa do confronto em que nasceu**.

- **O SORTEIO MORA NO `tentarGolpeEspecial`**, que é onde "o pokémon entra no confronto" já
  acontece: esse bloco roda UMA VEZ por confronto (o marcador `_especialContra`, no `doExchange`).
- **MAS COM DADO PRÓPRIO, fora do `sorteiaGolpeEspecial`**, e isso é decisão: aquele devolve UM
  efeito por pokémon por confronto, então pôr a chuva lá faria o **Gyarados** — que já tem Fúria do
  Dragão — cair na chance composta e a chuva sair em **9%**. O pedido diz 10%. E clima não é um
  golpe usado CONTRA o adversário: é uma condição do campo.
- **OS DOIS LADOS SORTEIAM, um dado cada.** Num confronto em que os dois têm Dança da Chuva a
  chance daquele confronto é **19%**, não 10% — medido, 19,29%. Com um portador só, 9,86%.
- **ENQUANTO CHOVE NINGUÉM SORTEIA DE NOVO: ela não se renova.** No jogo oficial usar o golpe outra
  vez reinicia o contador; isso não foi pedido, e faria o clima virar quase permanente num time de
  Água. Se um dia for pedido, é trocar o `if(estaChovendo()) return false`.
- **⚠️ MAS ELA PODE SAIR MAIS DE UMA VEZ NA MESMA BATALHA**, e isso é consequência direta do
  sorteio ser por entrada: acabados os 3 confrontos, o portador que entrar no seguinte sorteia de
  novo. Medido: **0,9% das batalhas com chuva** têm dois trechos — e dois trechos colados se leem
  na tela como um só de 4+ confrontos. **Não é defeito**, e o teste sabe disso: ele exige que todo
  trecho maior que 3 tenha um portador em campo no confronto em que a segunda chuva começaria.
  Foi um `00001111` que ensinou isso — o Azumarill do adversário chamou no 5º e o Blastoise do
  jogador chamou de novo no 8º.
- **ELA RESPEITA A IMUNIDADE DO MEW E DO MEWTWO**, que está uma linha acima dela no
  `tentarGolpeEspecial`: eles são imunes ao bloco INTEIRO, e abrir exceção pro clima faria a
  batalha deles se comportar diferente sem ninguém ter pedido.

- **VALE PROS DOIS LADOS.** Clima é do CAMPO, não de quem o invocou — é assim no jogo oficial, e o
  pedido não põe lado nenhum. **Quem chama a chuva também fortalece o golpe de Água do
  adversário.** É a decisão que mais segura o número.
- **ELA MEXE NO NÚCLEO DO DANO**, e é a primeira coisa desde o `EXPOENTE_TIPO` que faz isso. Por
  causa disso ela entra em **TRÊS lugares com o mesmo valor**: o `calcDamage`, a `nota` do
  `melhorAtaque` e a `nota` do `bestAttackType` — todos lendo o mesmo **`multDaChuva`**.
  **Se entrasse só no dano, o motor escolheria por uma regra e aplicaria outra** — sob chuva o Raio
  Solar continuaria sendo escolhido como se valesse 120. É literalmente a lição do `EXPOENTE_TIPO`.
- **A LISTA são 13 espécies** — a linha do Squirtle, Poliwag e Poliwhirl (o Poliwrath não aprende),
  Gyarados, Lapras, a linha do Marill, a do Wooper, Suicune e Lugia. Saiu da base por script. O
  **Lugia** está nela por ser o que o dado diz, como no `RECUPERACAO`: ele é INTOCÁVEL e a entrada
  não roda hoje.
- **⚠️ A LÂMINA SOLAR NÃO EXISTE NA BASE DA GEN 3** — ela é da Gen 7. O pedido citava as duas, e só
  o **Raio Solar** pôde entrar; cadastrar a outra seria letra morta, o mesmo motivo que manteve os
  estágios 2 a 4 do crítico fora do jogo. O teste **NOMEIA a ausência**.
- **⚠️ O CAMPO `chuva` DO CONFRONTO É `!!comChuva`, NUNCA `comChuva || undefined`.** Ele nasceu
  assim e derrubou as duas ligas por dois dias: o log da liga vai pro Firestore, que **recusa**
  `undefined` e junto com ele a gravação inteira. No cliente o mesmo código é inofensivo (o
  `JSON.stringify` some com a chave) — é a armadilha de uma linha que vive nos DOIS motores e só
  num deles vira documento. Ver **UM `undefined` MATOU AS DUAS LIGAS**, na seção da Trainers League.
- **O ESPELHO DA CONFUSÃO NÃO SENTE CLIMA** (`op.semTipo`): no jogo oficial ele bate sem tipo, e sem
  essa guarda a chuva mudaria o dano dele e **todas as medições da confusão deixariam de valer**.
**NA TELA SÃO TRÊS COISAS DIFERENTES, e a divisão foi pedida olhando um print (11/09/2026).** A
primeira versão tinha só uma faixa 🌧️ repetida em todo confronto com chuva — informação demais e
explicação de menos. Hoje:

- **1) A FRASE NO MEIO DA BATALHA, no confronto em que ela ATIVA:** *"Squirtle usou Dança da Chuva e
  começa a chover"*, com a **pausa de 1s** e só então a luta começa. Pra isso a chuva virou uma
  **entrada de ABERTURA no diário** (`x:'chuva'`, dano 0), como o sono — e é isso que lhe dá a
  pausa: um passo de dano zero sem pausa apareceria e sumiria no mesmo quadro, que é o defeito que
  a Faixa de Foco já teve. Ela vale **2 passos** no `passosDaAbertura` pelo mesmo motivo do sono
  (ela É um passo da animação, então precisa cobrir o passo 0 mais o dela) e **cede o lugar ao nome
  do golpe** quando a luta começa.
- **2) A LINHA NO LOG, SÓ no confronto que ativou** — "somente na batalha que foi ativada a dança da
  chuva". Os confrontos seguintes herdam a chuva e **não repetem a linha**: repetir três vezes a
  mesma frase é a parede que o `TETO_GOLPES` existia pra evitar (ele acabou em 15/09/2026; a razão
  de não repetir a linha continua).
  **O SELO DELA É CLICÁVEL, e é o ÚNICO selo clicável do jogo** (`seloDeChuvaClicavel`). Tem o mesmo
  tamanho e a mesma cor dos outros — foi o que se pediu —, e o que muda é ser um `<button>`, que
  precisa zerar a borda e o padding de fábrica. Ele abre a MESMA caixa de explicação dos especiais:
  a pergunta que ele levanta ("por que meu Fogo tirou metade?") é a que a caixa já responde.
  O `<button>` é válido ali porque a linha do log é uma `<div>` — a armadilha do `<button>` dentro
  de `<button>`, que já custou dois defeitos neste projeto, não existe neste caminho; se um dia a
  linha do log virar clicável, é este o lugar que quebra.
  **⚠️ ESSE DIA CHEGOU em 16/09/2026**, quando o log passou a começar comprimido — e a previsão
  estava certa. O que salva é a ESTRUTURA: o botão envolve só o CABEÇALHO, e o passo a passo (que
  contém este selo) é IRMÃO dele. Há trava posicional pra isso — ver a seção do log comprimido.
- **3) O 🌧️ EM CIMA DO ×, em TODO confronto que teve chuva.** Ele fica no × de propósito: é o único
  ponto do cabeçalho que pertence aos DOIS lados, e clima não é de ninguém — é do campo. É ele que
  conta os confrontos 2 e 3, que não ganham linha.
- **E O SELO DE FAIXA CONTINUA nas QUATRO telas de batalha** (`chuvaBadgeHtml`), na forma do selo de
  terreno: ele é o vizinho na tela e já ensina a ler aquela faixa como "condição desta partida". É
  ele que responde "este confronto está sob chuva?" nos confrontos 2 e 3, onde a frase já cedeu.
  Ele **saiu do log**, onde virou a linha + o emoji.
- Tudo isso sai do **MATCHUP** (`m.chuva` e o registro do diário), não de um estado global: o log é
  relido dias depois, e ali o `chuvaRestante` já não existe. E o `m.chuva` é lido **DEPOIS** da
  troca de golpes, não antes — a chuva pode COMEÇAR naquele confronto, e lido antes o selo sumia
  justamente onde ela nasceu.

**⚠️ O VAZAMENTO DE ESTADO, E ELE ERA REAL NO SERVIDOR.** O `chuvaRestante` é módulo-level (como o
`explosaoDoAtivo` e o `itensGastos`), e **uma batalha acaba com chuva sobrando sempre que a luta
termina antes dos 3 confrontos**. No servidor a INSTÂNCIA é reaproveitada entre invocações — então
um `simulateGymBattle` (Torre, ginásio da cidade) deixaria o contador positivo e **o próximo ataque
da RAIDE ou o próximo confronto ONLINE sairia debaixo da chuva de outra pessoa**, sem nada na tela
dizendo isso. Os dois resolvem dano sem passar pelo sorteio.
Por isso o reset tem NOME — **`limparClima()`** — e não é uma atribuição solta em três lugares:
escrito à mão nos três, o quarto caminho nasceria sem, e o vazamento não aparece como erro, aparece
como um golpe de Fogo tirando metade sem explicação. Ele é chamado pelo `simulateGymBattle`, pelo
`simulateBossFight` e pelo `battleResolveMatchup`, e o teste **lê o código** pra cobrar os dois
últimos. No cliente o risco não existe: o `doExchange` só é chamado dentro do `simulateGymBattle`.
**A RAIDE E O ONLINE FICAM SEM CLIMA de propósito:** a raide é calibrada em ~399 ataques com o Mew
imune ao bloco inteiro, e o online resolve confronto a confronto — um clima de 3 confrontos não tem
onde caber ali. Fica em aberto, como os itens equipados.

**O QUE ELA FAZ, MEDIDO — e o número muda MUITO conforme o que se pergunta.**

**Por GOLPE, com o golpe fixo, ela é exatamente o que foi pedido** (mesmo golpe, mesma semente):

| | fora da chuva | na chuva | |
|---|---|---|---|
| Hidro Bomba (Água) | 2.269 | 3.402 | **×1,50** |
| Lança-Chamas (Fogo) | 314 | 157 | **×0,50** |
| Raio (Elétrico) | 211 | 261 | **×1,25** |
| Raio Solar | 2.650 | 1.325 | **×0,50** |
| Golpe de Corpo (Normal) | 86 | 86 | ×1,00 |

**Mas por BATALHA ela quase não move a taxa de vitória — e a causa é que o motor CONTORNA a
penalidade.** Como a chuva entra na escolha do golpe, um Charizard sob chuva **para de usar Fogo** e
passa a bater de Ataque de Asa. Medido em 8.640 pares atacante × alvo:

- a chuva **troca o golpe escolhido em 6,7%** deles;
- **206 pares largam um golpe de Fogo** e **136 largam o Raio Solar**;
- **223 passam a usar Água** e 18 a usar Elétrico;
- a fatia de Água entre os golpes escolhidos vai de **11,7% para 14,3%**, e a de Fogo cai de
  **7,0% para 4,6%**.

Ou seja: **ela muda QUAL golpe sai muito mais do que muda quem ganha.** É o mesmo desenho do Ditto e
do Smeargle — *escolhe melhor, não fica mais forte*. Num 1x1 contra painel calibrado no empate e com
a chuva forçada em 100%, todos os efeitos por espécie ficaram **dentro de 2σ**.

**NA BATALHA, medido com o sorteio por entrada** (time com um portador na 3ª vaga contra seis
adversários sorteados, 6.000 batalhas): ela sai em **13,1% das batalhas** e cobre **3,1% dos
confrontos**. Ela **começa tarde** — em 96% das vezes depois do 1º confronto —, e isso é justamente
a assinatura do sorteio por entrada: com o dado rolado antes da batalha ela começaria sempre no
confronto 1.

**O PREÇO NA JORNADA: nada. 69,15% contra 69,43%, −0,27 ponto, 0,5σ** (10 blocos de 1.500
jornadas de cada lado, **15.000 de cada**, desvio tirado de ENTRE os blocos). Faz sentido, e por
três razões que se somam: ela sai em **13% das batalhas**, cobre **3 confrontos** de uma batalha que
costuma ter mais, e **cai dos dois lados**.

- **Se um dia incomodar, os lugares de mexer são a CHANCE (`CHANCE_CHUVA`), a DURAÇÃO
  (`CHUVA_EM_CONFRONTOS`) e os MULTIPLICADORES (`CHUVA_MULT`)**. O mais forte dos três é a duração:
  é ela que decide quantos confrontos da batalha o clima alcança.
- `tools/test-especiais.js` tranca as pontas: as listas e os multiplicadores iguais nos dois
  motores, os quatro multiplicadores pedidos, que o resto dos tipos não muda, o dano medido por
  razão, que a chuva **troca o golpe escolhido** (dois pares reais, achados varrendo as 250×250 — a
  primeira tentativa foi um Venusaur × Geodude onde Planta é 4× e mesmo pela metade o Raio Solar
  ganhava, e o teste falhava sem nada estar errado), que o `poder` que vai pro dano continua CRU,
  que o espelho da confusão não sente clima, as duas chances (10% e 19%), que ela não se renova, que
  **começa depois do 1º confronto na maioria das vezes**, que nenhum trecho passa de 3 sem um
  portador pra explicar, que o estado não vaza, e que a ficha escreve "por batalha".
  **E as TRÊS coisas da tela**, cada uma separada: a frase palavra por palavra com a pausa de 1s e
  cedendo quando a luta começa, a linha do log saindo **só** no confronto que ativou (um confronto
  que só herdou a chuva tem o emoji e NÃO a linha), o selo sendo clicável e abrindo a caixa da
  chuva, o 🌧️ em cima do ×, e as quatro telas de batalha com a faixa.

### A FRASE DA PASSIVA NASCE NO PASSO DO EVENTO (12/09/2026)

Reportada assim: *"quando aparece as frases de habilidades passivas nos ataques, como sono,
autodestruição, dança da chuva, etc, a frase fica piscando na tela antes de ocorrer o evento,
ajuste para que nao fique assim"*.

- **E ficava mesmo — em 92,3% das frases de abertura**, medido em 11.338 confrontos. A janela
  começava no **passo 0**, que é o desenho que ANTECEDE a animação: a frase entrava, ficava 1,55s
  (os 550ms de sempre mais o segundo do `pausaDoEspecial`) contando algo que ainda não tinha
  acontecido, e só então o evento passava por baixo dela. Nas que não movem barra — sono, chuva,
  as duas danças — era pior ainda: a frase anunciava e a tela não mudava nada.
- **HOJE A JANELA COMEÇA EM `i + 1`, que é o passo do próprio evento.** A frase da confusão nasce
  no passo em que a barra do confuso desce; a da fúria, no passo em que o pokémon cresce; a do
  sono, no passo em que ele dorme.
- **O SEGUNDO DE LEITURA MUDOU DE LADO, e é isso que mantém o tempo igual.** Ele vinha do
  `pausaDoEspecial`, ANTES do primeiro passo; hoje vem da marca **`leitura`**, DEPOIS do passo —
  que já era como toda abertura fora do índice 0 funcionava desde 11/09/2026. O `i > 0` que
  excluía o índice 0 caiu junto. **Medido: a cena de um confronto continua em ~3,6s** (3.603ms →
  3.593ms) e os passos por confronto não se movem (3,06).
- **⚠️ A ANULAÇÃO É A ÚNICA EXCEÇÃO, e ela se identifica sozinha.** Ela não move barra e é
  **filtrada FORA da sequência** (não é um passo), então não existe passo de evento pra ela
  esperar — o passo dela É o 0, que é quando a anulação de fato acontece: antes do primeiro golpe.
  Quem separa os dois casos é o `ondeEstaNaSequencia`, que passou a devolver **-1** quando a
  abertura não está na sequência. Ele devolvia **0** nos dois casos ("está no primeiro passo" e
  "não está em passo nenhum"), o que era inofensivo enquanto toda frase começava no passo 0 e
  deixou de ser agora: sem o -1, a anulação esperaria por um passo que nunca chega e **nunca
  apareceria**.
  Ou seja: o `pausaDoEspecial` continua existindo, e hoje ele serve a **um** especial só.
- **A TABELA `passosDaAbertura` MUDOU DE SIGNIFICADO, e por isso os números caíram.** Ela contava
  "a pausa MAIS os passos"; hoje conta **só os passos do evento**. Quase todas viraram **1**
  (sono, fúria, confusão, Fúria do Dragão, chuva, as duas danças, cura, poção); a **drenagem fica
  em 2** porque ela mexe as DUAS barras, e o **Remoinho em 2** (quem sai + a vaga vazia) com o
  `remoinhoEntra` em 1.
  Quem for acrescentar um especial: o número é **quantos passos da animação a frase precisa
  cobrir**, e some com o passo 0 da conta.
- **E ISSO DESENTERROU A AUTODESTRUIÇÃO DE NOVO.** Ela não tem passo de SAÍDA de propósito (o
  confronto INTEIRO é aquilo), e o passo de ENTRADA dela tinha sido consertado em 12/09 pela
  metade — `(i === 0) ? 0 : i + 1` ainda a deixava começar no passo 0 no caso comum. Hoje ela
  também nasce no passo em que a explosão acontece.
- **MEDIDO DEPOIS: as frases anunciadas antes da hora vão de 2.147 para ZERO.** As 252 que a
  varredura ainda conta são os dois quadros de **CONTINUAÇÃO** — o `boomself` (a segunda entrada
  da explosão) e a **vaga vazia** do sopro —, onde a frase já estava na tela desde o passo
  anterior do MESMO evento. Não são anúncio adiantado: são a mesma frase seguindo.
- **CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois dá o **MESMO hash**
  em 900 batalhas semeadas. `passosDaAbertura`, `avisoDoConfronto` e `buildAnimatedHitSequence`
  **não existem no servidor** — é apresentação inteira.
- `tools/test-especiais.js` tranca o invariante que o pedido criou: **nenhuma das cinco aberturas
  medidas (sono, explosão, cura, drenagem, anulação) pode ter frase na tela antes do passo do
  evento dela**, e cada uma continua cedendo o lugar ao nome do golpe (menos a explosão, que fica
  até o fim). O helper `passoDoEvento` é quem sabe que a anulação vale 0 e o resto vale `índice+1`.

#### E O PISCAR QUE SOBROU ERA A ANIMAÇÃO DE ENTRADA RODANDO DUAS VEZES

Reportado logo depois: *"ainda está piscando um pouco a mensagem das habilidades passivas"*.

- **A janela já estava certa; o que repetia era o FADE-IN.** O pintor põe a frase no passo do
  evento e reinicia a animação de propósito (é o que separa dois golpes seguidos do mesmo lado);
  50ms depois o laço pede um `render()` por causa da marca `leitura`, e **o render recria o
  elemento** — então o `aviso-especial-entra` rodava de novo em cima do que tinha acabado de rodar.
  O jogador via a frase surgir duas vezes.
- **FRASE QUE JÁ ESTÁ NA TELA NÃO REENTRA.** Quem responde isso é o próprio DOM: o HTML do
  `statusDoConfrontoHtml` é montado ANTES de o `render()` trocar o conteúdo, então o elemento
  antigo ainda está lá com o que o jogador está vendo — comparar com ele é exato e não guarda
  estado nenhum. Igual ⇒ sai com `aviso-sem-entrada` (`animation:none`). O **pintor** ganhou a
  mesma guarda e devolve sem encostar no elemento.
  **Frase NOVA continua entrando normalmente** — é o que separa um golpe do seguinte.
- **A PAUSA FOI A 1,5s** (`PAUSA_LEITURA_ESPECIAL_MS`, era 1s), a pedido. Ela vale pras três portas
  de leitura: a marca `leitura` do passo do evento, a pausa da Faixa no meio da luta e a pausa de
  abertura da anulação. **Custo medido: +466ms nos confrontos que têm passiva** (17,2% deles) e
  +81ms na média de todos (4.914 → 4.995ms por confronto).
- **O SANDBOX DOS TESTES PRECISOU APRENDER QUE O MESMO id É O MESMO ELEMENTO.** O
  `getElementById` devolvia um stub NOVO a cada chamada, e com isso qualquer código que PERGUNTE o
  que já está na tela ficava invisível pro teste — a guarda acima é exatamente disso. Agora ele
  guarda um elemento por id, como o DOM de verdade.
- `tools/test-especiais.js` simula o laço (pinta no passo do evento, depois desenha) e cobra: nada
  no passo 0, a frase no passo do evento, o desenho seguinte **sem** reentrada, o pintor não
  encostando no que já está lá, e a frase nova entrando. Conferido que ele falha com a guarda
  removida (2 casos).

### O GOLPE APARADO NÃO APARECE COM O NÚMERO APARADO (12/09/2026)

Reportado com print de um **Bulbasaur × Onix**: *"o primeiro chicote de cipó tirou −45hp, e o
segundo −126, por que está tendo essa diferença tão grande sendo que nem era crítico?"*. E depois,
com o diagnóstico na mão: *"esse golpe moribundo não é de conhecimento do usuário, e a ideia é ele
nunca saber; se ele ver que o mesmo golpe, contra o mesmo pokémon, tá tirando danos muito
distintos, ele vai achar que o jogo tá bugado e vai começar a desanimar de jogar ... por que você
não somou o 126 + 45, dando 171, e então dividiu esse 171 ... assim vai passar a sensação de que
aquele era o dano médio mesmo que tiraria do oponente"*.

- **O MOTOR ESTAVA CERTO, e a causa é o diário gravar o dano EFETIVO** — a regra que faz a soma das
  linhas fechar com a barra. Um golpe que esbarra no fim de uma barra é escrito **menor do que
  foi**. Medido em 18.160 confrontos, em todo par de golpes do mesmo lado com razão acima de 2×
  (19,9% dos confrontos), o golpe PEQUENO era:

  | | |
  |---|---|
  | o golpe que **MATOU** (só tirou o que sobrava) | **76,8%** |
  | o alvo ficou no **piso do revide moribundo** (1%-10%) | **12,8%** |
  | um dos dois foi **crítico** | 6,3% |
  | confronto **reconstruído** (passou do teto) | 3,7% |
  | não explicado | 0,3% |

  **O print era o segundo caso, e dava pra provar pelo próprio print:** o Onix terminou em **9 de
  180 = 5,0% da barra**, no meio da faixa do piso. A ordem real foi `Onix −95 · Bulbasaur −126 ·
  Onix −19 (mata) · Bulbasaur −45 MORIBUNDO` — ou seja, a linha de CIMA era a ÚLTIMA coisa que
  aconteceu, empurrada pra frente pelo reordenamento (pra ninguém aparecer atacando com a barra em
  zero) e pequena porque o piso de 12/09 a aparou.
  **E ela não tinha como se explicar na tela**, porque o piso foi pedido MASCARADO.

- **A SAÍDA É REPARTIR, e ela cabe porque a luta JÁ ACABOU quando a tela desenha.** O motor resolve
  o confronto inteiro; o log e a animação são apresentação em cima do resultado. Então as linhas de
  um lado passam a mostrar o TOTAL dele repartido em fatias parecidas, em vez do dano efetivo golpe
  a golpe.
- **O TOTAL NÃO MUDA, e é isso que mantém tudo de pé**: a soma das linhas continua fechando com a
  barra (medido, **10.898 de 10.898** em todos os caminhos), o alvo termina exatamente onde
  terminava, e ninguém morre um golpe antes ou depois — as somas parciais só encolhem, então
  nenhuma barra chega a zero antes do golpe que a zerava.
- **A BANDA É A DA FÓRMULA, e agora ela mora num lugar só** (`JITTER_DO_GOLPE`, `fatiaDoGolpe`).
  Dois golpes do mesmo pokémon, com o mesmo golpe, contra o mesmo alvo, só diferem pelo sorteio de
  `0,85 + rng*0,15`: no máximo **1,176×**. Cada fatia fica entre **92% e 108%** da divisão igual —
  num par isso é exatamente os **46%-54%** que a reconstrução já usava desde 10/09/2026, e as duas
  passaram a ler a MESMA conta. Duas cópias divergiriam no primeiro ajuste, e aí um dos dois
  caminhos voltaria a mostrar par impossível.
  **O pedido falava em 40%-60%**; isso daria razão de **1,5×**, acima do que a fórmula produz — é a
  mesma faixa larga que foi estreitada em 10/09 justamente por isso. Se um dia se quiser a divisão
  mais solta, é uma constante.
- **⚠️ O CRÍTICO ENTRA PESANDO 2, e não fica de fora.** O selo dele promete que aquela barra caiu o
  DOBRO, então a linha tem que sair o dobro das outras do mesmo atacante. A primeira versão o
  excluía do bolo, e aí um crítico aparado ficava **menor** que os irmãos já acertados — o selo
  passava a dizer o contrário do que se vê, que é exatamente o defeito que o `cap` conserta.
  Foi a trava do selo que pegou, falhando **~1 rodada em 16**.
  O campo `c` do diário já nasce **zero** quando o corte comeu a dobra, então "pesa 2" é exatamente
  "esta linha vai mostrar o selo". Medido: a linha do crítico **nunca** sai menor que a do golpe
  comum do mesmo atacante (239 de 239).
- **O QUE FICA DE FORA:** o golpe de **vários tapas** (a linha dele é a SOMA de N e já traz o `Nx`)
  e o confronto com **FAIXA DE FOCO** (ela fixa a barra em 1 no passo dela; mexer nos números
  anteriores faria a barra chegar noutro valor e a frase prometeria um 1 que não se vê).
- **⚠️ ELE RODA ANTES DO `passosVisiveis`, no DIÁRIO — e essa ordem custou uma volta de conserto.**
  O campo `hp` é a vida do ALVO depois do golpe e é **CRONOLÓGICO**; a tela mostra outra ordem (o
  revide moribundo vai pra frente). Corrigindo `hp` na ordem da TELA o acumulado sai trocado e o
  diário passa a descrever uma luta que não aconteceu: medido, **259 cadáveres** na trava do
  "ninguém ataca com a barra em zero", com `hp` até **negativo**. Rodando antes, a ordem já é a do
  motor e a correção é exata (`hp_novo = hp_velho + acumulado_velho − acumulado_novo`).
- **O CAMINHO DO SONO TAMBÉM PASSA, e ele era o último resto.** Lá as trocas livres saem REAIS (uma
  linha cada, que é a coisa que o sono FAZ) e só o resto é reconstruído — então um golpe de verdade
  fica ao lado de uma linha que é a SOMA de vários. Medido antes: **61 lados, o pior em 56×**;
  depois, 7, o pior em 1,22×. Ali o `hp` é **apagado** nas linhas tocadas, de propósito: a lista
  mistura entrada real (que tem `hp`) com reconstruída (que nunca teve), e quem lê o diário pela
  tela passa a subtrair os próprios números mostrados — que é a conta certa.
- **ELE CLONA, nunca muta.** `sequenciaDoConfronto` é chamada a cada desenho da tela, e `m.golpes` é
  o diário de verdade: mutando, a segunda chamada suavizaria o suavizado e o log iria mudando de
  número sozinho. O teste cobra que o diário fica intacto e que três chamadas devolvem a mesma
  divisão (ela é **determinística**, semeada pelo próprio confronto — com sorteio, o log mostraria
  um número e a barra desceria outro).

**O QUE MUDOU, MEDIDO** (18.160 confrontos, o mesmo bot contra os dois builds):

| | antes | depois |
|---|---|---|
| pares FORA da banda da fórmula | **43,1%** | **0,9%** |
| pior razão vista | **294×** | **1,22×** |
| razão média | 3,64× | **1,08×** |
| linhas de golpe na tela | 50.509 | 50.509 |
| linhas de dano zero | 0 | 0 |

Os 0,9% que sobram são **arredondamento** (as fatias são inteiras, e num total pequeno — 27 e 32 —
o inteiro mais próximo passa de 1,176 por alguns centésimos): 89 no caminho normal com o pior em
1,20×, 7 no sono e 4 na reconstrução. Nenhum deles se distingue a olho do 1,176 que a fórmula já
produz.

**O CASO DO PRINT, antes e depois:**

```
antes                                       depois
😤 Onix entrou em fúria e cresceu            😤 Onix entrou em fúria e cresceu
Bulbasaur ... Chicote de Cipó   −30          Bulbasaur ... Chicote de Cipó   −82
Onix ... Lançar Pedra           −95          Onix ... Lançar Pedra           −76
Bulbasaur ... Chicote de Cipó  −131          Bulbasaur ... Chicote de Cipó   −79
Onix ... Lançar Pedra           −55          Onix ... Lançar Pedra           −74
(razão 4,37×)                                (razão 1,04×, mesma soma, Onix em 9)
```

- **CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois dá o **MESMO hash** em
  900 batalhas semeadas. O diário continua com os números reais — o que muda é só o que a tela
  desenha a partir dele.
- `tools/test-especiais.js` tranca: nenhum par fora da banda em 3.453 lados, a soma fechando com a
  barra em todos os caminhos, nenhuma linha de dano zero ou negativo, o crítico nunca menor que o
  golpe comum, o diário intacto, a divisão igual em três chamadas seguidas, e o log e a animação
  mostrando os mesmos números. Conferido que a trava **falha** com a suavização desligada (1.357
  de 3.453 pares, pior 261×).
- **Se um dia incomodar**, os lugares são o `JITTER_DO_GOLPE` (o quanto as fatias variam entre si)
  e a `RAZAO_DE_UM_GOLPE` (a partir de quando ela decide repartir).

#### ⚠️ O GOLPE QUE MATA SAIU DA SUAVIZAÇÃO (14/09/2026)

Relatado como uma pergunta: *"por que a minha Kingdra shiny tirou menos dano que a Kingdra normal?"*
— e o motor estava certo. Conferido: o shiny vale **1,20× nos cinco atributos e no HP** (405 → 420),
ele **não se perde em nenhum `createInstance`** do cliente e **sobrevive ao código de time**. No
espelho, a shiny bate **194 contra 132**.

**A causa era o golpe DELA ter sido o que MATOU** — o diário grava o dano EFETIVO, então o golpe de
180 dela virou a linha de 54 que sobrava. Só que a **suavização de 12/09** ainda repartia o par, e
isso fazia o CONTRÁRIO do que ela existe pra fazer: achatava um golpe forte de verdade **(262 e 159)**
num par morno, e o jogador comparava a linha dele com a do adversário achando o próprio pokémon fraco.

- **A REGRA NOVA, pedida palavra por palavra:** *"passa a ser o golpe REAL, porém o segundo golpe que
  mata vai tirar só o que resta de HP do adversário"*. Os golpes de antes mostram o tamanho **real** e
  o último mostra o **resto** — e **a soma continua fechando com a barra**, porque o resto É o que
  faltava. Medido: `[262, 159]` virou **`[325, 96]`**.
- **⚠️ SÃO DUAS FAMÍLIAS, e a função SEMPRE soube disso — ela é que tratava as duas igual.** O
  comentário dela já dizia: *"o golpe que MATOU (76,8%)"* e *"o REVIDE MORIBUNDO (12,8%)"*. Elas são o
  oposto uma da outra:
  - o **revide moribundo** é aparado por uma trava **MASCARADA por decisão** — o jogador não tem como
    saber por que o número encolheu, e sem a suavização ele lê *"o mesmo golpe escalou"*. **Esse
    continua sendo repartido**, que é pra isso que ela existe;
  - o **golpe que matou** se explica sozinho: a barra do cabeçalho mostra o alvo zerado.
- **⚠️ O SELO DE CRÍTICO FICA, inclusive num golpe final pequeno.** Cheguei a tirá-lo e desfiz: a
  regra nova é **uma só**, e esconder o selo ali criaria uma segunda regra pra explicar a primeira —
  o jogador perderia a informação de que aquele golpe foi crítico só porque o alvo estava acabando.
  O caso que REALMENTE contradiz a tela continua coberto pelo `cap` do motor (quando o corte come a
  dobra inteira, o campo `c` já nasce zero).
- **AS TRÊS TRAVAS QUE MEDEM RAZÃO ENTRE LINHAS GANHARAM A MESMA ISENÇÃO**, pelo mesmo motivo: a
  banda da fórmula, o selo do crítico e a escala do Rolamento. Um Rolamento que derruba no 2º uso
  encolhe sem que a escala tenha deixado de crescer — o fixture dele passou a exigir **dois usos
  escalados que não matam** (e um alvo mais duro, senão o Golem derrubava no segundo).
- **MEDIDO, e é o número que importa:** os pares fora da banda vão de **199 para 960** — e **ZERO
  ficam sem explicação, antes e depois**. Os 960 são 825 do golpe final (a regra nova) e 135 de
  crítico/Rolamento/multi-tapa (que já eram isentos). A soma fecha em **1.537 de 1.537**.
- **⚠️ E O QUE ISSO NÃO CONSERTA:** quando o confronto tem **UMA linha só** — o pokémon entra, bate
  uma vez e derruba um alvo que já chegou machucado — **não há primeiro golpe pra ficar grande**. Foi
  esse o caso do print. Medido: **79% dos lados com a linha pequena são uma linha só**, e a
  suavização nunca pôde agir neles. O que a tela não conta ali é que **o adversário entrou quase
  morto**: o cabeçalho mostra o HP do FIM (`0/421`), não o da entrada (`94/421`). Se um dia isso
  incomodar, é ali que se mexe.
- **CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois dá o **MESMO hash** em
  900 batalhas semeadas. A suavização vive no `sequenciaDoConfronto`, que é apresentação.

#### E duas correções de teste saíram junto

1. **A trava da cura cobrava o ÍNDICE 0** (`seq[0].x === (a cura)`), e outra ABERTURA pode
   legitimamente vir antes dela — as aberturas guardam a ordem do diário, e um Remoinho ou uma
   Dança das Espadas acontece antes. Medido: **7 de 376** confrontos, e como o caso roda com
   `Math.random` isso virava ~2 rodadas em 14. Conferido que a frequência é a MESMA antes e depois
   da suavização, ou seja é artefato antigo. Hoje ela cobra o que a regra promete: a cura vem
   **antes de qualquer golpe**.
2. **A conta da soma das linhas contava a AUTODESTRUIÇÃO pelo lado errado.** As duas entradas
   (`boom` e `boomself`) seguem a MESMA convenção do `q` que todo o resto do diário — quem causou
   está no `q`, o alvo é o outro lado. Contar o `boomself` invertido dava **136 falsos positivos em
   10.898**, todos com explosão.
### DUAS PASSIVAS NO MESMO CONFRONTO (11/09/2026)

Três defeitos reportados juntos, com print, e os três só aparecem quando o confronto tem **mais de
uma abertura** — que é o caso que nasceu comum quando o bloco de especiais passou de três pra onze.

- **⚠️ QUEM ESTÁ DORMINDO USAVA GOLPE ESPECIAL.** Relatado assim: *"o Smoochum utilizou a passiva
  dele Canto e fez o Magnemite dormir, porém depois apareceu que o Magnemite usou o Supersom pra
  deixar o Smoochum confuso, mas como ele conseguiu usar o Supersom sendo que ele deveria estar
  dormindo?"*
  Os DOIS lados sorteiam na MESMA volta do `tentarGolpeEspecial`, em ordem de velocidade — então o
  mais rápido adormecia o outro e o adormecido usava o especial DELE logo em seguida, na mesma
  abertura. A regra *"quem está dormindo não ataca nesta troca"* já existia, mas no `doExchange`,
  que roda DEPOIS deste bloco.
  Hoje o laço pula quem tem `_dormindoPor > 0`. Medido: **0 casos em 309 confrontos com sono**.
- **CADA ABERTURA GANHA O SEGUNDO DE LEITURA DELA.** *"Aparece a primeira mensagem e espera 1s e
  depois aparece a próxima tudo muito rápido e não dá para ler."* A pausa vinha de duas portas: o
  `pausaDoEspecial`, que só vale no desenho que antecede a animação, e a marca `leitura`, que só era
  posta em passo de **dano zero**. Uma segunda abertura que MOVE barra (confusão, drenagem, Fúria do
  Dragão) não pegava nenhuma das duas: a frase durava o tempo da barra e sumia.
  Hoje toda abertura fora do passo 0 é marcada, mexa barra ou não.
- **⚠️ A MARCA DA FAIXA E A DO DESEMPATE ERAM ACHADAS COM UM `findIndex` DO PRIMEIRO.** Um confronto
  pode ter as duas (a Faixa segura um golpe e, mais tarde, os dois caem na mesma troca), e a segunda
  ficava com "Trocando golpes..." no passo dela — com 1s de pausa e nada escrito. Hoje a marca é
  achada **pelo passo**.

**⚠️ E A ARMADILHA DESTE TRECHO, que custou uma volta inteira de conserto errado: o `passo` que
chega no `avisoDoConfronto` é o ÍNDICE DA SEQUÊNCIA MAIS UM.** Os quatro laços de revelação fazem
`HitStep++` **antes** de pintar a linha, então `passo === k + 1` quer dizer "animando `seq[k]`", e
`passo === 0` é o desenho que antecede a animação — o da pausa de leitura. É por isso que a janela
de uma abertura fora do índice 0 começa em `i + 1`: **esse É o passo dela.** Lido como se `passo`
fosse o índice, o `i + 1` parece um erro de um a mais e "consertá-lo" atrasa TODAS as frases em um
passo. O teste é quem tem a convenção escrita (o `perfil` monta `[0, 1..seq.length]`), e foi ele que
mostrou o engano.


### O REMOINHO: O SOPRO QUE TROCA O POKÉMON DO ADVERSÁRIO (12/09/2026)

Pedido assim: *"aplique a habilidade Whirlwind, onde acontece logo quando o pokemon que tem ela
entrar na partida, ela deve ter 20% de chance de sucesso, e quando acontecer, troca o pokemon ativo
do treinador adversario por um outro aleatorio do time dele. Importante que se o pokemon do
adversario ja tava em uma batalha e sofreu dano, quando ele voltar para a batalha, volte com o mesmo
tanto de hp"*. É o **décimo segundo** especial, e o primeiro que não é sobre dano nem sobre status.

- **⚠️ ELE NÃO CABE NO `tentarGolpeEspecial`, e é a primeira vez que isso acontece.** Os onze de lá
  recebem DOIS pokémon e mexem no que acontece entre eles; este muda **QUEM está no confronto**, e
  isso só o laço da batalha sabe fazer. Por isso ele mora no `simulateGymBattle`, num
  `tentarRemoinho` próprio, e por isso **não vale no ONLINE** (lá quem escolhe o próximo pokémon é o
  jogador, entre confrontos — um sopro forçado brigaria com a escolha) **nem na raide** (um alvo só).
- **⚠️ O LAÇO DA BATALHA FOI REESCRITO PRA ISSO, e essa é a mudança estrutural.** O inimigo era
  `brockTeam[brockIndex]` com o índice **só andando pra frente**: não havia como um pokémon sair do
  confronto sem ter caído e voltar depois. Hoje cada lado tem um **índice do ativo**, que é só "quem
  está em campo agora", e os dois laços aninhados ("enquanto este inimigo não cai") viraram **um
  só** — o de fora deixou de fazer sentido quando o inimigo passou a poder trocar sem cair.
  **E ISSO NÃO MUDA NADA sem o Whirlwind, por construção**: o índice só avançava quando o inimigo
  CAÍA, então ele já era exatamente "o primeiro vivo", que é o que a conta nova faz. O mesmo vale
  pro jogador, que era `alive[0]`. **Conferido por impressão: com a lista VAZIA o build dá o MESMO
  hash de antes da feature, em 900 batalhas semeadas.**
- **⚠️ E FOI ESSA IMPRESSÃO QUE PEGOU O ÚNICO DEFEITO DE VERDADE DA FEATURE.** A primeira versão
  sorteava o **desempate de velocidade** antes de saber se alguém tinha a passiva — ou seja, lia um
  número do RNG em TODO confronto, e isso **deslocava a semente inteira**: batalhas sem nenhum
  Pidgey no campo terminavam diferente. Hoje há uma saída antecipada (`!temAtivo && !temInimigo`), e
  o desempate só é sorteado quando **os dois** têm — que é o único caso em que a ordem importa.
  É a mesma lição do `op.semCritico` da confusão, ao contrário: lá a opção anula o RESULTADO e não a
  CHAMADA; aqui a chamada não pode existir.
- **A LISTA são as 6 espécies que aprendem `whirlwind` por NÍVEL na Gen 3**, a mesma regra das outras
  onze: a linha do **Pidgey** (19/20/20), o **Butterfree** (23) e **Lugia/Ho-Oh** no nível 1. Os dois
  lendários ficam por ser o que o dado diz — eles são INTOCÁVEIS e a entrada não roda hoje,
  exatamente como no `RECUPERACAO`. O teste cruza a lista com a base, como já faz com as outras.
- **O HP VOLTA SOZINHO, e não foi preciso escrever nada pra isso** — que é justamente por que ele
  precisa de trava. O laço trabalha sobre as MESMAS instâncias o tempo todo, então quem sai machucado
  volta com o que tinha; um "conserto" futuro que recriasse a instância quebraria a promessa sem nada
  acusar. Medido: **1.712 de 1.712 voltas com o HP idêntico**.
- **SÓ SAI SE HOUVER PRA ONDE TROCAR**, e quem decide isso é a SITUAÇÃO do time do outro, não o
  sorteio — com um pokémon de pé só não há quem entre no lugar. É a mesma regra do
  `BOOM_MINIMO_DO_ALVO`, que também não consome a chance. E só entra quem está **de pé**: soprar pra
  dentro um pokémon desmaiado seria pior que não soprar.
- **A CORRENTE NÃO EXPLODE.** O marcador `_remoinhoContra` faz o sorteio valer **uma vez por par**
  (adversário novo, confronto novo, como o `_especialContra`), e o sopro roda **uma vez por volta do
  laço** — sem re-rolar depois da troca. Medido em 3.000 batalhas: a maior corrente de sopros
  seguidos foi **3**, e nenhuma batalha travou.
- **A FRASE NOMEIA QUEM SAIU, não quem entrou**: *"🌪️ Pidgeot usou Remoinho e soprou Feraligatr pra
  fora"*. Quem entrou já está no cabeçalho do confronto, com sprite e barra; quem saiu não aparece em
  lugar nenhum, e sem o nome dele o jogador não tem como saber que o pokémon que ele estava
  desgastando foi embora (e que volta com o HP que tinha). O nome viaja no diário (`sai`), pelo mesmo
  motivo do tipo anulado no Disable: nenhum dos dois lados do matchup é ele.
  Log gravado antes do campo cai na frase sem nome — log velho não pode sumir.
- **O NOME PT É "Remoinho"**, e ele estava livre: o único parecido que o jogo já usa é o "Redemoinho
  de Fogo" do `firespin`. O selo é **Normal**, como o golpe de verdade, e o ícone é 🌪️.
  Ele vale **2 passos** no `passosDaAbertura`, como a chuva e o sono: ele É um passo da animação com
  dano ZERO, então a frase precisa cobrir a pausa de leitura MAIS o passo dele.
- **⚠️ UMA TRAVA DA FAIXA DE FOCO TEVE QUE APRENDER O QUE JÁ ERA REGRA.** Ela cobrava "nenhum
  confronto com Faixa passa de 8 linhas", contando as ABERTURAS junto — e assim o teto subia com o
  número de passivas do jogo. Ele estourou aqui (9 linhas) **sem nada da Faixa ter mudado**. Hoje ela
  cobra o que a Faixa promete — **7 linhas de luta** (3 + a linha dela + 3) — e as aberturas não
  contam.
- **⚠️ ELE NÃO EXISTE NO ONLINE NEM NAS LIGAS, e não é esquecimento — é o único lugar onde ele NÃO
  PODERIA existir.** Ali quem escolhe o pokémon ativo é o JOGADOR, numa janela de 5 a 10 segundos;
  um sopro que troca o ativo do outro lado desfaria a escolha que a pessoa acabou de fazer, e a
  janela seguinte abriria com ela olhando um pokémon que não pôs em campo.
  **A separação é por construção, não por uma guarda:** o `tentarRemoinho` é chamado de dentro do
  `simulateGymBattle`, e o online resolve confronto a confronto pelo `battleResolveMatchup`, que vai
  direto no `doExchange`. Ou seja, ele vale na jornada, na Torre, no Ginásio da Cidade e na Elite —
  os mesmos lugares onde o time é uma FILA e não uma escolha.
  Se um dia o Remoinho precisar valer no online, não é mover a chamada: é decidir o que acontece com
  a escolha do adversário, e isso é mecânica nova.

### AS DUAS DANÇAS DE ATAQUE (12/09/2026)

Pedidas assim: *"adicione o Feather Dance e a Sword Dance, onde uma diminui em 50% o attack do
oponente e a outra aumenta em 50% o attack do usuario. Tem 20% de ocorrer no inicio de cada
confronto"*. São o **décimo terceiro e o décimo quarto** especiais.

| | quem tem | o quê |
|---|---|---|
| **Dança das Espadas** | Farfetch'd, Pinsir, Scizor, Scyther | quem usa fica com **×1,5** de Ataque |
| **Dança da Pluma** | a linha do Pidgey | o ADVERSÁRIO fica com **×0,5** de Ataque |

- **As listas saem do aprendizado por NÍVEL da Gen 3**, a regra das outras treze. São 4 e 3
  espécies — as duas menores listas do bloco inteiro.
- **⚠️ É O ATAQUE FÍSICO E SÓ ELE** (`effectiveAttack`), como no jogo oficial. Neste motor quem
  decide se um golpe usa o Ataque ou o Ataque Especial é o **TIPO** dele (`isSpecialType`, regra da
  Gen 1), e as duas danças mexem no Ataque.
  **A consequência está medida, e ela é grande pra a Pluma:** das 250 espécies, **110 atacam sempre
  pelo físico** (ela morde inteiro), **39 sempre pelo especial** (ela não tira um ponto de dano) e
  101 variam conforme o alvo. É o mesmo efeito que os itens de atributo já têm — e foi por isso que
  a caixa da ficha diz isso com todas as letras.
- **O MULTIPLICADOR ENTRA POR ÚLTIMO** (`withDanca`), depois dos flats (item e fúria): "50% do
  ataque" é 50% do que o pokémon TEM na hora do golpe. Entrando antes, ele multiplicaria só a parte
  base e o +15 do item ficaria de fora da conta. Conferido: num Pinsir com Atk Up, 140 → 210.
  É o espelho da regra do flat, que entra por último **porque** é flat.
- **OS DOIS PODEM COEXISTIR**: um Pinsir que dançou as espadas contra um Pidgeot que dançou a pluma
  fica em 1,5 × 0,5 = **0,75**.
- **⚠️ NÃO ACUMULA E NÃO ATRAVESSA CONFRONTO**, e isso é o "no início de cada confronto" do pedido ao
  pé da letra: os dois marcadores são LIMPOS no começo de cada confronto e sorteados de novo. Sem a
  limpeza, um Pinsir que dançasse em três confrontos seguidos sairia com 1,5³ = **3,4×** de ataque —
  o mesmo tipo de vazamento que o teto de HP da fúria já teve. O teste cobra o teto de 1,5 em 600
  batalhas.
- **DADO PRÓPRIO, fora do `sorteiaGolpeEspecial`**, como a chuva. Disputando a vaga única do sorteio
  de efeito, o **Pidgey** — que já tem Remoinho — veria a Pluma sair menos que os 20% pedidos.
  O `tentarDancas` roda na abertura do confronto, ao lado do `tentarChuva`, e o teste **lê o código**
  pra cobrar que os dois motores o chamem: os casos chamam a função direto e passariam com a chamada
  órfã.
- **SÃO ABERTURA** (`continue`): a luta acontece inteira depois, com um dos dois mudado. Valem 2
  passos no `passosDaAbertura`, como o sono — elas SÃO um passo da animação (dano 0, barra parada),
  então a frase cobre o passo 0 mais o passo delas e cede o lugar ao nome do golpe.
- **AS FRASES dizem o que MUDOU, não o nome do atributo**: *"⚔️ Pinsir usou Dança das Espadas e ficou
  mais forte"* e *"🪶 Pidgeot usou Dança da Pluma e enfraqueceu o ataque de Machoke"*. A da Pluma
  **nomeia o ALVO**, como a anulação: quem interessa ali é o prejudicado. O número fica na caixa da
  ficha, que é onde se explica.
  Os selos são **⚔️ (Normal)** e **🪶 (Voador)**, os tipos dos dois golpes no jogo oficial.
- **O QUE CADA UMA VALE, com a chance FORÇADA em 100%** pra isolar o efeito (1x1 contra um painel de
  8, mesmo nível, 2.000 batalhas por célula):

  | | sem | com | |
  |---|---|---|---|
  | Pinsir Lv.50 | 34,6% | **58,0%** | +23,4 |
  | Scyther Lv.50 | 34,4% | 47,8% | +13,4 |
  | Scizor Lv.50 | 66,5% | 76,8% | +10,3 |
  | Pidgeot Lv.50 (pluma) | 24,4% | 31,4% | +7,0 |
  | Farfetch'd Lv.50 | 7,8% | 13,0% | +5,2 |
  | Pidgey Lv.30 (pluma) | 13,3% | 15,1% | +1,8 |

  **A Pluma rende menos que as Espadas, e a causa é a de cima:** metade do painel ataca pelo
  especial, e contra esses ela não faz nada. As Espadas sempre valem, porque quem as tem é
  justamente um atacante físico.
  **Na chance real de 20% o efeito por batalha é ~1/5 disso.**
- **Medido: elas saem em 0,65% (Espadas) e 0,48% (Pluma) dos confrontos**, e em **4,0% das batalhas
  3x3**. São 7 espécies em 250 — as duas listas mais curtas do jogo.
- **O PREÇO NA JORNADA: dentro do ruído.** 67,37% contra 66,94% de conclusão — **+0,43 ponto,
  0,8σ** (10 blocos de 1.500 jornadas de cada lado, 15.000 de cada). Faz sentido: são 7 espécies em
  250, elas saem em ~1% dos confrontos, e caem dos DOIS lados — o Pidgeot é rota comum e o Scyther
  e o Pinsir aparecem na Zona de Safári.
  **A impressão do motor MUDA, e tem que mudar** (com a chance em 0 ela volta ao que era): ao
  contrário do Remoinho na tela, estas mexem no DANO.
- **⚠️ OS DOIS SELOS NO QUADRO DO LUTADOR (14/09/2026, a pedido:** *"para a Sword Dance e Feather
  Dance que acontecer no momento do confronto, coloque um sinal para identificar os pokémons
  afetados"*). Eles ficam ao lado do 🌟 (shiny), 🔺 (terreno) e 🎖️ (especialidade), e são os mesmos
  ⚔️ e 🪶 que o log já usa.
  **⚠️ QUEM É AFETADO NÃO É O MESMO NOS DOIS, e esse é o cuidado inteiro:** nas **Espadas** quem usa
  é quem fica forte, então o selo vai no lado do `q`; na **Pluma** quem sofre é o ADVERSÁRIO, então
  ele vai no lado OPOSTO ao `q`. O `q` do diário é sempre de QUEM USOU o golpe — a convenção de todo
  o motor —, e ler os dois igual poria a pluma no pokémon errado. **O defeito não apareceria como
  erro**: apareceria como o selo no lado que ficou mais FORTE.
  **O CASO DURO É O MESMO POKÉMON COM OS DOIS**: um Pinsir que dançou as espadas contra um Pidgeot
  que dançou a pluma sai com **⚔️🪶** (ele é 1,5 × 0,5 = 0,75), e o **Pidgeot sai sem selo nenhum** —
  ele usou a pluma, mas quem sofreu foi o outro. É esse caso que uma leitura ingênua erraria, e é
  ele que o teste cobra primeiro.
  **ELES VALEM O CONFRONTO INTEIRO**, como o 🔺 e o 🎖️: as duas são ABERTURA (acontecem antes do
  primeiro golpe, então não há o que adiantar) e o efeito dura a luta toda. É o contrário da Faixa
  de Foco, que fica escondida até o passo dela porque mostrá-la antes entregaria o desfecho.
  **SAI DO DIÁRIO**, não de um campo do matchup: o log é relido dias depois, e confronto anterior a
  12/09/2026 não tem as marcas e sai sem selo — que é o que ele era.
  **As QUATRO telas de batalha leem a MESMA função** (`selosDaDanca`): as três do `fighterHtml`, a
  liga assistida (que tem quadro próprio) e o online — este com a perspectiva já virada, porque os
  matchups vêm do lado A. Quem está SAINDO de campo (o quadro do Remoinho) não leva selo: o efeito é
  de quem está lutando agora.
- **⚠️ E O SELO NOVO QUEBROU UM EXTRATOR DE TESTE, que é a lição a guardar daqui.** A trava do
  Remoinho lê o nome do quadro com uma regex que exigia o nome COLADO no "Lv.", e o fixture dela usa
  um **PIDGEOT** — justamente o dono da Dança da Pluma. Ela passou a devolver "?" em **30 de 40**
  quadros, sem nada do Remoinho ter mudado. Já havia três selos naquela posição (🌟, 🔺, 🎖️) e a
  regex só não tinha esbarrado neles: hoje ela tolera qualquer coisa entre o nome e o nível.
- **Se um dia incomodarem**, os lugares de mexer são a **chance** (`CHANCE_DANCA`) e os
  **multiplicadores** (`DANCA_ESPADAS_MULT`, `DANCA_PLUMA_MULT`) — e a régua está aqui.

### O REMOINHO MOSTRA A TROCA: SAI, FICA VAZIO, ENTRA (12/09/2026)

Pedido assim: *"primeiro aparece a mensagem falando que entrou o golpe, depois tem que mostrar
saindo o pokemon, ficando sem nada, e depois entrando o novo, e exibindo a mensagem 'Psyduck foi
trocado por Geodude!' e depois de 1s começa a batalha novamente"*. Antes o sopro era **uma linha**:
a tela já mostrava o pokémon novo desde o primeiro quadro, e a frase explicava por quê.

- **A CENA HOJE, medida quadro a quadro** (Pidgeot soprando um Geodude pra fora, entra um Machop):

  | passo | cabeçalho do adversário | pausa | linha de status |
  |---|---|---|---|
  | 0 | **Geodude** | 1s | 🌪️ Pidgeot usou Remoinho e soprou Geodude pra fora |
  | 1 | Geodude | — | idem |
  | 2 | **(vazio)** | 1s | idem |
  | 3 | **Machop** | 1s | **Geodude foi trocado por Machop!** |
  | 4+ | Machop | — | a luta |

- **O MOTOR GRAVA UM REGISTRO; QUEM REPARTE EM TRÊS É A APRESENTAÇÃO** (`sequenciaDoConfronto`),
  e isso é decisão: assim os três quadros valem pra **log velho** também — um confronto gravado
  antes disso tem o registro único e ganha a cena inteira na releitura.
  Os dois quadros novos (`remoinhoVazio`, `remoinhoEntra`) existem só na sequência, e o **log
  continua com UMA linha** — a mesma forma da drenagem (duas entradas, uma linha) e dos golpes de
  vários tapas.
- **⚠️ QUEM SAI VIAJA INTEIRO NO DIÁRIO, e não só o nome.** Pra desenhar o quadro do que está saindo
  a tela precisa do sprite, do nome, do nível e da BARRA dele — e **nenhum dos dois lados do matchup
  é ele**. São `ss`/`sai`/`sl`/`sh`/`shp`/`smx`, mais o `entra` (o nome de quem chega, pra a frase
  valer sozinha quando o log é relido dias depois). Sem eles o quadro mostrava o nome do que sai com
  a barra do que entra.
- **⚠️ O QUADRO SAI DO PASSO CONTRA A SEQUÊNCIA, e não do `hit`** — e essa foi a primeira versão,
  errada. O `hit` é o passo que a animação acabou de APLICAR, e no **passo 0 ele é null**; só que o
  passo 0 é justamente onde a frase "soprou Geodude pra fora" já está na tela com o segundo de
  leitura do `pausaDoEspecial`. Lido do `hit`, o cabeçalho mostrava o pokémon **NOVO** enquanto a
  frase falava do antigo: **a cena começava pelo fim.**
- **O `fighterHtml` NASCEU DESTA MUDANÇA.** O quadro de um lutador estava **triplicado** inline no
  `renderBattling`, no `renderSpecialBattling` e no `renderTrainerBattling`; virou função porque
  agora ele deixa de ser o pokémon do matchup durante três passos. Três cópias divergiriam no
  primeiro ajuste, e é a parte que o jogador olha.
  O `comTerreno` existe porque **só a tela da jornada** mostra o 🔺 do terreno — nas outras duas não
  há terreno, e o selo prometeria um bônus que aquela batalha não dá.
  A **liga assistida ficou de fora** de propósito: o sopro não existe em liga (ver a seção do
  Remoinho), então ali o quadro continua inline.
- **OS TRÊS QUADROS PEDEM REDESENHO** (`troca`), e por um motivo que nenhuma outra abertura tem:
  eles trocam o **SPRITE** do cabeçalho, e sprite só muda num `render()` — o
  `pintarStatusDoConfronto` mexe na linha de status e em nada mais. A marca é própria e não o
  `leitura` porque o primeiro quadro está no índice 0: ali o `pausaDoEspecial` já dá o segundo de
  leitura, e marcar `leitura` seria pausa em cima de pausa — mas o desenho ele precisa do mesmo
  jeito.
- **A VAGA VAZIA NÃO TEM FRASE PRÓPRIA, e não pode ter entrada no `passosDaAbertura`.** A janela do
  sopro (**3 passos**) já cobre o passo dela, com o mesmo texto. Pior: entrando na lista de avisos
  **sem** entrada na tabela, ela cai no ramo da autodestruição (`!n` = a frase vale o confronto
  INTEIRO) e a linha ficava presa em "soprou X pra fora" até o fim da luta, por cima do nome dos
  golpes. O `remoinhoEntra` vale **2**, e é por isso que a luta só começa um segundo depois dele.
- **O quadro do novo é ACRESCENTADO À MÃO na lista de avisos.** Ela sai do DIÁRIO (via
  `ehGolpeEspecial`), e o `remoinhoEntra` não existe lá. Trocar a fonte pela sequência perderia a
  **ANULAÇÃO**, que tem frase e é filtrada FORA da sequência (ela não é um passo).
- **⚠️ E ISSO DESENTERROU UM DEFEITO ANTIGO: a frase da AUTODESTRUIÇÃO começava no passo 0.** Ela não
  tem passo de saída de propósito ("ali o confronto INTEIRO é aquilo"), mas também não tinha passo
  de **ENTRADA** — então num confronto em que o sopro traz um Geodude que explode, lia-se *"Geodude
  usou auto-destruição"* durante a animação da troca inteira: a frase do fim contando o começo.
  Era antigo — com o sopro em um passo só ela já comia aquele passo —, e só ficou visível quando a
  cena passou a durar três. Hoje ela vale de `i+1` em diante, como as outras; com a explosão no
  índice 0, que é o caso comum, nada muda.
- **CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois do quadro novo dá o
  **MESMO hash** em 3.669 confrontos. Os campos novos do diário são só escrita — o motor nunca os
  lê de volta —, e a expansão vive no `sequenciaDoConfronto`, que é apresentação. O teste cobra que
  o `remoinhoVazio` **não exista no servidor**.
- `tools/test-especiais.js` tranca a cena inteira em 40 confrontos: os campos do diário, os três
  quadros na ordem, a animação com os mesmos passos do log, a **uma linha** no log, o cabeçalho
  fazendo *sai / sai / vazio / entra*, a frase do sopro cobrindo os três primeiros e o "trocado por"
  fechando, o segundo de leitura em cada quadro, o redesenho, a tabela dos passos (3 e 2, e a vaga
  vazia FORA dela) e o acréscimo à mão na lista de avisos.

#### E TRÊS ARTEFATOS DA TRAVA DO SELO DE CRÍTICO saíram junto

A trava "nenhum selo num número < 1/3 do maior daquele atacante" falhava **~1 rodada em 3**, e as
três causas eram do TESTE, não do jogo — ela lê a TELA (é o que ela existe pra medir) e agrupa as
linhas por NOME:

1. **O golpe de VÁRIOS TAPAS não era isentado** — o comentário dizia que era, desde 10/09/2026, e o
   código nunca fez. A linha dele é a **soma** de N tapas de poder baixo (o Tapa Duplo é poder 15),
   então ela pode somar menos que um terço do maior golpe único sem o selo mentir.
2. **E o BASELINE também precisava excluí-los**: o "maior golpe daquele atacante" não pode ser uma
   linha de tapas. Um Shuckle de 28 num crítico contra os 182 de um Ataque Fúria de 3 tapas é golpe
   único contra soma. Isentar só a linha medida deixava metade do artefato de pé.
3. **O confronto ESPELHO conflava os dois lados**: com a mesma espécie nos dois lados, o maior golpe
   de um entrava na conta do outro — um Blastoise × Blastoise acusou um crítico de 21 contra o 142
   do adversário.

Hoje ela roda **14 vezes seguidas em zero**. A lição é a de sempre aqui: trava que amostra confronto
aleatório precisa de invariante, e o invariante tem que comparar coisas do mesmo tipo.

### A CAIXA QUE EXPLICA O ESPECIAL (11/09/2026)

Pedida assim: *"para todos os ataques especiais/passivas, coloque que quando o usuário clicar em
cima dessa habilidade passiva, abre um modal explicando o que ocorre quando acontece aquela
habilidade na partida"*. São **doze** hoje: autodestruição, sono, anulação, Metrônomo, Recuperar,
drenagem, Fúria, confusão, Fúria do Dragão, **Sketch** — este acrescentado à ficha no mesmo dia,
também a pedido, e SÓ pra aparecer: a mecânica dele não foi tocada —, a **Dança da Chuva**, que
chegou logo depois e é a única POR BATALHA, e o **Remoinho** (12/09/2026), que é o único que muda
QUEM está no confronto.

- **ELA É INDEXADA PELO EFEITO, NÃO PELO NOME** (`EXPLICACAO_DO_ESPECIAL`), e essa é a decisão que
  sustenta o resto. O nome é **por espécie** — o Zubat confunde com Supersom e o Alakazam com
  Confusão, o Paras dorme com Esporo e a Jigglypuff com Canto —, mas a MECÂNICA é uma só. Indexar
  por nome seria escrever o mesmo texto **5 vezes pro sono, 11 pra confusão e 3 pra drenagem**, e a
  vigésima divergiria no primeiro ajuste. É a mesma lição da `fraseDoEspecial`, que já vive numa
  função só pelo mesmo motivo.
  Por isso o `especiaisDaEspecie` passou a devolver **`efeito`** ao lado de `nome`/`chance`/`tipo`:
  é ele que escolhe o texto. O **título** continua sendo o nome daquela espécie, com o selo na cor
  do tipo dela — quem abriu num Zubat lê "Supersom" em cinza, quem abriu num Misdreavus lê "Raio
  Confuso" em roxo, e os dois leem o mesmo corpo.
- **A TABELA VIVE SÓ NO CLIENTE**, como o `MOVE_BY_TYPE` e o `TIPO_DO_ESPECIAL`: o motor faz, o
  cliente conta. O servidor não tem tela e não precisa saber a palavra.
- **OS NÚMEROS SAEM DAS CONSTANTES, não escritos à mão no texto** (`textoDoEspecial` troca
  `{CURA}`, `{DRENO_MIN}`, `{DRENO_MAX}`, `{FURIA}`, `{FURIA2}`, `{FURIA3}` e `{DRAGAO}` pelos
  valores do motor). É o que impede a caixa de mentir no dia em que o balanceamento mudar — o
  defeito que a especialidade teve, quando valia 1% e este arquivo dizia "~13 pontos percentuais"
  por ter sobrevivido à mudança do valor. `tools/test-especiais.js` cobra que **nenhum marcador
  fique por substituir** e que cada um bata com a constante.
- **O "QUANDO" É CAMPO PRÓPRIO, e não uma frase no meio do texto** — é a informação que o jogador
  mais erra sobre este bloco. São QUATRO momentos e eles jogam muito diferente:
  **ABRE o confronto** (a luta acontece inteira depois, com alguém já em vantagem), **RESOLVE o
  confronto** (não há luta depois, e só a autodestruição faz isso), **A CADA GOLPE** (só o
  Metrônomo), **DEPOIS DA BATALHA** (só o Sketch) e **DURA N CONFRONTOS** (só a Dança da Chuva,
  que é a única que atravessa vários).
  O conjunto é FECHADO e o teste cobra isso: um sexto momento escrito com outra palavra ("no fim
  da luta") passaria despercebido, e as duas travas que procuram por /Resolve/ e /cada golpe/
  deixariam de valer sobre ele.
- **⚠️ SÓ A AUTODESTRUIÇÃO RESOLVE O CONFRONTO — e a primeira versão desta caixa dizia que o SONO
  também resolvia.** Era verdade até **02/09/2026**, quando ele matava o alvo; hoje ele compra UMA
  troca livre e é `continue` como todos os outros. **O teste pegou isso no dia em que a caixa
  nasceu**, e ele pega porque **LÊ O MOTOR**: ele fatia o `tentarGolpeEspecial` e vê quem tem
  `return true`, em vez de comparar com uma lista escrita à mão que envelheceria junto com o texto.
  Sem essa trava, a tela passaria a explicar uma mecânica que o jogo não tem mais — e ninguém
  reclamaria, porque o texto continuaria plausível.
  **Armadilha do próprio teste, e ela quase o fez passar em branco:** a primeira fatia ia de
  `tentarGolpeEspecial` até `equiparItens`, e o `equiparItens` fica **ANTES** no arquivo — a fatia
  saía VAZIA e o teste passava sem ler nada. Hoje ela vai até o `faixaDeFoco`, e há um `ok` só pra
  cobrar que a fatia tem tamanho.
- **A LINHA INTEIRA DA FICHA É O BOTÃO**, não só o selo: é a mesma regra da lista de notificações
  ("a linha toda já é o alvo do toque, e mirar num quadradinho num celular é pedir erro"). Ela
  **não usa o `.btn` da casa** — aquele é botão de AÇÃO, com moldura de 3px; aqui a lista é de
  informação que por acaso se toca, o mesmo raciocínio que já tinha tirado o `.btn` dos cartões de
  golpe. O fundo só acende no hover e no toque.
- **O `ⓘ` no fim da linha é o que diz que há o que ler.** Sem ele o selo se lê como os selos
  estáticos que o jogo usa em toda tela, e ninguém descobre que dá pra tocar. Ele fica apagado e
  pequeno de propósito: é a affordance, não a informação.
- **`<button>` DENTRO DE `<button>` — a armadilha da casa — NÃO existe aqui**, e o teste tranca
  isso: a ficha é um `modal-box`, não um botão. Ela já custou dois defeitos neste projeto (a lupa
  do encontro selvagem e a do montador), e a trava fica pra o dia em que alguém tornar a ficha
  clicável.
- **A CAIXA É ANEXADA DEPOIS DA FICHA no `render`**, porque os modais empilham na ordem em que
  entram e ela é aberta de DENTRO da ficha — vindo antes, abriria atrás. É a mesma nota que a
  própria ficha já carrega em relação ao modal da Pokédex, e o teste **lê o código** pra cobrar a
  ordem: os casos chamam as funções direto e passariam com a ordem trocada.
- **Efeito desconhecido NÃO abre caixa vazia** (`abrirEspecialInfo` recusa em silêncio). É a rede
  pro dia em que um especial novo chegar à ficha antes de ter texto — e o teste cobra que os dois
  lados batam: **todo efeito que a ficha sabe mostrar tem explicação, e nenhuma explicação sobra
  sem dono**. Sem isso, um especial novo nasce com a linha abrindo uma caixa vazia, e só no bicho
  que tem AQUELE especial: o tipo de defeito que fica meses sem ninguém ver.
- **O METRÔNOMO É O ÚNICO SEM CHANCE NO TÍTULO**, e isso vem de 10/09/2026: ele sai em TODO golpe,
  o que é sorteado é QUAL. Um "100% por confronto" ali diria menos que nada, e a caixa dele sai só
  com o momento.
- **MEDIDO A 320px:** a maior caixa (autodestruição e confusão) fica em **~304px** de altura, contra
  os 568 da menor tela que a casa mira — **cabe sem rolagem**, e por isso a lista de detalhes não
  precisou de `max-height` como a dos golpes por nível. A linha mais larga da ficha ("Fúria do
  Dragão" + chance + ⓘ) mede **~198px** numa coluna de 260: cabe numa linha só.
- **A FILEIRA DO TIME ficou de fora, e é decisão.** O selo do Metrônomo aparece lá, mas aquela
  lista é de GOLPES — tornar clicável só o único especial que passa por ela seria uma exceção no
  meio de uma lista uniforme, e a linha já carrega o `+` de item e as setas de ordem. Quem pergunta
  "o que este bicho faz?" pergunta na ficha, e a lupa que abre a ficha está no encontro selvagem,
  nas duas telas de evolução e no montador de time.

### A lista de golpes na ficha da Pokédex (09/09/2026)

Entre o **Total** e o botão Fechar, uma linha por golpe: **nível, nome, poder e tipo**.

- **É a mesma tabela da tela de escolha** (`APRENDIZADO`), então só traz golpe de DANO — o que
  está ali é exatamente o que ele pode LEVAR pra batalha, e não tudo que a espécie aprende.
- **Por que ela merece espaço:** os seis números dizem o quanto ele TEM, o golpe especial diz o que
  ele faz sozinho, e esta lista diz com o que ele bate. É a única das três que o jogador consulta
  ANTES de capturar, porque é ela que responde "esse aqui cobre o tipo que falta no meu time?" —
  e a lupa da Pokédex está justamente nas telas de encontro e de evolução.
- **A lista ROLA POR DENTRO** (`max-height:190px`) em vez de esticar a ficha: sem o teto, o botão
  Fechar ia parar fora da tela num celular. É o mesmo cuidado do modal de ranking da Torre.
- **A linha é uma grade de quatro colunas**, não um flex livre: nível e poder alinhados em coluna
  se comparam de relance, que é pra isso que a lista existe.
- **Espécie sem golpe nenhum não ganha a seção** — hoje só o Ditto. Uma lista vazia diria menos
  que nada.

- **As frases são as pedidas, palavra por palavra:** *"Bulbasaur aprendeu um novo golpe!"* e
  *"Kabuto quer aprender um golpe novo!"* + *"Escolha qual será substituído"*.
- **A frase anuncia, o cartão informa.** O anúncio já foi uma linha corrida ("Fulano aprendeu
  CHICOTE DE CIPÓ - Poder 35 - PLANTA") e durou algumas horas: a informação era a mesma, mas
  espremida numa frase ela se lia como legenda, não como acontecimento.
- **SAIU o "Aprendido no level N, porém ele já possui 2 golpes".** Ele existia pra justificar a
  pergunta, e a pergunta se justifica sozinha com os dois golpes atuais logo abaixo. Some junto o
  caso do golpe destravado pela EVOLUÇÃO, que era quem fazia a linha dizer "level 1" num pokémon
  de 30 — e o campo `daEvolucao` deixou de ser lido por qualquer tela.
- **O TIPO CONTINUA POR EXTENSO nos cards de escolha**, e isso é regra da casa que o redesenho
  quase desfez: a cor sozinha não separa Fantasma de Psíquico, e é justamente entre esses dois que
  a escolha decide. Ele vem no selo, ao lado do nome do golpe.
- **Um emoji por tipo no cartão durou uma versão.** O ladrilho colorido com 🌿 / 🔥 / ☠️ à esquerda
  do nome foi tirado a pedido no mesmo dia: com ele, o cartão tingido e o selo colorido, a cor do
  tipo aparecia três vezes na mesma linha. Ficou o selo. (Se um dia voltar, o cuidado registrado
  era: emoji sobrevive à redução, ao contrário da pixel art da home, que perde diagonal fina.)
- **Os golpes atuais usam o MESMO cartão do golpe novo**, de propósito: é comparação lado a lado,
  e um formato diferente em cima e embaixo obrigaria a reaprender a ler no meio da decisão.
- **A 320px:** as três cabem sem rolagem lateral. O nome comprido quebra dentro do cartão
  (`overflow-wrap:anywhere`) e o poder não se move, porque ele é a coluna que se compara.

### O que foi medido e NÃO foi mexido (09/09/2026)

Achados na mesma varredura, com número, e deixados como estão porque não foi o que se pediu:

- **A tela de escolha ordena e anuncia por PODER CRU**, e o dano multiplica esse número por 1,5
  (STAB) ou 0,85 (subtipo) — então "Poder" **não é comparável** entre dois golpes do mesmo pokémon,
  e em **16% das espécies** o primeiro card não é o que mais bate. Este arquivo diz "a tela ordena
  por poder decrescente justamente porque escolher bem vale 79 pontos"; a ordenação continua como
  está, mas o número na tela é menos informativo do que parece.
- **31% das espécies batem MENOS com o melhor par escolhido do que sem golpe nenhum**, porque o
  motor implícito escolhia entre TODOS os tipos da espécie sempre com poder 60 e STAB 1,5. Como os
  NPCs continuam no motor implícito, o mesmo Venusaur é ~23% mais forte do lado do líder. É a mesma
  assimetria já registrada em "A decisão que ficou em aberto", agora com o número por espécie.
- **⚠️ O GINÁSIO DA CIDADE DESCARTAVA OS GOLPES na ida pro servidor, e isso foi CONSERTADO em
  16/09/2026** (ver **OS GOLPES ESCOLHIDOS CHEGAM NA LIGA E NO ONLINE**). O diagnóstico que estava
  aqui era exato -- *"o `resolverTimeDosSaves` devolve `ataques`, mas o time vira um código uma linha
  depois"* -- e a saída apontada era a que foi tomada: **os `slots` já viajavam dentro do match, e os
  golpes couberam no mesmo lugar**, sem tocar na trava anti-falsificação do código de time.
  A DEFESA congela os golpes junto com o código (`leaderTeamAtaques`), pelo mesmo motivo que ela
  congela o time: o líder montou aquele time e é com ele que defende. Ginásio tomado antes desta
  data não tem o campo e defende no motor de tipo, como defendia.
- **O Doce Raro e a evolução no SERVIDOR sobem nível sem nunca oferecer o golpe novo.**
  `evoluirNoSave` não conhece `nivelDosAtaques`/`especieDosAtaques`, o que deixa a pendência
  CORRETA gravada — mas quem a resolve é só o `continueFromEvolution`, e abrir o save não passa por
  ele (`escolhaDoSavePendente` só cuida da fila da CAPTURA). No save campeão, que é onde o Doce
  Raro mais é usado, a pergunta nunca chega.
- **13 golpes ficam inalcançáveis pra LINHA INTEIRA** porque a evolução aqui é sempre automática por
  nível: o que a forma antiga ensinaria ACIMA do nível da evolução e a nova nunca ensina não tem
  como ser aprendido (a Starmie é o caso mais duro). É fiel ao jogo original, que também não volta
  atrás — mas lá existe Everstone.

### OS NPCs GANHARAM MOVESET (09/09/2026) — e é a maior mudança de dificuldade já medida aqui

Reportado assim: *"os pokemons dos adversários estão usando ataques que não estão no moveset do
pokémon incluído na dex; para os pokémons dos adversários (NPC, e não batalhas online), pegue todo
o moveset até o level que o pokémon está e veja qual que irá tirar mais dano"*. **E era verdade:**
o NPC não tinha golpe escolhido, caía no motor de TIPO e atacava com o nome genérico do tipo, com
poder implícito de 60 — um Onix batendo de um golpe de Pedra que ele não aprende em nível nenhum.

- **`equiparNpc(time)` dá a ele TUDO que a espécie aprende por nível até o nível dele**, e o
  `melhorAtaque` escolhe o que tira mais dano contra quem está na frente. **Sem teto de 2 golpes**,
  e isso é de propósito: os dois são a regra do JOGADOR, que ESCOLHE. O NPC não escolhe nada — ele
  tem o que a espécie tem, que é o que o pedido descreve.
- **São QUATRO portas**, e uma que ficasse de fora vira uma batalha em que o adversário ataca com
  golpe que não tem: **líder de ginásio**, **rival/Elite/Rocket** (`runSpecialBattle`), **desafio do
  Mewtwo** e o **treinador da Torre** (esse no servidor). `tools/test-especiais.js` lê o código e
  cobra as quatro — os casos chamam as funções direto e passariam com a chamada órfã.
- **NÃO vale pra código de time** (liga, online, ginásio da cidade): ali o outro lado é um JOGADOR,
  não um NPC, e dar moveset de espécie a ele seria inventar golpe pra time alheio. O pedido separou
  os dois, e o teste tranca isso também.
- **Quem é do Metrônomo continua sem golpe escolhido** — senão o Togepi passaria a atacar com golpe
  comum e a mecânica dele sumia.
- **O `APRENDIZADO` e o `GOLPES_IDS` TIVERAM QUE IR PRO SERVIDOR**, e este arquivo dizia que nunca
  precisariam ("o servidor nunca precisa saber quem aprende o quê"). Isso valia enquanto só o
  jogador tinha golpe; o time do treinador da Torre é montado LÁ, do zero. São 15,5 KB num arquivo
  de 430. Viraram a **oitava e a nona tabelas duplicadas**, e o teste compara o moveset das 250
  espécies em cinco níveis entre os dois motores.
- **O PREÇO MEDIDO, e ele é enorme: a jornada concluída cai de 77,08% para 64,52%** — **−12,56
  pontos, 19,9σ** (10 blocos de 1.000 jornadas de cada lado). É a maior variação de dificuldade já
  medida neste projeto, com folga.
  **E ela se concentra no FIM**, como a estimativa antiga previa — só que muito maior:

  | ginásio | game overs antes | depois |
  |---|---|---|
  | 1º (Brock) | 1.160 | **928** |
  | 5º | 90 | **417** |
  | 6º | 231 | **705** |
  | 8º | 712 | **1.488** |

  O começo AFROUXA (no nível 12 o moveset real do líder é mais fraco que os 60 implícitos) e o fim
  APERTA muito (no nível 60 o melhor golpe da espécie vale ~89). **Este arquivo estimava +8 pontos
  na direção FÁCIL** (`ataquesPadrao` dos dois lados) — a estimativa era de outra coisa: lá os DOIS
  lados ganhavam 2 golpes; aqui só o NPC ganha, e ganha o moveset INTEIRO.
  **Se incomodar, o lugar de mexer é o `equiparNpc`, e a variante está MEDIDA**: `.slice(0, 2)` na
  lista põe o NPC na mesma regra do jogador (os dois golpes mais fortes) e a conclusão volta pra
  **69,92%** — devolve **5,4 dos 12,6 pontos**. O 5º ginásio não melhora (482 contra 417 game
  overs, ele fica igual ou pior), mas o 8º cai de 1.488 pra **1.148**.

  | | conclusão | 1º | 5º | 6º | 8º |
  |---|---|---|---|---|---|
  | NPC no motor de tipo (antes) | 77,08% | 1.160 | 90 | 231 | 712 |
  | NPC com os 2 mais fortes | 69,92% | 897 | 482 | 477 | 1.148 |
  | **NPC com o moveset inteiro (hoje)** | **64,52%** | 928 | 417 | 705 | 1.488 |

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

## O nome do golpe DURANTE a batalha (09/09/2026)

Pedido assim: *"se está descendo a barra de HP do pokémon X, é porque o pokémon Y usou um ataque —
exiba na tela o nome desse ataque no mesmo momento que a barra se movimenta"*.

- **O INVARIANTE, e é ele que o teste tranca:** a barra que anda é a de quem **APANHA**
  (`hit.side`) e o nome exibido é o de quem **BATE** (`hit.q`) — sempre lados opostos. Trocar um
  pelo outro não aparece como erro: aparece como uma frase plausível dizendo que o pokémon bateu em
  si mesmo. `tools/test-especiais.js` percorre ~1.500 passos de animação e cobra os dois.
- **O passo animado passou a carregar `q` e `x` do diário**, sem tradução. O
  `buildAnimatedHitSequence` já invertia os lados (lá `q` é quem bate, aqui `side` é quem
  apanha) e jogava o resto fora; é do `q` que sai o nome e do `x` que sai a decisão de mostrar.
- **A LINHA É A MESMA do "Trocando golpes..."** — é onde o jogador já está olhando. `statusDoConfronto`
  decide o que ela diz, com prioridade: **aviso especial > nome do golpe > texto de sempre**. Uma
  função só, lida pelo render das telas E pelo pintor do DOM: montadas em separado divergiriam no
  primeiro ajuste, que é exatamente o que já aconteceu entre o log e a animação.
- **QUEM PINTA É O DOM, nunca o `render()`.** Um render no meio da animação recria o HTML e mata a
  transição CSS da barra — a regra da casa, que já custou três defeitos. O nome tem que aparecer no
  MESMO instante em que a barra começa a andar, e esse é o único jeito de fazer as duas coisas.
- **O PINTOR SÓ SOBE A LINHA, nunca a rebaixa** pro texto genérico. Sem essa guarda ele apagava a
  frase da **drenagem** no segundo passo dela: a drenagem mexe as DUAS barras, a frase tem que
  sobreviver às duas, e o passo que desce a barra do alvo (`absorbdano`) não é golpe comum nem
  abertura — caía no genérico e comia a explicação. Quem devolve o "Trocando golpes..." é o
  `render()`, e ele só acontece onde a frase já cumpriu o papel.
- **SÓ VALE PRA GOLPE COMUM** (`x` vazio). Explosão, sono, cura, drenagem, poção e Faixa já têm
  frase própria no `avisoDoConfronto`, e ali ela conta o confronto INTEIRO ou uma abertura —
  escrever "Fulano usou X" por cima apagaria a explicação que o número não dá.
  **O SONO ERA A EXCEÇÃO e deixou de ser** (09/09/2026): as trocas livres dele saíam sem nome de
  golpe porque a frase ocupava a linha o confronto inteiro. Foi reportado, e hoje ele é abertura
  como a anulação — ver `passosDaAbertura`. Quem ainda ocupa a linha inteira é só a
  **autodestruição**, e ali não há golpe seguinte pra nomear.
- **SÃO CINCO LAÇOS DE ANIMAÇÃO, e todos os cinco pintam**: jornada/ginásio da cidade, batalha
  especial (Elite, Rocket, Mewtwo), Torre/raide, liga assistida e **online**. O online é o único com
  perspectiva — os matchups vêm do lado A —, então quem é o B vira **nome, espécie e golpe** junto
  (`mFrase`), pelo mesmo motivo pelo qual o aviso especial já virava os lados: sem isso a tela diz
  que o adversário usou o golpe que fui eu quem usou. Deixar o online de fora faria dele a única
  batalha muda, e exceção em lista é onde a próxima omissão se esconde.
- **O selo é o `golpeSeloHtml` do log** — mesma palavra, mesma cor. O golpe que ele lê durante a
  luta é o golpe que ele relê no diário depois. O nome do pokémon vai em **azul** (eu) ou
  **vermelho** (adversário), e a frase sai em peso 600 e não 800: o golpe comum aparece a cada
  troca, e em negrito a linha piscaria a luta inteira.
- **Medido:** numa amostra de 1.549 passos, **1.348 (87%) mostram o nome do golpe** e 190 mostram a
  frase especial. Nenhum passo fica sem nada.

### O cadáver que atacava: o moribundo que VOLTA VIVO (09/09/2026)

> **⚠️ ISTO É HISTÓRIA desde 15/09/2026: o GOLPE MORIBUNDO ACABOU** (ver a seção própria). O motor
> não gera mais a marca `m`, então nenhum caso novo nasce por este caminho. O reordenamento que
> esta seção descreve **fica no código**, e é por causa dela: diário gravado antes daquela data tem
> a marca, e sem ele aquele log volta a mostrar pokémon atacando com a barra em zero.

Reportado com print, durante o experimento do teto de dano desligado: **Ivysaur 0/180** contra um
Geodude que terminou com **14**, e a linha do Ivysaur vinha **depois** da que o matou.

- **A causa não era o log** -- era o reordenamento do golpe moribundo. Instrumentando o motor:
  o Ivysaur bateu **295 num Geodude de 155**, o Geodude caiu, revidou moribundo e matou o Ivysaur.
  **Os dois morreram** -- e aí o desempate por morte súbita ressuscitou o Geodude com 5%-15% da
  vida. O diário é escrito DEPOIS disso, então grava −144 em vez de −295.
- **O `m` marcava quem termina VIVO.** O reordenamento existe pra que ninguém apareça atacando
  depois de cair, e ele puxa o golpe marcado pra frente. Só que ali o marcado era o Geodude, que
  sobreviveu -- puxar o golpe dele jogou o Ivysaur, que morreu de verdade, pro fim.
- **A regra nova:** o reordenamento **só vale se o moribundo tiver ficado morto**. Quando ele volta
  vivo pelo desempate, a ordem natural do diário já é a legível -- quem estava vivo bate, o outro
  revida, e o placar do cabeçalho confirma quem sobrou.
  **⚠️ ESSE SEGUNDO RAMO MORREU EM 12/09/2026** (ver "A MORTE SÚBITA ACABOU"): sem empate, o
  moribundo **nunca** volta vivo, então hoje a condição é sempre verdadeira e o reordenamento sempre
  vale. A condição FICA no código porque ela lê o diário, e **diário antigo tem empate gravado** --
  um log de setembro relido hoje precisa dela pra continuar legível. O que não existe mais é o motor
  produzir um caso novo.
- **ELE EXISTE EM PRODUÇÃO, e isso é o que mais importa aqui:** com o teto ligado são **4 casos em
  4.280 confrontos (0,09%)**; sem o teto, **660 em 4.235 (15,6%)**. O experimento não criou o
  defeito, só o tornou 165× mais frequente -- sem teto um golpe derruba de vida cheia e a troca
  dupla vira rotina. Depois do conserto: **zero**, nos dois casos.
- **O INVARIANTE que o teste cobra** é preciso: quem termina o confronto **morto** nunca aparece
  atacando com a barra em zero; quem termina **vivo** pode -- é o par do moribundo, os dois golpes
  são do mesmo instante. Conferido que, tirando a ressalva do `passosVisiveis`, ele acusa **194
  cadáveres em 1.277 confrontos**.

### O MORIBUNDO DE QUEM DORMIU VAI PRO COMEÇO DO CONFRONTO (10/09/2026)

> **⚠️ ISTO É HISTÓRIA desde 15/09/2026**: sem golpe moribundo, quem morre dormindo não revida mais
> e não há o que reordenar. O código fica pra log velho, como o da seção acima.

Reportado com print: num **Psyduck × Gastly** o Gastly dormiu o Psyduck e deveria bater **duas vezes**
seguidas — a troca livre que o sono compra mais a troca normal, que ele abre por ser mais rápido —,
mas o log lia *"Gastly bateu / Psyduck bateu / Gastly bateu"*.

- **O MOTOR ESTAVA CERTO, e dá pra provar pelo próprio print.** O golpe do Psyduck era o revide
  **MORIBUNDO**, do mesmo instante do golpe que o matou. Duas evidências: a ordem da troca é
  decidida por velocidade pura (Gastly **80**, Psyduck **55**), então não existe troca em que o
  Psyduck bata primeiro contra ele; e 107 + 78 = **185**, o HP cheio do Psyduck, ou seja o −78 é o
  golpe que o matou e o −135 que aparecia ACIMA dele veio depois.
- **O DEFEITO ERA DA ORDENAÇÃO, e era de leitura.** A regra de sempre põe o moribundo **uma linha**
  atrás, antes do golpe que derrubou quem o deu — o que resolve o cadáver atacando, mas aqui PARTIA
  AO MEIO justamente a sequência de golpes que o sono compra. Ou seja, a única coisa que o sono FAZ
  virava invisível.
- **Hoje ele vai pro COMEÇO do confronto, antes até da linha do sono**: *"Psyduck atacou / Gastly fez
  Psyduck dormir / Gastly atacou / Gastly atacou"*. É a mesma licença que a regra geral já usa — os
  dois golpes são do mesmo instante e a ordem aqui é apresentação, não cronologia.
  **SÓ VALE PRO ADORMECIDO** (o `q` do registro do sono é quem USOU o golpe, então o adormecido é o
  outro lado) **e só se quem o matou terminar VIVO**: numa troca em que os dois caem, o revide na
  frente deixaria o outro batendo depois de ter chegado a zero — o defeito que o reordenamento
  existe pra evitar.
- **São DOIS caminhos, e os dois mudaram.** O `passosVisiveis` cobre o confronto curto (o do print);
  o `moribundoDoSono`, dentro do `sequenciaDoConfronto`, cobre o que passa do teto e cai na
  reconstrução — lá ele já ia pra ANTES DA ÚLTIMA troca livre, o que também partia a sequência.
  Passando do teto o revide não é linha própria (a reconstrução o absorve no golpe daquele lado), e
  isso é o esperado: o que a trava cobra nos dois casos é que os golpes fiquem **colados**.
- **⚠️ A LINHA DO MEIO DA BATALHA TEVE QUE MUDAR JUNTO, e é a parte que quase passou.** O
  `passosDaAbertura` contava os passos **a partir do zero**, não de onde a abertura está. Com a
  linha do sono deixando de ser o primeiro passo, a frase dele aparecia **enquanto o Psyduck dava o
  revide** e sumia **justamente no passo em que ele dorme**: contava a história trocada. Hoje a
  janela é `[i, i+n)` quando a abertura está no índice 0 — a conta de sempre, intocada — e
  `[i+1, i+n)` quando ela vem depois, porque ali o passo anterior é um golpe de verdade, com nome
  próprio pra mostrar.
- **E O TEMPO DE LEITURA VAI JUNTO.** A linha do sono não move barra (dano 0), então fora do passo 0
  ela apareceria e sumiria no mesmo quadro — o defeito que a Faixa de Foco já teve. O passo ganha a
  marca `leitura`, que vale o mesmo segundo do `pausaDaFaixa` e força o redesenho do passo seguinte
  (senão a frase ocuparia o lugar do "Trocando golpes..." pelo resto da luta). Em troca, o
  `pausaDoEspecial` passou a perguntar pelo **passo 0** em vez de perguntar sem passo: sem isso ele
  gastava um segundo parado numa tela que só dizia "Trocando golpes...".
  A pausa de abertura **continua valendo quando outra abertura ocupa o passo 0** — um confronto com
  anulação junto tem as duas frases, cada uma com o próprio segundo.
- **Medido: 4,3% dos confrontos com sono** (21 em 484). É exatamente a fatia que estava quebrada
  antes — ou seja, o conserto alcança todos os casos relatados.
  Os confrontos com sono que **continuam** sem dois golpes colados não são defeito: em 144 de 235 o
  dono do sono só chegou a dar UM golpe (a troca livre matou, ou ele mesmo caiu), e nos outros o
  adormecido é o mais RÁPIDO, então ele acorda e bate primeiro.
- `tools/test-especiais.js` tranca as sete pontas no par do print: que o revide abre o confronto
  (nos curtos), que os golpes de quem dormiu ficam colados, que **ninguém ataca com a barra em
  zero**, que a soma de dano continua fechando, que a linha mostra o NOME DO GOLPE no revide e a
  frase do sono no passo do sono, e que o segundo de leitura acompanhou. A trava do PERFIL da linha
  (`EEggg`) passou a escolher confronto **sem moribundo** de propósito: com ele o perfil é outro, e
  legítimo.
- **Dois flakes da FÚRIA saíram junto, e eram do teste, não do jogo.** O bloco da Faixa de Foco usa
  um **Charizard**, que está na lista da Fúria: a soma dele não fechava por exatamente 10 (o
  `FURIA_BONUS`) quando ela saía, e a trava do "depois dela quem ataca primeiro é o Charizard"
  quebrava quando os dois caíam na mesma troca e a metade 2 virava uma linha só, do outro lado.
  Conferido: **todo confronto sem fúria fecha**. Falhavam ~1 rodada em 15, que é o pior tipo de
  teste — o que passa quase sempre.

### A MORTE SÚBITA ACABOU (12/09/2026) — e com ela três relatos de uma vez

> **⚠️ O PISO DE 1%–10% QUE ESTA SEÇÃO CRIOU SAIU EM 15/09/2026**, junto com o golpe moribundo: sem
> revide não há o que limitar. O que ela garantia continua valendo, e agora **por construção** — os
> dois só caem na mesma troca pela autodestruição. Os números medidos aqui (o revide acontecia em
> 59,4% dos confrontos e era letal em 20,0%) descrevem o motor **daquela** época.

Pedida assim: *"não quero mais que exista isso, não existe de os 2 cairem juntos, somente na auto
destruição; fora isso, jamais os 2 devem morrer juntos e um ficar de pé"*.

- **O QUE MUDOU NO MOTOR É UMA LINHA: o revide moribundo não mata.** Ele deixa o outro entre **1% e
  10% da barra** (sorteado a cada vez). Era ele a ÚNICA coisa do motor que fazia os dois caírem na
  mesma troca; sem isso, não há o que desempatar.
  **A AUTODESTRUIÇÃO CONTINUA MATANDO OS DOIS**, que é o que o pedido preserva: ela zera o HP dentro
  do `tentarGolpeEspecial` e devolve antes de chegar no bloco de troca. Medido: **148 de 148**
  confrontos em que os dois caem são autodestruição.
- **⚠️ O PISO NÃO APARECE NA TELA, e isso foi pedido com estas palavras:** *"não deve ser exibido na
  tela para o usuário ver, deve ficar mascarado na lógica/mecânica da batalha"*. Não há linha, frase
  nem selo — o log mostra o dano que REALMENTE saiu (o diário sempre grava o efetivo) e a barra para
  onde parou. De fora, é um golpe que não matou.
  Conferido com rng fixo: `rng=0.5` deixa o alvo em **5,47%** e `rng=0.999` em **9,89%**, batendo
  com a fórmula, e o diário sai **sem nenhuma linha especial**.
- **NUNCA SOBE A VIDA DE NINGUÉM**: o piso é aparado no que o alvo tinha ENTRANDO na troca, então um
  pokémon que já estava abaixo de 10% continua onde estava — o revide só não o derruba. Sem esse
  teto, um alvo raspando terminaria a troca com MAIS vida do que começou.
- **O APARO DA LINHA ANDA PRA TRÁS** (`apararRevide`), e não só na última entrada como o da Faixa: o
  alvo sorteado pode ser MAIOR do que o último tapa tirou, e aí o de antes também tem que ceder. É a
  mesma conta que o aparo do desempate usava antes de ele deixar de existir. Os tapas que sobram em
  zero saem da lista, senão o selo prometeria "3x" numa linha que mostra dois.
- **⚠️ O SORTEIO SÓ ACONTECE QUANDO O PISO VALE.** Ler o rng fora disso deslocaria a semente inteira
  e mudaria batalhas que não têm revide nenhum — é a mesma armadilha que o Whirlwind quase trouxe no
  mesmo dia, e a que o `op.semCritico` da confusão registra pelo outro lado.
- **⚠️ O QUE SAIU JUNTO É O TAMANHO DA DECISÃO.** Foram embora a ressurreição com 5%-15%, o aparo da
  linha que ela obrigava, a linha ⚖️ do log, o `x:'desempate'` gerado, os registros que o `gravar`
  devolvia só pra ela achar a linha certa, e a colocação dessa linha no meio da sequência.
  **E, principalmente, foram embora TRÊS relatos seguidos que eram todos consequência dela:**

  | print | o que se via | era |
  |---|---|---|
  | Raticate × Gyarados (09/09) | "atacou 2x seguidas" | o golpe aparado sumindo da tela |
  | Porygon × Gastly (11/09) | "o mesmo golpe tirou 154 e depois 2" | o aparo escrevendo um número que nunca aconteceu |
  | Gyarados × Arbok (12/09) | "ele mesmo sem hp tirou −37 e ficou de pé" | o revide do que caiu, e a volta contada depois |

  Cada um custou uma volta de conserto na ORDENAÇÃO — e a causa era sempre a mesma. Tirando a causa,
  os três deixam de existir **por construção**, e não por ordenação esperta.
- **AS EXCEÇÕES QUE ELA TINHA OBRIGADO MORRERAM NO MESMO DIA:** o `revideLetal` (que impedia o
  revide que mata de subir) e a tolerância da trava de colagem pro "revide letal" duraram horas. Com
  o empate fora, **a apresentação voltou a nunca criar colagem** — medido, 15 na tela contra 40 no
  diário — e **ninguém ataca com a barra em zero**, agora por construção: quem cai fica caído, e
  quem revida estava vivo quando revidou.
  O que ficou de pé dos dois é só o que serve a **log velho**: a linha `x:'desempate'` continua
  sendo desenhada (`passosHtml`, `fraseDoEspecial`) e o `revideLetal` continua guardando a ordenação
  de um diário antigo, que pode ter revide letal gravado. O que não existe mais é **gerar** um novo.
- **⚠️ O PISO PEGA EM 20% DOS CONFRONTOS, e é esse número que explica o resto desta seção.** Medido
  em 12.817 confrontos: o revide moribundo acontece em **59,4%** deles, e em **20,0%** ele era
  LETAL — ou seja, um em cada cinco confrontos do jogo terminava com os dois caindo e a morte súbita
  decidindo. Não era um caso raro que se conserta por ordenação: era um quinto das lutas.
  Onde o alvo termina: **0,25% a 10,00% da barra, média 4,75%**.
  **O 0,25% é o teto funcionando, não um furo:** quem já entrou na troca abaixo de 1% fica onde
  estava, porque o piso nunca SOBE vida.
- **O PREÇO NA JORNADA: −2,65 pontos de conclusão, e é a maior mexida de dificuldade desde o
  moveset dos NPCs.** 69,88% contra **67,22%**, **7,2σ** — 8 blocos de 1.500 jornadas de cada lado,
  desvio tirado de ENTRE os blocos. **Os 8 de 8 blocos apontam pro mesmo lado**, que é o teste que
  importa: não é amostra sortuda. E a direção é pro lado DIFÍCIL.
  **⚠️ E ELE SE CONCENTRA NO 8º GINÁSIO** (3 blocos de 2.000 jornadas de cada lado):

  | ginásio | game overs antes | depois |
  |---|---|---|
  | 1º | 518 | 548 |
  | 5º | 294 | **269** |
  | 6º | 403 | **337** |
  | **8º** | 598 | **833** |

  O 8º sobe **39%** e o 6º até CAI. Faz sentido: é no fim que os confrontos se decidem em poucas
  trocas, e era lá que o jogador trocava o pokémon moribundo por um abate. Esse negócio acabou —
  hoje o adversário fica de pé com 1%-10% e continua lutando.
  Se um dia incomodar, a régua é a FAIXA do piso: subi-la (15%-25%) devolve parte, porque o que
  aperta não é o alvo sobreviver, é ele sobreviver com quase nada e ainda assim ter que ser morto
  de novo pelo pokémon seguinte.
- **⚠️ QUEM SOBREVIVE À TROCA DUPLA MUDOU DE LADO, e é essa a mexida de verdade.** Antes ela era
  ganha por **fração de vida** (o desempate escolhia quem entrou mais inteiro) e o vencedor voltava
  com 5%-15%; hoje ela é ganha por **quem conectou primeiro** — ou seja, por VELOCIDADE —, e quem
  fica de pé é o outro lado, com 1%-10%.
  É uma troca de critério, não um ajuste de número: a velocidade já decidia a ordem dos golpes e a
  taxa de crítico, e agora decide também quem leva a troca mortal. Não foi compensado em nada.
  **O preço na jornada está medido logo abaixo.**

### QUEM JÁ ESTAVA RASPANDO NÃO LEVA REVIDE (13/09/2026)

> **⚠️ ISTO É HISTÓRIA desde 15/09/2026: não existe mais revide de quem cai**, então o ramo que esta
> seção criou saiu junto. O relato que a originou (o Golem tirando −4 com Terremoto) não pode mais
> acontecer — ali não há golpe nenhum.

Reportado com print: *"Golem × Mr. Mime, por que o Golem tirou apenas 4 de HP, sendo que o ataque
Terremoto é bem forte e eles eram do mesmo nível?"*.

- **O MOTOR ESTAVA CERTO, e dá pra provar pelo próprio print.** O Terremoto do Golem no Mr. Mime
  tira **348 em média — 107% da barra dele**. O que aconteceu é que o Golem tinha acabado de MORRER
  pra uma Folha Mágica (Planta é **4×** contra Pedra/Terra: 351 num Golem de 365), aquilo era o
  **revide moribundo**, e o Mr. Mime já estava com **23 de 331**. O piso do revide sorteou 19, e a
  conta deu 4.
- **⚠️ MAS O PISO FORÇAVA O VALOR SORTEADO MESMO EM QUEM JÁ ESTAVA NA FAIXA.** Ele promete que o
  alvo **termina** entre 1% e 10% da barra; se o alvo JÁ entrou na troca dentro dessa faixa, a
  promessa já está cumprida — descê-lo até o sorteio não acrescentava regra nenhuma, só um número
  sem sentido na tela. Hoje ele fica exatamente onde estava, e o revide não gera linha (dano zero
  não é golpe, pela regra de sempre).
- **Medido:** o alvo já estava dentro da faixa em **7,9% dos confrontos**; em **1,3%** deles isso
  virava uma LINHA com um número que não explica o golpe (nos outros o dano já dava zero e a linha
  nem aparecia). Depois: **359 → 5**, e os 5 são artefato da conta do medidor, não do jogo.
- **⚠️ O PREÇO NA JORNADA: −0,86 ponto de conclusão** (54,90% → 54,04%), 6 blocos de 1.200 jornadas
  de cada lado (**7.200 de cada**), com **5 de 6 blocos** apontando pro mesmo lado — **2,0σ**, no
  limite do ruído e para o lado difícil. Pra comparar: o +2 dos líderes foi −11,42 pontos (18σ), ou
  seja 13× maior. O efeito existe porque o alvo do revide guarda os poucos pontos que tinha, e isso
  vale pros dois lados — mas quem carrega HP entre confrontos com mais frequência é o time que está
  vencendo.
- **O REVIDE CONTINUA DOENDO quando ele NÃO ia matar** — o piso só roda quando o revide mataria
  (`revideIaMatar`). Um Tyrogue tirando 37 de um Magneton com 45 é o dano REAL dele, e continua
  saindo: o revide existe pra um pokémon raspando não varrer uma fila de graça.
- **A FAIXA VIROU CONSTANTE** (`REVIDE_PISO_MIN`/`REVIDE_PISO_MAX`): ela era `0.01 + rng*0.09`
  escrita à mão, e o caso novo precisa LER o teto dela. Dois lugares com o mesmo 10% divergiriam no
  primeiro ajuste — e este é um número de balanceamento, ele custou 2,65 pontos quando entrou.
- **⚠️ O SORTEIO CONTINUA SENDO LIDO** mesmo no ramo que não o usa: ler o rng um número diferente de
  vezes desloca a semente inteira e muda batalhas que não têm revide nenhum. É a mesma armadilha que
  o Remoinho quase trouxe, e o teste **lê o código** pra cobrar que o `pct` é calculado ANTES do ramo.

**⚠️ E ESTE TESTE CUSTOU QUATRO TENTATIVAS, TODAS PELO MESMO MOTIVO: montar o cenário errado e medir
outra coisa.** Fica registrado porque cada uma é uma armadilha de quem for escrever o próximo:

| o que eu montei | por que media outra coisa |
|---|---|
| o alvo do revide como time **B** | o `preservePlayerHp` preserva o **A** e CURA o B -- o alvo entrava cheio |
| um Tyranitar (vel. 61) contra um Ratata (72) | **quem bate primeiro é quem leva o revide**: os papéis invertiam |
| o alvo com 9% da barra | o revide de um Caterpie não o mataria, o piso nem rodava, e o dano saía inteiro (legítimo) |
| um Alakazam no painel | ele aprende **Recuperar**: entrava com 3%, se curava na abertura e lutava de barra cheia |

E a quinta: o painel de "meia barra" não garante meia barra **na última troca** — num confronto
longo o alvo chega raspando lutando, e ali o dano zero é o conserto funcionando. A asserção passou
a olhar o HP no momento do revide, lido do diário.

### QUEM ESTÁ RASPANDO NÃO DERRUBA UM POKÉMON CHEIO NUM GOLPE (14/09/2026)

> **⚠️ ESTA CONTINUA VALENDO** — ela é sobre o **ATAQUE** de quem tem pouca vida, não sobre o revide
> de quem caiu. O que mudou em 15/09/2026 é que ela deixou de ser "a outra metade do piso do revide"
> e passou a ser a **única** metade: o piso saiu com o golpe moribundo.

Reportado com print: uma **Ponyta com 10 de 362 (2,8% da barra)** atravessou um **Heracross** e um
**Victreebel cheios**, matando cada um com um golpe e **sem tomar nada de volta**. O pedido foi
direto: *"quando for assim de um pokémon com menos de 10% de hp for levar o outro com vida cheia em
um golpe só, coloque que o dano dele vai ser de 70%, pois se formos pensar na lógica, um pokémon
muito ferido não deveria aguentar tanto numa luta"*.

- **⚠️ ELA É A OUTRA METADE DO PISO DO REVIDE, e por isso as constantes moram lado a lado.** O caso
  do print é a soma de duas regras recentes: desde **12/09** o revide moribundo não mata (para em
  1%–10%), e desde **13/09** ele nem gera linha quando o alvo **já estava** nessa faixa. Juntas, elas
  deixavam quem está raspando matar de vida cheia, **não levar revide nenhum**, e seguir pro próximo.
  Esta trava fecha o ciclo pelo lado do **ATAQUE**.
- **O TETO É 70% DA BARRA DO ALVO** (`MORIBUNDO_TETO_NO_CHEIO`), então ele fica com **30%** e revida
  de pé. **Não é "70% do dano"**: um golpe de 800 numa barra de 400 ainda mataria, e o que se quer é
  que ele **não mate**.
- **AS TRÊS CONDIÇÕES**, e cada uma tem caso de teste próprio — uma trava que morde onde não devia é
  pior que trava nenhuma:
  1. o atacante abaixo de **10%** da barra dele (`MORIBUNDO_ABAIXO_DE`);
  2. o alvo com a vida **CHEIA** — contra quem já está machucado ele mata normalmente;
  3. o ataque **matando** — um golpe que não mataria sai inteiro.
- **⚠️ O TETO VALE POR TROCA, NÃO POR GOLPE.** Um Tapa Duplo de 5 tapas também "leva o outro num
  ataque só", e limitar só o primeiro tapa deixaria os outros quatro matarem do mesmo jeito. Ele
  reparte o teto entre os tapas na mesma proporção, pra a linha do log continuar coerente com o selo
  `Nx`. Medido: **363 de 363** trocas de multi-tapa deixam o alvo em ~30%.
- **⚠️ O REVIDE MORIBUNDO FICA DE FORA**, e isso é decisão: ali o atacante **já caiu** (hp 0, ou seja
  sempre "abaixo de 10%") e o revide dele já tem a própria trava — o piso de 1%–10%. Somar as duas o
  apararia duas vezes.
- **A REGRA É SOBRE MATAR DE VIDA CHEIA, não sobre o confronto inteiro:** depois da primeira troca o
  alvo já está em 30% e a trava deixa de valer — ele morre na troca seguinte, **e nesse meio-tempo
  revidou**. É exatamente isso que o pedido quer.

**MEDIDO NO CASO DO PRINT:** uma Ponyta em 3% contra um painel de 4 cheios derrubava **2 ou mais**
em **25 de 600** batalhas; hoje, **0 de 600**.

**⚠️ O PREÇO NA JORNADA É GRANDE, E ELE VAI PRO LADO FÁCIL: +3,75 pontos de conclusão.**
**58,34% contra 62,09%**, **3,6σ** — 8 blocos de 800 jornadas de cada lado (**6.400 de cada**, desvio
tirado de ENTRE os blocos), com **7 de 8 blocos** apontando pro mesmo lado. É a terceira maior mexida
de dificuldade desta série, atrás do moveset dos NPCs (−12,56) e do +2 dos líderes (−11,42).

**⚠️ E ISSO CONTRARIA A INTUIÇÃO, porque a trava cai dos DOIS lados — a explicação é QUEM ficava
raspando.** Numa batalha o time entra cheio e quem sobrevive a um confronto carrega o HP pro
seguinte: ou seja, o pokémon raspando é sempre **o que está VENCENDO**, e o cheio é o que acabou de
entrar. Quem vencia confrontos seguidos era o líder — e era ele que varria o time do jogador de vida
cheia. Tirar isso devolve ao jogador as trocas que ele perdia de graça.
**A FORMA confirma, e ela se concentra no fim** (1.500 jornadas de cada lado):

| ginásio | game overs sem | com |
|---|---|---|
| 1º | 102 | 95 |
| 5º | 56 | 50 |
| 6º | 126 | **104** |
| **8º** | 318 | **289** |

- **Se um dia incomodar**, as réguas são o **gatilho** (`MORIBUNDO_ABAIXO_DE`, hoje 10% — baixá-lo
  pra 5% faz a trava morder metade das vezes) e o **teto** (`MORIBUNDO_TETO_NO_CHEIO`, hoje 70% —
  subi-lo pra 90% deixa o alvo com 10% em vez de 30%, ou seja de pé mas quase morto). O gatilho é o
  mais forte dos dois, porque ele decide QUANTAS trocas passam por aqui.

**⚠️ E ELA APAGOU UM CENÁRIO INTEIRO DO TESTE, que é a lição a guardar daqui.** A varredura do piso
do revide montava "o forte raspando mata o fraco CHEIO, e o fraco revida" — com a trava, o forte
para em 70%, ninguém morre, e a varredura foi de **300+ casos para ZERO**: o teste falhava sem nada
do piso ter mudado. O fixture passou a entrar com o fraco em **60%** (onde a trava não vale) e a
usar o `doExchange` direto — porque o `simulateGymBattle` **cura o time B** e o alvo voltava a entrar
cheio. É a mesma armadilha do `preservePlayerHp` pelo **terceiro** caminho.

### HISTÓRIA: O DESEMPATE GANHOU LINHA (09/09/2026) — a mecânica acabou em 12/09, ver acima

Reportado com print: num **Raticate × Gyarados** o Gyarados aparecia atacando **duas vezes**
seguidas, sem nada entre os dois golpes.

- **A causa é o desempate por morte súbita.** Quando os dois caem na mesma troca, um volta com
  5%-15% da vida — e o motor **apara a linha do golpe que o derrubou** pra a soma do log fechar com
  a barra do cartão (é o `dz`, que já existia). Quando o sobrevivente volta com a MESMA vida com
  que entrou na troca, essa linha vai a **ZERO** e some da tela pela regra do "golpe de dano zero
  não é golpe" — deixando os dois golpes do outro lado colados.
- **O `dz` estava escrito e NUNCA era lido** — dado morto desde que a correção do desempate nasceu.
  Era exatamente o gancho que faltava.
- **A PRIMEIRA CORREÇÃO (09/09/2026) FOI PEQUENA DEMAIS, e vale registrar por quê.** Ela fez a linha
  **zerada** virar `x:'desempate'` — no molde da Faixa de Foco: um passo que não move barra, uma
  frase no log e o mesmo aviso no meio da batalha. Resolveu o print do Raticate × Gyarados e cobria
  **0,1% dos confrontos**: exatamente o caso em que o aparo zera o golpe e ele some da tela.
  O que ela não viu é que o aparo acontece em **14,3%** — e nos outros 14,2% ele não fazia o golpe
  sumir, fazia ele **mentir**. Os três prints abaixo são esses 14,2%.
- **⚠️ O APARO ACABOU EM 11/09/2026, e com ele a família inteira de defeitos.** Até aqui, quando os
  dois caíam na mesma troca, o motor **aparava o golpe que derrubou o sobrevivente** pra a soma do
  log fechar com a barra do cartão — ou seja, escrevia na tela **um número que nunca aconteceu**.
  Foram TRÊS relatos, e são o mesmo defeito visto de três ângulos:

  | print | o que se via | o que era |
  |---|---|---|
  | **Porygon × Gastly** | "o mesmo golpe tirou 154 e depois 2" | o 2 era o aparo |
  | **Togepi × Magnemite** | "tirou −175, já era pra matar, e ele ficou com 24" | o aparo caindo na linha errada num golpe de vários tapas |
  | **Bellsprout × Onix** | "ela tomou 26 e morreu, mas apareceu que os dois caíram" | o Onix **caiu mesmo** e voltou com 22 — o aparo baixou o golpe dela de 170 pra 148 e o log deixou de mostrar a queda |

  O terceiro é o que fechou o assunto: ali a frase era a única coisa dizendo a verdade, contra
  números que diziam outra — e o jogador acreditou nos números, **com razão**.
- **HOJE O DANO É O DANO, E A VIDA QUE VOLTA É UMA LINHA.** O golpe fica com o que realmente saiu, e
  a morte súbita vira uma entrada própria com a **barra SUBINDO** — a mesma mecânica da cura, da
  poção e da fúria (`amount` negativo). A conta fecha pelo lado honesto: `dano − devolução = a barra`.
  Medido: a soma do log fecha em **1.402 de 1.402** confrontos com desempate.
  A frase passou a dizer **com quanto** ele ficou de pé, e esse número é o que a barra acabou de
  mostrar subindo: *"⚖️ os dois caíram na mesma troca, e Onix ficou de pé com 22 de HP"*.
- **⚠️ A LINHA DA VOLTA ENTRA LOGO DEPOIS DO GOLPE QUE DERRUBOU QUEM VOLTOU (12/09/2026), e é ela
  que faz "ninguém ataca com a barra em zero" virar verdade ABSOLUTA.** Reportado com print num
  **Gyarados × Arbok**: *"a arbok já era para ter morrido no terceiro ataque, mas ele mesmo sem hp
  tirou −37 do gyarados e depois ficou em pé; isso não pode acontecer jamais"*. E estava certo — a
  Arbok chegava a 0, revidava, e só então a linha lá embaixo contava que ela tinha voltado.
  O motor grava a linha no FIM do diário (é lá que o desempate acontece). A tela passou a colocá-la
  onde a cena fecha: **ele cai, a barra SOBE na linha do desempate, e aí ele ataca.** Os dois golpes
  continuam sendo do mesmo instante — a ordem aqui é apresentação, a mesma licença que o
  reordenamento do moribundo já usa.
  **Medido: quem ataca com a barra em zero vai de 11,47% dos confrontos para ZERO.**
- **⚠️ E AQUI HÁ UM CONFLITO REAL, resolvido por decisão e não por engenharia.** Quando o revide
  moribundo é **LETAL**, não existe ordem que evite as duas coisas ao mesmo tempo — foi verificado
  caso a caso:

  | ordem | o que sai errado |
  |---|---|
  | a crua do diário | quem deu o revide **ataca com a barra em zero** |
  | revide um lugar atrás + a linha da volta no meio | ele fica **colado** no golpe anterior do mesmo lado |

  O pedido decidiu qual das duas: *"isso não pode acontecer jamais"*. **A colagem é o preço**, e ele
  está medido: ela vai de **0,44%** (a que o diário já tinha, dos empates de velocidade) para
  **2,26%** dos confrontos. É o menos ruim dos dois — dois golpes seguidos do mesmo lado o motor
  produz de verdade (o desempate de velocidade é sorteado a cada troca), enquanto atacar a zero não
  acontece nunca.
  `tools/test-especiais.js` cobra exatamente isso: a apresentação **só** pode criar colagem onde o
  revide foi letal; em qualquer outro confronto, criar colagem continua sendo defeito.
- **⚠️ E O REVIDE LETAL NÃO SOBE — ele anda um lugar atrás, e só.** Subindo (a regra de 11/09 que o
  joga pra depois das aberturas), ele fica ANTES dos golpes do pokémon que ele MATOU, e os campos
  `hp` do diário — que são **cronológicos** — deixam de bater com a ordem mostrada: a conta passa a
  ver o sobrevivente caído antes da hora e a linha da volta vai parar no lugar errado. Foi assim que
  a trava acusou 66 confrontos que estavam certos.
- **A LINHA DO REMOINHO NÃO GRAVA `hp`, e isso é da mesma família.** O campo quer dizer "a vida do
  ALVO depois do golpe", e num sopro não há alvo nem golpe. Gravando a vida de quem soprou, toda
  conta que lê o diário passava a achar que o OUTRO lado tinha aquela vida. (A `chuva` ainda grava a
  do usuário — inofensivo hoje porque o golpe seguinte corrige, mas é o mesmo tipo de armadilha.)
- **⚠️ E O APARO ESCONDIA UM QUARTO DEFEITO, no reordenamento do moribundo.** Sem ele, a barra do
  sobrevivente passou a chegar a ZERO na tela — e aí ficou visível que um **revide LETAL** não pode
  ser movido: subindo, ele fica ANTES dos golpes do pokémon que ele matou, e é esse pokémon que
  passa a atacar de barra zerada (3 casos em 10.556, todos com sono); andando um lugar pra trás, ele
  cola dois golpes do mesmo lado (281 em 13.162).
  **⚠️ ESTA CONCLUSÃO DUROU UM DIA.** Ela dizia que a ordem CRUA do diário era a certa nesses
  casos -- e é, se o único critério for a colagem. Em 12/09/2026 o pedido pôs um critério acima
  dela ("ninguém ataca com a barra em zero, jamais"), e aí a ordem crua deixou de servir: ver o
  item da linha da volta, logo acima. O que continua valendo daqui é o diagnóstico: ali o revide
  vem logo depois do golpe que derrubou quem o deu, que é o PAR DO MORIBUNDO, e antes dele está o
  golpe do outro lado. Quem responde "foi letal?" é o próprio diário — o `hp` do registro é a vida
  do ALVO depois do golpe.
  Medido depois: **0 cadáveres** em 12.954 confrontos e **0 colagem criada** pela tela (que mostra
  0,30% contra 0,53% do diário).
- **⚠️ UMA TRAVA TEVE QUE ABRIR EXCEÇÃO, e vale saber por quê.** A regra "quem termina MORTO nunca
  aparece atacando com a barra em zero" valia porque o reordenamento SEMPRE conseguia pôr o revide
  antes do golpe que o derrubou. Com revide letal isso é impossível — as três ordens possíveis têm
  defeito, e a crua é a menos ruim. **Na tela isso fica explicado**: a linha do desempate vem logo
  abaixo e diz que os dois caíram. Sem ela seria um cadáver sem motivo; com ela, é a mecânica sendo
  contada.
- **Conferido que nada disso é motor:** o bloco novo só faz `diario.push`, e o mesmo build com e sem
  a linha dá o **MESMO hash** de resultado em 900 batalhas semeadas.
- **AS OUTRAS DUAS CAUSAS DE "dois seguidos" SÃO REGRA, não defeito**, e ficaram: o **sono** (as
  trocas livres SÃO isso, e a frase dele explica) e a **reconstrução** (ela interpola HP e não
  conhece a ordem real). Medido no total: 0,9% dos confrontos mostram dois seguidos — 119 do sono,
  71 da reconstrução e 24 desta causa, que era a única sem explicação na tela.
- **Na RECONSTRUÇÃO a linha não aparece**, e é o limite conhecido: ela substitui a lista inteira e
  não conhece desempate nenhum — do mesmo jeito que não conhece cura. **Com o fim do teto
  (15/09/2026) isso só alcança log gravado antes de o diário existir.**

### A PROBABILIDADE DOS GOLPES MÚLTIPLOS ESTÁ CERTA — e o que se vê é o contrário do que parece

Reportado como suspeita: *"está caindo muito mais 5x do que 2x, 3x ou 4x"*. **Medido em 51.159
golpes múltiplos de batalhas de verdade:**

| | oficial | medido |
|---|---|---|
| 2 tapas | 37,5% | **38,69%** |
| 3 tapas | 37,5% | 37,41% |
| 4 tapas | 12,5% | 12,24% |
| 5 tapas | 12,5% | **11,66%** |

O sorteio em si é exato (200.000 sorteios por golpe batem os pesos). O desvio que aparece em
batalha é **para BAIXO nos 5x**, e tem causa conhecida: **`tn` é quantos tapas ACERTARAM, não
quantos foram sorteados** — os tapas param quando o alvo cai, então um 5 sorteado vira "3x" na tela
se o alvo caiu no terceiro. Ou seja, 5x sai **menos** que 12,5%, nunca mais.
O que engana é a saliência: um 5x são cinco descidas de barra com a frase mudando a cada uma, e um
2x acaba em dois piscares.

### O golpe fantasma na abertura do confronto (09/09/2026)

Reportado com print: no **Krabby x Machoke** a tela mostrava o **Krabby atacando sem tirar HP
nenhum**, trocava rapidamente pro Machoke, e só então a luta acontecia -- enquanto o log, na mesma
tela, trazia os três golpes certos (Machoke, Krabby, Machoke).

- **A causa:** `game.XLastHit` guarda o último passo animado, e a linha de status passou a ler ele
  pra escrever "Fulano usou GOLPE". Ele **não era zerado ao abrir um confronto novo**, então o
  render de abertura pegava o `q=` do confronto ANTERIOR e cruzava com os NOMES do novo. O
  confronto anterior tinha terminado com um golpe do Krabby, e era esse `q=` que sobrava.
- **O defeito nasceu com o nome do golpe, não com a pausa** -- mas a pausa de 1s o deixou bem mais
  visível: ficava ~1,5s na tela em vez de 550ms.
- **O log nunca mostrou o fantasma** porque ele não lê esse campo: lê a sequência. É por isso que o
  print tinha três linhas certas e a animação, quatro passos -- exatamente a divergência entre log
  e animação que esta seção já registrou duas vezes, agora por um caminho novo.
- **⚠️ O CONSERTO DE 09/09 FICOU PELA METADE, e a outra metade só apareceu em 15/09/2026** (ver
  **E A CENA COMEÇAVA PELO FIM**, na seção do Remoinho): ele zerou os dois juntos **nos pontos que
  já zeravam o passo**, e os pontos que entram em `loading` não zeravam nenhum dos dois -- eles
  desenhavam o confronto novo com o passo do anterior. Hoje há uma porta só, o `abrirConfronto`.
- **O conserto é o LastHit zerar junto com o passo**, em TODO lugar que volta o passo pra 0 -- são
  **8 pontos** (os quatro laços mais os setups da Torre, da raide e do desafio de treinador). O
  teste conta os dois lados e falha se algum `HitStep = 0` ficar sem o `LastHit = null` do lado.
- **O teste olha o ESTADO no instante da abertura, não o log** -- conferido que, tirando a linha do
  `index.html`, ele acusa **3 fantasmas em 4 aberturas**.

### A pausa de 1s entre o nome e a barra

*"Aparece 'Venusaur usou FOLHA NAVALHA', espera 1s, e aí começa a descer o HP do adversário"* —
pedido em 09/09/2026. `PAUSA_ANTES_DO_GOLPE_MS`.

- **O QUE ATRASA É SÓ O VISUAL.** A vida e o passo continuam sendo aplicados na hora, e o que
  desliza um segundo são os TIMERS (a animação da barra, o render e o avanço pro golpe seguinte).
  Não é preferência: o sandbox dos testes tem `setTimeout` no-op de propósito ("as animações não
  existem fora do navegador") e as suites dirigem os laços chamando `advanceX()` na mão. A
  primeira versão movia a APLICAÇÃO pra dentro do timer, e o `test-artimanha` quebrou na hora —
  o passo nunca avançava e o laço lia um `hit` indefinido. **Se um dia a pausa precisar mesmo
  adiar a aplicação, o sandbox tem que passar a rodar os timers primeiro.**
- **SÓ O PASSO QUE MOSTRA NOME ganha a pausa.** Cura, drenagem, poção, sono, explosão e Faixa já
  têm as delas (`pausaDoEspecial` na abertura, `pausaDaFaixa` no meio) — somar mais um segundo
  ali seria pausa em cima de pausa.
- **O PREÇO, MEDIDO, e ele é grande:** são **2,41 golpes nomeados por confronto** (mediana 2, maior
  6), e **97% dos passos** ganham a pausa. A animação de uma batalha 6x6 de ginásio vai de
  **16,3s para 41,6s** — **+25,3s por batalha**, ou +2,4s por confronto. É 2,5× mais lenta.
  Foi pedido assim e está assim; se um dia incomodar, o lugar de mexer é a constante, e meio
  segundo cortaria metade do custo.
- **NO ONLINE A PAUSA ENTRA NO ORÇAMENTO** (`ORCAMENTO_ANIM_ONLINE_MS`), e isso não é detalhe: o
  servidor reserva 5,2s antes de abrir a janela de escolha, e sem a pausa dentro da conta o
  `previsto` subestimaria a animação em 1s por golpe, o fator não encolheria e a luta estouraria a
  janela — a pessoa perderia a escolha. Medido: **os confrontos que cabiam no orçamento eram 100% e
  passaram a ser 58,6%**; nos 41% que não cabem, tudo encolhe pelo fator (média 0,93, menor 0,55),
  e a pausa de 1s vira **545ms no pior caso**. O que se perde é tempo de leitura, nunca a escolha.

### QUATRO TELAS DE BATALHA FICARAM PARADAS POR QUATRO DIAS (13/09/2026)

Reportado como *"a luta contra o Mewtwo lvl 99 que aparece na pokedex, a luta não está
acontecendo"*. E não era o Mewtwo: era o **laço de revelação** que ele usa.

- **A CAUSA É UMA LINHA NA ORDEM ERRADA.** No ramo `animating` do `advanceLeagueWatch`, o pintor do
  nome do golpe recebia o confronto (`m`) e o `const m` estava declarado **três linhas abaixo**.
  `const` é zona morta temporal: a primeira volta estourava `Cannot access 'm' before
  initialization`, a animação morria no primeiro golpe e **a tela ficava parada pra sempre**.
  Os outros três laços declaram `m` primeiro e depois `hit`; este era o único fora de forma.
- **⚠️ E NÃO ERA SÓ O MEWTWO: são QUATRO telas nessa mesma revelação** — o desafio do Mewtwo, a
  **liga assistida**, a **partida da Trainers League** e o **desempate** dela. Todas travadas de
  **09/09 a 13/09/2026**, desde o commit que pôs o nome do golpe na tela.
- **⚠️ A LIÇÃO É A COBERTURA, NÃO A LINHA.** O jogo tem **cinco laços de animação** e só **dois**
  eram dirigidos por teste (o da jornada e o da batalha especial). Um erro assim **não aparece no
  `node --check`** (é de execução, não de sintaxe) nem no carregamento da página: só rodando o laço
  até o fim. Os três descobertos eram justamente onde ele estava.
  `tools/test-especiais.js` passou a **dirigir os laços** da liga assistida e da Torre/raide até
  parar de andar, cobrando que nem a volta que avança nem a que DESENHA estourem, e que a animação
  chegue ao ÚLTIMO confronto. Mais o caminho do relato de ponta a ponta: o desafio do Mewtwo monta a
  luta e ela anda até o fim — sem esse, os dois primeiros continuariam verdes se o desafio parasse
  de chegar na tela de revelação.
  **O quinto laço — o do online — continua de fora**: ele pinta direto no DOM e depende de uma
  partida em curso. Fica dito pra ser decisão e não descuido.
- **⚠️ A CHAVE DO "ANDOU" INCLUI O PASSO DO GOLPE**, e não só (índice, fase): dentro de um confronto
  o laço avança golpe a golpe sem mexer em nenhum dos dois, então um confronto de quatro golpes
  pareceria travado na terceira volta — e o teste acusaria um defeito que não existe. Foi o primeiro
  jeito que escrevi, e ele deu quatro falhas falsas.
- Conferido que o teste acusa com a declaração de volta pra baixo: **`parou em 0/10`**, que é
  exatamente o que o jogador via.

## Log de batalha

- O matchup carrega **`golpes`**: o diário do confronto, um registro por golpe na ordem real,
  escrito por `doExchange`. Não é reconstrução — o motor anota enquanto luta. Só apresentação:
  passar ou não o array não muda um ponto de dano (conferido por hash, 14.645 confrontos).
- **O dano gravado é o EFETIVO, não o sorteado.** Golpe de 101 em quem tem 54 de HP entra como 54.
  Com o valor cru o log não fechava: somando as linhas dava mais dano do que o pokémon tinha.
- **Log e animação leem a MESMA lista** (`sequenciaDoConfronto`). Enquanto eram montadas em separado,
  o jogador via 3 golpes na tela e lia 4, 7 linhas no log — reportado três vezes.
- **⚠️ O TETO DE LINHAS ACABOU EM 15/09/2026 — o log mostra a luta INTEIRA, sempre.** Ver a seção
  **O TETO ACABOU**, logo abaixo. Tudo que vem a seguir sobre o `TETO_GOLPES` é **história**: a
  constante não existe mais, e nenhum confronto com diário cai na reconstrução.

> **⚠️ ISTO É HISTÓRIA desde 15/09/2026.** O teto acabou; o parágrafo fica porque ele explica as
> duas correções que a subida de 3 pra 4 desenterrou, e as duas continuam valendo.
>
> - **O TETO ERA DE 4 GOLPES desde 11/09/2026** (`TETO_GOLPES`, era 3 — a pedido), e ele valia por
>   leitura: uma luta comum tinha que caber em poucas linhas. Medido, 99,4% dos confrontos passam de
>   3 golpes REAIS (mediana 4, 90% até 6, maior 28 em 3.944) — ou seja, o teto não era um detalhe,
>   era ele que decidia o que a tela mostrava quase sempre.
>   **O QUE A SUBIDA COMPROU FOI A VERDADE, e o número é grande:** os confrontos que o jogador lia
>   como uma divisão INVENTADA pela reconstrução caíram de **36,9% pra 11,9%** (11 mil confrontos de
>   cada lado, o mesmo código com a constante trocada). A causa é direta — 4 golpes reais é o caso
>   mais comum de todos, e no teto 3 ele caía inteiro na reconstrução.
>   **O QUE ELA CUSTOU FOI TEMPO DE TELA:** a animação de uma batalha 6x6 foi de **46,9s pra 49,8s**
>   (+2,9s, +6,2%) e os passos por confronto de 2,63 pra 2,93. No log, as lutas de 4 linhas passaram
>   de 4,9% pra **24,6%**.
>   **NA DIFICULDADE, NADA — por construção.** `TETO_GOLPES` era apresentação: não existia no
>   servidor e não entrava em conta nenhuma de dano. Conferido por impressão: o mesmo build com 3 e
>   com 4 dava o MESMO hash de resultado em 900 batalhas semeadas.
>   **Ele chegou a sair inteiro por um dia** (03/09/2026), pra o log mostrar o diário: uma troca
>   banal de Gloom contra Miltank virou **seis linhas** e foi reportado com print. Voltou no mesmo
>   dia — e voltou a sair, pra valer, em 15/09.
- **⚠️ A SUBIDA PARA 4 DESENTERROU DOIS DEFEITOS ANTIGOS, e os dois estavam escondidos pela
  reconstrução.** É a lição a guardar daqui: **o teto não era só um corte de leitura, era uma
  cortina** — tudo que o diário tinha de errado num confronto de 4 golpes nunca chegava à tela,
  porque a tela mostrava outra coisa. Mexer nele é abrir a cortina.
  1. **O REORDENAMENTO DO MORIBUNDO COLAVA DOIS GOLPES DO MESMO LADO.** Num confronto de 4 golpes
     (`p, e, p-mata, e-revide`), pôr o revide um lugar atrás — que é a regra geral — produz
     `p, e, e, p`: o adversário batendo duas vezes sem nada entre os dois, que é a forma já
     **reportada como defeito três vezes** neste log. Medido: **12,6% de TODOS os confrontos**,
     98,8% deles com moribundo.
     O conserto é a mesma licença que o **sono** já usava desde 10/09/2026 — o revide sobe no
     confronto em vez de andar um lugar. Só que ele sobe **para depois das aberturas**, e não para o
     índice 0 como o do sono: cura, poção, drenagem e fúria MOVEM BARRA e são o primeiro passo da
     animação por desenho (a frase de cada uma anuncia a barra que vai andar). Empurrado na frente
     delas, o golpe fazia a barra subir depois do golpe que deveria explicá-la — e foi o teste da
     cura que pegou isso, não a varredura.
     Medido depois: **12,6% → 0%**, e a tela passou a mostrar **menos** colagem que o diário.
  2. **O DESEMPATE INFLAVA O DANO DO LOG QUANDO APARAVA UM GOLPE DE VÁRIOS TAPAS.** Quando os dois
     caem na mesma troca, o motor ressuscita um — e naquele momento ele **aparava a linha do golpe
     que o derrubou** pra a soma do log fechar com a barra do cartão (o `dz`). Só que ele aparava a
     **última entrada** usando o HP de entrada da **troca inteira**, e um golpe de vários tapas
     grava uma entrada por tapa: o dano da troca toda ia parar no último tapa enquanto os anteriores
     ficavam com o deles. Medido num Wigglytuff × Diglett: o log somava **402 numa barra que andou
     294**. E a busca era por **POSIÇÃO** (`diario.length-2`), o que só acerta quando cada lado
     gravou uma entrada só.
     **⚠️ ESTE ITEM É HISTÓRIA: o aparo INTEIRO saiu horas depois**, quando o print do Bellsprout ×
     Onix mostrou que o problema não era a conta do aparo e sim o aparo existir — ver a seção do
     desempate. Ele fica aqui porque é a prova do que o teto escondia: um número errado no diário,
     em 14% dos confrontos, que a reconstrução nunca deixava chegar à tela.

- **DOIS GOLPES SEGUIDOS DO MESMO LADO EXISTEM, E SÃO A VERDADE — o motor empata velocidade.**
  O desempate de quem bate primeiro é **sorteado a cada troca**, então duas espécies de mesma
  velocidade (Skarmory e Butterfree têm 70, Golduck e Seadra têm 85, Zubat e Machamp têm 55) trocam
  de ordem entre uma troca e outra e o mesmo lado bate duas vezes de fato.
  **MEDIDO DE NOVO EM 14/09/2026, em 13.535 confrontos — e os números velhos (0,5% no diário, 0,2%
  na tela) estavam desatualizados:** hoje são **3,19% no diário** e **0,96% na tela**. A tela
  continua mostrando MENOS, que é o que a trava cobra. Subiu porque muita coisa entrou no meio:
  o revide que não mata (12/09), o teto de 4 linhas (11/09) e o Rolamento saindo do teto (14/09).
  **AS QUATRO CAUSAS, medidas** (dos 0,96% que chegam à tela):

  | causa | fatia |
  |---|---|
  | **empate de velocidade** — a verdade do motor | **0,41%** |
  | **sono** — as trocas livres SÃO isso | 0,38% |
  | reconstrução (o confronto passou do teto) | 0,12% |
  | **revide moribundo com dano ZERO** | **0,05%** |

  **⚠️ A ÚLTIMA É EFEITO COLATERAL DO CONSERTO DE 13/09** ("quem já estava raspando não leva
  revide"): quando o alvo do revide já entrou na troca dentro da faixa de 1%–10%, o revide sai com
  dano ZERO — e "golpe de dano zero não é golpe" tira a linha da tela. O par que fecharia a cena
  some, e o outro lado parece ter batido duas vezes.
  Reportado em 14/09 com print de um **Victreebel × Magneton** (os dois com velocidade **70**, ou
  seja empate): o Magneton bateu primeiro nas DUAS trocas e o revide do Victreebel saiu zerado
  porque ele estava com 15 de 305 (4,9%). Reproduzido no motor, número por número.
  **NÃO FOI MEXIDO**, e a razão é a proporção: consertar essa causa resolveria **7 de 130** casos
  (5%), e a causa dominante — o empate de velocidade — continuaria mostrando a mesma coisa. Mostrar
  o revide zerado como linha seria um "−0 de HP" na tela, que é justamente o que este log evita em
  toda regra.
  **É por isso que a trava mudou de forma.** Ela era "ninguém ataca duas vezes seguidas no diário
  real", e isso era verdade **por acidente**: com o teto em 3, todo confronto de 4 golpes caía na
  reconstrução e o diário nunca chegava à tela. Hoje ela é **comparativa** — a apresentação não pode
  CRIAR colagem que o diário não tinha. Exigir zero puniria o motor por dizer a verdade; exigir "não
  criou" pega de volta exatamente o defeito que o teto escondia.
  **E ela não pode ser estatística:** a primeira versão cobrava "a tela mostra MENOS que o diário"
  (23 contra 42 na média, 2,4σ) e falhava sozinha **~1 vez em 100** — o pior tipo de teste que
  existe, o que passa quase sempre. Hoje cobra "não mais", que é verdade por construção.
- **⚠️ NO ESPELHO O EMPATE É A REGRA, E O NÚMERO É 70%.** Perguntado em 16/09/2026 (*"por que que o
  meu Pidgeotto na luta entre Pidgeotto x Pidgeotto, atacou 2x consecutivas?"*), e o motor estava
  certo: **mesma espécie no mesmo nível = mesma velocidade**, então o desempate é sorteado em TODA
  troca e a ordem inverte metade das vezes.
  A conta é fechada: com T trocas há T−1 fronteiras entre elas, e cada uma tem 1/2 de repetir o
  lado — `P(nenhuma repetição) = (1/2)^(T−1)`. Medido num Pidgeotto × Pidgeotto Lv.30, 3.000
  confrontos: **70,3% deles mostram dois golpes seguidos, e 100% por empate de velocidade** (zero
  por sono, zero pelo revide zerado).
  **No jogo inteiro isso é raro** — só **4,5% dos pares de espécies** têm a mesma velocidade base.
- **⚠️ SE UM DIA INCOMODAR, A ALTERNATIVA ESTÁ MEDIDA:** sortear a ordem do empate **uma vez por
  confronto** em vez de a cada troca (guardando a escolha na instância, como o `_especialContra`
  já faz).

  | | espelho Pidgeotto | jogo geral | taxa de vitória |
  |---|---|---|---|
  | **hoje** (sorteia a cada troca) | **70,3%** | 9,57% | 50,9% |
  | fixa por confronto | **0,0%** | 8,78% | 50,8% |

  Ela **resolve o espelho por completo e quase não move o jogo geral** — porque no geral as outras
  causas (sono, revide zerado) dominam —, e **não custa balanceamento**. O preço é outro: ela muda
  o MOTOR (a semente anda diferente), então exige as duas cópias, medição de jornada e cuidado com
  log já gravado. Não foi feita porque não foi pedida.

- **A EXCEÇÃO É O SONO, e só ele.** As trocas livres que ele compra são o que o golpe É, e esmagá-las
  na reconstrução foi a origem dos dois defeitos reportados naquele dia ("um golpe dele, dois dela").
  Elas entram **reais, uma linha cada**, e só o RESTO da luta é reconstruído.
  Medido com o teto em 4: **2 linhas em 55,0%, 3 em 16,5%, 4 em 24,6%**, 5 em 3,5% e 6 em 0,3%.
  (Com o teto em 3 eram 58,9% / 35,4% / 4,9%.)
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
- **O MORIBUNDO DE QUEM DORMIU tem reordenamento PRÓPRIO, e ele faltava.** Quando a última troca
  livre MATA o adormecido, ele ainda revida — e esse revide é do mesmo instante do golpe que o
  derrubou, como todo moribundo. Só que este caminho **não passa pelo `passosVisiveis`**: as trocas
  livres saem do diário cru de propósito (ver o item acima) e o revide cai na **reconstrução**, que
  é montada DEPOIS delas. Resultado: o revide aparecia na última linha, com a barra do dono já em
  zero — um cadáver atacando, o defeito mais reportado deste log, entrando pela porta do sono.
  Hoje o revide é inserido **antes** da última troca livre e o dano dele sai da reconstrução, do
  mesmo jeito que o das livres já saía. Medido: **0,15% dos confrontos** com o teto de dano ligado
  e 0,19% sem ele — ou seja, é defeito de produção, **não** um efeito do experimento do teto (esse
  é o outro caso, o do `passosVisiveis`, que ia de 0,09% pra 15,6%). O número de linhas na tela não
  muda: o revide já era mostrado, só estava no lugar errado.
  **Achado pelo teste, não por relato** — o do cadáver, quando o RNG mudou de semente e caiu num
  Golem que dormiu, tomou três golpes e morreu no terceiro. Por isso o par Golem × Venomoth virou
  fixture fixa dele: depender de sorte de semente pra cobrir um caminho é não cobrir.
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
  **⚠️ E DESDE 12/09/2026 ELE NÃO MATA: ele deixa o alvo entre 1% e 10% da barra** (ver "A MORTE
  SÚBITA ACABOU"). Os 14,6% de confrontos decididos no desempate viraram ZERO, e quem sobrevive à
  troca dupla é sempre quem **CONECTOU PRIMEIRO**, não quem tinha mais fração de vida.
  **A FAIXA VOLTOU A SER A MESMA DE UMA ÉPOCA ANTERIOR, e a coincidência engana:** a ressurreição do
  desempate já devolveu 1%-3%, depois 1%-10%, e terminou em 5%-15%. O 1%-10% de hoje **não é aquele
  número de volta** — é outro mecanismo (ninguém ressuscita; o golpe só não mata), e quem fica com a
  vida é o LADO OPOSTO do que ficava.
  Armadilha: a marca de moribundo tem que sair da SITUAÇÃO (o segundo caiu e revidou), não de o
  dano ter sido reduzido. Enquanto era deduzida do dano, subir o fator pra 1.0 apagava a marca —
  e sem ela o log volta a mostrar pokémon atacando depois de cair.
- O **golpe moribundo** entra **ANTES** do golpe que o derrubou. Não é distorção — os dois são do mesmo instante, e o motor só os aplica em sequência
  porque código roda em sequência. Qualquer outra ordem faz o log dizer que alguém atacou depois
  de cair, e isso já foi reportado como bug três vezes (inclusive na forma "somar o revide numa
  linha anterior", que fazia a linha antiga parecer fatal).
- **O SELO DA DANÇA DA CHUVA É O ÚNICO SELO CLICÁVEL DO LOG** (11/09/2026, a pedido): tocar nele
  abre a caixa que explica o clima. Ele tem o mesmo tamanho e a mesma cor dos outros de propósito —
  o que muda é ser um `<button>`, e por isso ele zera a borda e o padding de fábrica
  (`.selo-clicavel`). É a única exceção à regra de que selo de log é só leitura, e ela existe porque
  o clima é a única coisa do log que muda o dano de TODO MUNDO por três confrontos: a pergunta "por
  que meu Fogo tirou metade?" nasce ali e merece resposta ali.
- **⚠️ QUEM DECIDE SE A LINHA É FRASE OU GOLPE É O `ehGolpeEspecial`, e não uma lista escrita à
  mão no `passosHtml`** (16/09/2026). Ela era uma fileira de 17 nomes, e era o lugar exato onde a
  próxima omissão se escondia: o congelamento nasceu fora dela e as três linhas dele caíram no ramo
  do golpe comum — o log saía com um **`−0 de HP`** e o nome de um golpe que o pokémon não tem.
  Ver a seção do congelamento. **As exceções são o `disable`** (as anulações já saem antes de tudo,
  e sem a guarda ele sairia duas vezes) **e o par `faixa`/`desempate`**, que não são aberturas.
- A linha do log tem **uma forma só**: "X atacou Y com GOLPE e tirou −N de HP". Já passaram por
  ali selo de crítico, de moribundo e de "o tipo não pega nele" — todos saíram: viravam ruído numa
  linha que se lê de relance.
  **O DE CRÍTICO VOLTOU em 10/09/2026**, e vale saber por que o motivo mudou: quando ele saiu, o
  crítico valia ~1,9× e o teto de dano aparava o resultado. Hoje ele vale ×2 exato e não há teto —
  ele DECIDE confronto, e a barra caindo o dobro sem explicação foi reportada como bug. Ele voltou
  pequeno, sem cor forte e colado no número, que é o oposto de como estava quando incomodou. As **exceções são os três golpes especiais** (autodestruição,
  sono e Disable, seção acima): ali não há número pra contar a história, e sem a frase o jogador
  vê dois pokémon caindo juntos -- ou um deles batendo mais fraco do resto da luta -- sem
  explicação nenhuma. As frases vivem no `fraseDoEspecial`, e o aviso do meio da batalha lê a
  mesma função.
- **⚠️ O SELO DE CRÍTICO NÃO SAI EM GOLPE QUE O CORTE ENCOLHEU (12/09/2026).** Reportado com print
  num **Bulbasaur × Onix**: *"no primeiro chicote de cipó ele tirou −152, e depois num ataque foi
  CRÍTICO, ele tirou apenas 9hp, isso fica feio, o onix já deveria ter morrido"*.
  **O MOTOR ESTAVA CERTO E O RELATO TAMBÉM.** O Onix tinha 9 de HP e o crítico o MATOU; o 9 é só o
  que sobrava. Reproduzido: `p -166 | e -57 | p -4 CRIT`, com o Onix em 160/170.
  O defeito é do SELO. Ele existe pra explicar uma barra que caiu o DOBRO — foi por isso que ele
  voltou em 10/09/2026 — e num golpe encolhido a barra não caiu o dobro: caiu o que sobrava. Ali
  ele diz o contrário do que se vê, e o jogador lê *"o crítico tirou menos que o golpe comum"*.
- **⚠️ A REGRA É "O CORTE COMEU A DOBRA", não "o golpe foi cortado" — e a primeira versão errou**
  **justamente aí.** Ela tirava o selo de todo golpe cujo efetivo ficasse abaixo do sorteado, o que
  é quase todo golpe que MATA. Um crítico que tira **300 de 350** mostra um número grande e ali o
  selo é informativo; o que contradiz é quando sobra menos da METADE, porque aí o número na tela
  fica abaixo do que um golpe comum daria. Hoje o campo `cap` é `efetivo * 2 < sorteado`.
  **Quem pegou o erro foi o teste**, com o fixture Gyarados × Gyarados de Hiper Raio: luta de 2 a 3
  golpes, em que quase todo crítico é o golpe final — a amostra de confrontos com selo caiu de 120
  pra 40 e a trava do "o selo NUNCA falta" acusou.
  **A Faixa de Foco NÃO marca `cap`**: ela tira 1 de HP, o que nunca come a dobra.
- **MEDIDO, contado na TELA** (25.890 linhas de golpe em 10,6 mil confrontos): o selo sai em
  **5,0%** das linhas, e as que mostram selo num número menor que **um terço** do maior daquele
  atacante caíram de **31 para 1** — e essa uma é um golpe de vários tapas, caso legítimo.
  **Só 0,32% dos confrontos com crítico ficam sem selo nenhum**: são aqueles em que o ÚNICO crítico
  foi um golpe final encolhido, e ali não havia o que explicar.
- **CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build com e sem a guarda dá o **MESMO hash**
  de resultado em 900 batalhas semeadas. O campo `c` do diário nunca é lido de volta pelo motor —
  só pelo log e pela animação —, e o `cap` nasceu só pra ele.
  **⚠️ Ao medir isso, o rng é o TERCEIRO argumento do `simulateGymBattle`**, não o quinto: passado
  na posição errada ele é ignorado, o motor cai no `Math.random` e o hash muda a cada rodada — o
  que se lê como "a mudança mexeu no motor" quando o que mexeu foi a medição. Dois hashes seguidos
  do MESMO build é o que separa os dois casos.
- **NA RECONSTRUÇÃO a guarda é a mesma, e é aproximação em cima de aproximação.** O
  `marcarCriticos` não sabe QUAL golpe foi crítico (só quantos e de que lado), então ele passou a
  **não descer o selo pra uma linha menor que um terço da maior daquele lado**. Preferir o silêncio
  à contradição é a mesma escolha que o diário real faz com o `cap`. No caminho REAL essa guarda
  não é necessária — lá o `cap` resolve, e está medido em **zero**.
- **A animação mostra o mesmo diário.** `buildAnimatedHitSequence` devolve os golpes reais (pelo
  `passosVisiveis`, pra dobrar o moribundo igual ao log); a reconstrução antiga — até 4 golpes
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


### O LOG COMEÇA COMPRIMIDO, UM CONFRONTO POR LINHA (16/09/2026)

Pedido assim: *"na tela que mostra o log da batalha, comprima o log de cada confronto em uma linha
com uma + no meio, e quando clicar expandir o log daquele confronto, entao tudo começa comprimido, e
se o usuario quiser ver o log de algum dos confrontos, ele clica no + e abre"*.

- **O CABEÇALHO DO CONFRONTO JÁ ERA A LINHA** — os dois lutadores com sprite, nível e barra de vida,
  com o `×` no meio. O que mudou é que o **passo a passo** deixou de ser desenhado junto e passou a
  esperar um toque.
- **⚠️ ELE FICOU GRANDE QUANDO O TETO DE LINHAS SAIU** (15/09/2026): sem corte, uma batalha 6x6
  passava de 1.800px de log. Medido a 320px, num 6x6 de 9 confrontos:

  | | altura |
  |---|---|
  | **comprimido** (como nasce) | **768px** |
  | um confronto aberto | 996px |
  | todos abertos (como era antes) | **1.890px** |

  **−59%**, sem rolagem lateral em nenhum dos três. Cada linha fica em **65px**.
- **NÃO HÁ CONTROLE NENHUM: o card inteiro clica.** O `+` passou por dois lugares antes de sumir
  — ver o item próprio logo abaixo, que é onde está a razão.
- **⚠️ O ALVO DO TOQUE É O CARD INTEIRO** — a regra da casa ("a linha toda já é o alvo do toque, e
  mirar num quadradinho num celular é pedir erro"), a mesma da ficha da Pokédex e da lista de
  notificações. Quem diz que há o que abrir é o **título**: ele anuncia o vencedor, e um card com
  título se lê como um card, não como as linhas estáticas do jogo.
- **O botão NÃO usa o `.btn` da casa**: aquele é botão de AÇÃO, com moldura de 3px. Aqui a linha é
  informação que por acaso se toca, o mesmo raciocínio que já tinha tirado o `.btn` dos cartões de
  golpe, das prateleiras da loja e das linhas da ficha.
- **⚠️ CONFRONTO SEM PASSO A PASSO NÃO GANHA O `+` nem vira botão**: é o log antigo, gravado antes de
  o diário existir, e ali não há o que expandir — o cabeçalho dele já mostra o golpe e o dano.
- **VALE NAS SETE TELAS** que mostram este log (jornada, batalha especial, Torre, Ginásio da Cidade,
  game over, liga assistida e online), porque as sete chamam o mesmo `renderMatchupLog`.
- **`render()` é seguro aqui**, e isso merece nota porque a regra da casa é o contrário: as sete são
  telas de **RESULTADO** — a batalha já acabou e nada está animando. A proibição de redesenhar vale
  pros laços de revelação, que são outras telas.

#### ⚠️ O CONTROLE MUDOU TRÊS VEZES NO MESMO DIA, E ACABOU SUMINDO

O pedido final: *"suma com esse botão que acabamos de criar e coloque no titulo de cada confronto
centralizado quem foi o vencedor: 'Vitória do Charizard', e torne cada confronto um card para
clicar, e quando clicar, abre o log embaixo"*.

As três tentativas, na ordem, porque o caminho explica o destino:

| | o que era | por que saiu |
|---|---|---|
| 1ª | um `+` no bloco do `×` | caractere solto, do tamanho do texto em volta — **lia-se como parte do placar**, não como controle |
| 2ª | um botão quadrado azul na linha de baixo | virou um controle visível, mas **competia com o conteúdo**: um botão no meio do card pra abrir o próprio card |
| **3ª** | **o card inteiro clica, e o título diz quem venceu** | o alvo passa a ser a coisa toda, e o espaço que o controle ocupava vira **informação** |

- **⚠️ É "Vitória Charizard", SEM O "do"** (pedido logo depois: *"em vez do 'Vitoria do Charizard',
  coloque apenas 'Vitoria Charizard'"*). O artigo saiu por leitura, e de quebra ele levava junto um
  problema de gênero: o jogo **não guarda gênero de espécie** em lugar nenhum, então "Vitória do"
  sai errado em Jynx, Nidoqueen, Chansey e companhia — e uma tabela de gênero pra uma frase só é
  exatamente o que a preposição neutra do congelamento já tinha evitado ("congelado **com** NEVASCA").
  Sem o artigo, a linha serve aos 250 sem exceção.
- **O TÍTULO É A TROCA QUE FAZ O DESENHO FECHAR.** Sem ele, um confronto fechado obriga a **ler as
  duas barras de vida** pra saber quem ficou de pé — e essa é a única coisa que o jogador quer saber
  de um confronto que ele não vai abrir. O controle saiu e no lugar entrou a resposta.
- **O NOME SAI NA COR DO LADO** (azul pro jogador, vermelho pro adversário), as mesmas do log — é o
  que faz o título se ler de relance, antes mesmo do nome.
- **⚠️ TRÊS CASOS, e o terceiro só existe por causa da autodestruição.** Medido em 11.879 confrontos:
  **49,0%** o jogador vence, **49,8%** o adversário vence e **1,2% os DOIS caem** — e os dois caindo
  é *sempre* explosão, que é a regra desde 12/09/2026. Ali o título diz **"Os dois caíram"**, porque
  "Vitória de" seria mentira. **"Os dois de pé" deu ZERO**: o confronto só termina quando alguém cai.
  O caso fica tratado assim mesmo (sem título) — o Remoinho tira um de campo vivo, e no dia em que
  isso virar um matchup o título não vai inventar um vencedor.

**⚠️ E O CARD É UMA `<div role="button">`, NUNCA UM `<button>` — essa é a decisão que faz o desenho
funcionar.** O passo a passo fica DENTRO do card, e ele contém o **selo clicável da chuva**, que é um
`<button>`. `<button>` dentro de `<button>` é HTML inválido: o navegador fecha o de fora e o clique
de dentro se perde, com a tela continuando a PARECER certa.

Numa `div` o aninhamento é válido, e o selo **já nasceu com `event.stopPropagation()`** — tocar nele
abre a caixa da chuva sem fechar o card. A nota daquele selo previu este dia com todas as letras, e
previu certo. O preço da `div` é o teclado, que entra na mão (`tabindex="0"` + Enter/Espaço).

- **⚠️ ELE TEM BORDA, E ELA É A DO CARD DE POKÉMON** (pedido junto: *"coloque bordas no card para
  destacar mais que ele é clicável"*): 2px, cantos de 5px, fundo branco e a sombrinha de 2px — os
  quatro valores do `.team-grid-card`, que é o card que o jogador já sabe tocar. Ele nasceu **sem**
  borda, contando só com o título pra parecer clicável, e não bastava: entre um card e outro havia só
  o tracejado que a lista já tinha, então a fileira continuava lendo como **lista**.
- **⚠️ ABERTO A BORDA FICA AZUL, e é ela que diz QUAL card está aberto.** Com o log embaixo, a única
  pista era o conteúdo — e num confronto de duas linhas isso é fácil de perder de vista ao rolar. A
  sombra acompanha a cor pelo mesmo motivo.
- **⚠️ O TRACEJADO DE BAIXO JÁ TINHA SAÍDO ANTES — não é desta mudança.** Quem o desliga é o
  `.matchup-row.mlog{border-bottom:none}`, que é do desenho de quando o log virou cartão de dois
  lados. Fica dito porque a borda nova esconde a pergunta: com ela em volta, ninguém nota que a
  lista já não separava por linha nenhuma.
- **A regra do `:last-child` do card é REDUNDANTE hoje, e ela fica sabendo disso.** Medido no
  navegador (desligando a regra na mão): o último card **continua com a borda**, porque
  `.matchup-row.mlog-card` e `.matchup-row:last-child` têm a MESMA especificidade e o card é
  declarado depois. Ela existe só pra o dia em que alguém mover o bloco pra cima — sem ela, o
  último confronto perderia a borda de baixo e ninguém ligaria uma coisa à outra.
- **Medido a 320px, no navegador:** o card mede **243px** e a página não passou a rolar pro lado.
- **O card não usa o `.btn` da casa** — aquele é botão de AÇÃO, com moldura de 3px. Aqui é informação
  que por acaso se toca, o mesmo raciocínio dos cartões de golpe, das prateleiras da loja e das
  linhas da ficha. Ele ganha só cursor, um realce no toque e o foco visível.
- **Medido no navegador, a 320px:** o título ocupa **22px** por card, o log de 4 confrontos fica em
  **518px** comprimido e **746px** com um aberto, sem rolagem lateral.

**⚠️ E DUAS TRAVAS MINHAS COMETERAM O MESMO ERRO DE REGEX, com horas de diferença — a lição fica:**
`/\.mlog-mais\{[\s\S]*?border-radius:50%/` e `/matchup-row[^"]*btn/` são a mesma armadilha. **Um
quantificador sem limite atravessa o arquivo inteiro** e encontra a string em outra regra, centenas
de linhas abaixo — as duas travas acusavam algo que estava certo. Dentro de uma regra CSS o limite é
`[^}]*`; pra classes de um elemento, o certo é ler o **HTML gerado** e partir por espaço, não varrer
a folha de estilo.


#### ⚠️ O QUE O CLAUDE.md JÁ TINHA PREVISTO

A nota do selo clicável da chuva dizia, com todas as letras: *"o `<button>` é válido ali porque a
linha do log é uma `<div>` … **se um dia a linha do log virar clicável, é este o lugar que
quebra**"*. É hoje.

`<button>` dentro de `<button>` é HTML inválido — o navegador fecha o de fora e o clique de dentro
se perde, com a tela continuando a PARECER certa. O que salva é a estrutura: **o botão envolve só o
cabeçalho, e o passo a passo (que contém o selo) é IRMÃO dele**. Há trava posicional pra isso — no
HTML, o `</button>` aparece **antes** do `mlog-passo`, e num confronto com chuva o `selo-clicavel`
aparece **depois** do fecha-botão.

#### ⚠️ E O ESTADO NÃO PODE SER A REFERÊNCIA DO ARRAY

Quais confrontos estão abertos é estado de **TELA** (não vai pro save), e a pergunta difícil é
**quando ele zera** — senão o confronto 2 de uma batalha nova nasce aberto porque o 2 da anterior
estava.

- A primeira versão comparava a **referência** do array de matchups. Isso é exato nas seis telas que
  guardam o resultado — e **quebra no online**, que monta o `logDaMinhaVista` a **cada render**: ali
  o array é sempre novo, o estado zeraria em todo desenho e o clique nunca abriria nada.
- Hoje a chave é **`tela + número de confrontos`**. Duas batalhas seguidas nunca caem na mesma chave
  porque o jogador passa por outra tela entre elas (a distribuição de níveis, a tela da Torre, o
  lobby). Há trava com um array NOVO de mesmo conteúdo, que é exatamente o caso do online.

**⚠️ DUAS LIÇÕES DE TESTE saíram daqui:**

1. **O ajudante do teste tem que GARANTIR ABERTO, não alternar.** A chave é tela+tamanho, então dois
   blocos do arquivo com o mesmo número de confrontos **compartilham o estado** — e alternar ali
   fechava o que o bloco anterior tinha aberto. O sintoma era um HTML vazio dando falha numa trava
   que não tinha nada a ver.
2. **⚠️ No NAVEGADOR o `render()` redireciona pra `auth`** quando não há sessão — e aí a chave muda e
   o estado zera. Isso é artefato do sandbox (no jogo real há save aberto e a tela não muda), mas
   custou uma rodada de investigação: o clique "não abria" e parecia defeito.

**CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois dá o **MESMO hash** em 900
batalhas semeadas.

`tools/test-especiais.js` tranca: que nasce tudo comprimido e cada um traz um `+`, que abrir mostra
só aquele e o `+` vira `−`, que clicar de novo fecha, que mudar o número de confrontos zera, que a
tela entra na chave, que um array NOVO de mesmo conteúdo **mantém** o aberto (o caso do online), que
log antigo não ganha `+` nem vira botão, que o `</button>` fecha antes do passo a passo, que o selo
da chuva fica FORA dele, e que o CSS zera o estilo de fábrica. E o ajudante `logAberto` do próprio
arquivo passou a abrir **pela API de verdade** — o que faz toda trava que lê o log exercitar o
caminho do clique.

### O SONO DURA DE 1 A 3 TROCAS, 1/3 CADA (15/09/2026)

Pedido assim: *"quando um pokemon dormir, coloque 1/3 de chance para ele tomar 1 ataque, 1/3 de
chance para ele tomar 2 ataques e 1/3 de chance para ele tomar 3 ataques, assim como no jogo real"*.

- **`SONO_EM_TROCAS` DEIXOU DE SER UM NÚMERO e virou uma TABELA com peso** (`[[1,1],[2,1],[3,1]]`),
  no molde do `MULTI_GOLPE`. Ele valeu **2** até 09/09/2026 e **1** daí em diante; agora o pior caso
  volta a ser 3, só que **sai em 1 vez em 3 em vez de sempre**.
  A tabela existe pra o dia em que as chances deixarem de ser iguais ser uma linha — e ela é
  **duplicada nos dois motores**, como todo o resto do bloco de especiais.
- **⚠️ O SORTEIO LÊ O `rng` DA BATALHA, nunca `Math.random`.** Cliente e servidor resolvem a MESMA
  batalha a partir da mesma semente (a Liga, o online, a comparação dos 300 confrontos), então um
  dado a mais num dos dois lados desloca a semente inteira e a batalha passa a terminar diferente
  nos dois. É a mesma armadilha que o Remoinho quase trouxe.
  **E ele só é lido quando o sono REALMENTE sai** — lê-lo antes da checagem mudaria confronto que
  não tem sonífero nenhum. O teste cobra 500 sorteios idênticos entre os dois motores.

**O EFEITO ISOLADO DOBROU, e é esse o número que importa.** Medido com a chance **FORÇADA em 100%**
— o único jeito de isolar, porque a 5% por confronto ele se dilui e some no ruído (é a mesma
metodologia da medição de 09/09) — 16 soníferos × 8 adversários × 40 voltas, nível 50 dos dois lados:

| | vitória | ganho |
|---|---|---|
| sem sono (controle) | 31,17% | — |
| **1 troca** (o de ontem) | 43,81% | +12,6 |
| **1 a 3 trocas** (hoje) | **60,16%** | **+29,0** |

Ele voltou ao patamar que tinha quando comprava **2 trocas fixas** — o que faz sentido: a média de
`(1+2+3)/3` é exatamente 2. O que mudou em relação àquela época é a **forma**: o jogador não perde
mais sempre o mesmo, ele às vezes escapa com um golpe e às vezes toma três.

**O QUE SAI NA TELA, medido no mesmo painel:**

| trocas livres | 1 troca (antes) | 1 a 3 (hoje) |
|---|---|---|
| 1× | 71,9% | **25,3%** |
| 2× | 27,3% | **41,1%** |
| 3× | ~0% | **27,5%** |
| 4× | 0,1% | 5,4% |

A 4ª aparece pelo motivo de sempre: quem usou o sono, se for o mais rápido, ainda bate primeiro na
troca em que o outro acorda.

**O PREÇO NA JORNADA: nada. 52,22% contra 52,92%** de conclusão — **+0,70 ponto, 1,0σ**, 8 blocos de
800 jornadas de cada lado (**6.400 de cada**, desvio tirado de ENTRE os blocos), com **4 de 8 blocos**
pro lado de cada — ou seja, ruído puro. É a mesma conclusão que o sono já tinha em 09/09: **os
líderes também têm sonífero** (Oddish, Paras, Venonat), então o corte cai dos dois lados igual.

- **Se um dia incomodar**, o lugar de mexer é o PESO da tabela (deixar o 3 mais raro que o 1, por
  exemplo) — e a régua está aqui.
- **⚠️ E ELE DESENTERROU UMA TRAVA QUE MEDIA A DURAÇÃO, NÃO A REGRA.** A do despertar era *"quem
  sobrevive ao golpe que levou dormindo acorda naquela mesma troca"* — verdade enquanto o sono
  comprava UMA troca, e mentira agora: com 2 ou 3 ele sobrevive ao primeiro golpe e **continua
  dormindo**. Ela caiu pra 61 de 120 sem nada estar errado. O invariante novo não depende da
  duração: **quem volta a ATACAR necessariamente acordou**, então a linha tem que existir.


#### "CONTINUA A DORMIR": A LINHA DO TURNO DO MEIO (16/09/2026)

Pedida com estas palavras: *"Caso o pokemon nao acorde no turno dele, deve exibir a mensagem: 'Onix
continua a dormir e não pode atacar', espera 1,5s e continua"*.

- **⚠️ ELA FALTAVA, e a falta tinha uma forma conhecida:** o sono tinha a linha de ADORMECER
  (*"Butterfree fez Snorlax dormir"*) e a de ACORDAR (*"Snorlax acordou e voltou à luta!"*), **e
  nada nos turnos do meio** — o jogador via a barra dele parada, o adversário batendo de novo, e
  nada na tela explicando. É a mesma razão do *"mas não teve efeito"* da imunidade, e o
  congelamento já tinha resolvido o análogo exato com o `gelado` (16/09/2026). O sono ficou pra
  trás porque ele é muito mais antigo que o bloco de status.
- **O CICLO INTEIRO, agora:**

  ```
  😴 Butterfree fez Snorlax dormir com Pó do Sono.
  Butterfree atacou Snorlax com Rajada de Vento e tirou −19 de HP.
  😴 Snorlax continua a dormir e não pode atacar.        [1,5s]
  Butterfree atacou Snorlax com Rajada de Vento e tirou −19 de HP.
  ⏰ Snorlax acordou e voltou à luta!
  Butterfree atacou Snorlax com Rajada de Vento e tirou −20 de HP.
  Snorlax atacou Butterfree com Golpe de Corpo e tirou −315 de HP.
  ```

- **⚠️ ELA NÃO SAI NA TROCA EM QUE ELE ACORDA**, e essa é a única regra da linha: ali quem conta a
  história é o `acordou`, e as duas juntas se contradiriam (*"continua a dormir"* e *"acordou"* no
  mesmo turno). Quem separa os dois casos é o `_dormindoPor`, que o `acorda` já decrementou na
  entrada da troca — maior que zero quer dizer que ainda há sono depois desta.
- **⚠️ MAS ELA SAI NA PRIMEIRA TROCA LIVRE, e isso reverte a primeira versão.** Ela pulava a
  primeira, pra não repetir a informação da frase *"X fez Y dormir"* — e com isso só aparecia no
  sono de TRÊS trocas, ou seja em **um terço dos sonos e uma vez só**. O pedido é literal (*"caso o
  pokemon não acorde no turno dele"*), e as duas frases não competem: o `sono` ocupa o passo DELE, e
  esta é sobre a vez que o adormecido perdeu, num passo próprio.
- **⚠️ E ELA VEM DEPOIS DO GOLPE DE QUEM É MAIS RÁPIDO.** A frase é sobre **o turno dele**, e o
  turno dele é depois do golpe do outro. Ela nasceu junto do `geloDe` (que grava as duas linhas de
  entrada do gelo no começo da troca, dos dois lados) e ali o log dizia *"Onix continua a dormir /
  Gengar atacou"* — a ordem invertida da cena. As do gelo ficam juntas lá em cima por um caso que o
  sono não tem: o **recongelamento** na mesma troca.
- **O SELO É O MESMO 😴 DO SONO**, e é de propósito: é o mesmo efeito visto num turno do meio, e um
  ícone próprio faria procurar duas mecânicas onde há uma. É a mesma decisão do ❄️ repetido nas três
  linhas do gelo.
- **O `q` é de QUEM ESTÁ DORMINDO**, como o do `gelado`, o do `acordou` e o da Fúria — estas linhas
  são sobre UM pokémon, não sobre um causador e um alvo.
- **O 1,5s vem da entrada no `passosDaAbertura`** (1 passo), como todas as que não mexem barra. Sem
  entrada na tabela a frase valeria pra **SEMPRE** — o defeito que a anulação teve.

**MEDIDO: ela sai em 2,98% dos confrontos** — **64% dos que têm sono**, que é exatamente a fatia de
sonos de 2 ou 3 trocas (o `SONO_EM_TROCAS` é 1, 2 ou 3 com 1/3 cada, e a troca do despertar não
ganha linha). São **1,32% das linhas do log**, e as linhas por confronto não se movem (2,98).

**NA DIFICULDADE, NADA — por construção.** É uma linha de dano 0 no diário: **o mesmo build antes e
depois dá o MESMO hash** em 900 batalhas semeadas.

**Medido a 320px, no navegador:** a frase cai em **2 linhas (41px)** — o mesmo perfil da confusão, do
Remoinho e das do gelo —, o log do ciclo completo fica em 484px e não há rolagem lateral.

`tools/test-especiais.js` tranca: a frase palavra por palavra, o selo sendo o mesmo do sono, a pausa
de 1,5s, **a contagem batendo com a duração** (um sono de N trocas rende N−1 linhas), que ela nunca
é vizinha do `acordou`, que **quem continua dormindo não ataca naquele turno**, que ela vem depois
do golpe de quem é mais rápido, o HTML do log sem `−0 de HP`, e 120 batalhas batendo golpe a golpe
nos dois motores. Conferido que ele acusa 3 falhas com a guarda do despertar removida, 3 com a
ordem invertida e 1 com o servidor sem a linha.

#### E A CHANCE FOI A 15% (15/09/2026)

Pedido logo em seguida: *"Aumente a % das habilidades passivas que fazem dormir para 15%"*.
`CHANCE_SONO` foi de **0,05 para 0,15** — nos dois motores.

**ELE VIROU O ESPECIAL MAIS COMUM DO JOGO, e é essa a mudança:** a chance TRIPLICOU e o ganho por
uso não mudou (é o mesmo da tabela de 1 a 3 trocas, acima). O que o jogador sente é frequência:

| | 5% | 15% |
|---|---|---|
| sai em | 1,65% dos confrontos | **5,30%** |
| numa batalha 6x6 | 13,1% | **33,3%** |

Ou seja: **uma batalha em três** passa a ter sono em algum momento, contra uma em oito.

**O PREÇO NA JORNADA: +1,36 ponto de conclusão** (54,33% → 55,69%), **1,5σ**, 8 blocos de 800
jornadas de cada lado (**6.400 de cada**, desvio tirado de ENTRE os blocos), com **6 de 8 blocos**
pro lado fácil. Está dentro do ruído, e a direção é a esperada: o sono cai dos DOIS lados (os
líderes têm Oddish, Paras e Venonat), mas **o jogador escolhe quem leva no time** e os líderes não.

- **⚠️ ELE MUDA A CHANCE COMPOSTA DE QUEM TEM DOIS ESPECIAIS**, e isso não é decisão nova — é a
  consequência de o sono ser sorteado cedo na fila. A **Jigglypuff** (Canto + Disable) via o Disable
  dela cair de `0,95 × 10% = 9,5%` para **`0,85 × 10% = 8,5%`**. O teste passou a calcular esse
  número **das constantes** em vez de tê-lo escrito à mão — com o 0,095 fixo, ele teria que ser
  editado junto, que é a classe de manutenção que faz um teste envelhecer calado.
- **A FICHA DA POKÉDEX SE ATUALIZA SOZINHA:** a chance que ela mostra sai do `CHANCE_SONO`, não de
  um texto. É a mesma regra que a caixa de explicação já segue (`{CURA}`, `{FURIA}`…).
- **Se um dia incomodar**, a régua é a própria constante — e o efeito é quase linear na frequência,
  porque o ganho por uso não depende dela.


### O COMEDOR DE SONHOS AVISA NO CARTÃO (15/09/2026)

Pedido: *"Coloque mais um * no ataque comedor dos sonhos: 'Só utilizado quando o adversário dorme',
e verifique na batalha se isso esta ocorrendo mesmo"*.

- **A VERIFICAÇÃO DEU CERTO, e está medida:** 3.000 confrontos de um Gengar (que tem Hipnose e
  Comedor de Sonhos) contra um Machoke — **188 de 188** confrontos com sono usam o golpe com o alvo
  DORMINDO, **ZERO** com ele acordado, e em 36 deles dá pra ver a troca na tela (ele bate de Comedor
  de Sonhos e, na linha seguinte ao despertar, de Bomba de Lodo).
- **⚠️ `obsDoGolpe` DEIXOU DE DEVOLVER UMA STRING e passou a devolver uma LISTA.** Ela era uma
  sequência de `return`, e a primeira regra que casasse ganhava — o que funcionava enquanto nenhum
  golpe tinha DUAS coisas a dizer. O Comedor de Sonhos tem: ele **cura** e **só vale contra alvo
  dormindo**. Com `return` de string, cadastrar a segunda **apagaria a primeira em silêncio**.
  A ordem é a da tabela: o que o golpe FAZ vem antes da condição em que ele vale.
- **ELA É A OBSERVAÇÃO MAIS IMPORTANTE DELE, e mais que a cura:** o cartão anuncia **PODER 100** — o
  número mais alto que a maioria das espécies vê na vida — e sem a linha o jogador gasta uma das três
  vagas num golpe que, contra adversário acordado, o motor **nunca escolhe**. Ele é a escolha certa
  pra quem tem sonífero e a pior de todas pra quem não tem, e é essa a conta que a linha entrega.
- **Sai do `GOLPES_SO_DORMINDO`**, que é a MESMA tabela que o `melhorAtaque` consulta — um segundo
  golpe que entre lá já nasce com o cartão avisando.
- **Custo de tela, medido a 320px:** o cartão dele vai a **120px**, contra 78 do Absorver (uma
  observação) e 53 de um golpe comum. São **+67px** sobre o cartão comum, numa tela que mostra de 3 a
  5 cartões. Se um dia incomodar, o lugar é o `obsDoGolpe` e a saída é encurtar a frase.

### O TETO ACABOU: O LOG É A LUTA (15/09/2026)

Pedido assim: *"vamos então deixar sem teto, as lutas agora vão seguir 100% real ao jogo"*. Ele veio
de uma **pergunta**, não de um relato de bug — e a pergunta é a coisa mais importante desta seção.

- **A PERGUNTA FOI: "essas duas lutas seguem motores diferentes?"** O jogador mandou print de um log
  em que um **Ariados × Goldeen** tinha **10 linhas** e um **Ivysaur × Horsea** tinha **2**, e
  perguntou se a batalha com golpe de absorção segue o motor real e a sem absorção segue "o nosso
  motor um pouco resumido".
  **Seguiam o MESMO motor. O que mudava era a TELA** — e não havia nada no jogo dizendo isso.
- **⚠️ O TETO NÃO ERA UM CORTE DE LEITURA, ERA UMA CORTINA.** Acima de `TETO_GOLPES` (4) a tela
  trocava a luta por uma **RECONSTRUÇÃO**: três golpes INVENTADOS a partir do HP de entrada e de
  saída. Ela não conhece mecânica nenhuma — nem cura, nem escala do Rolamento, nem trocas livres do
  sono —, e é por isso que **três mecânicas já tinham saído do teto, uma a uma, cada uma depois de
  um relato**: o sono (04/09), o Rolamento (14/09) e a drenagem (15/09, horas antes).
  Ou seja: **o jogo já tinha dois pesos, e eles cresciam.** Medido com o build antigo de volta, em
  7.810 confrontos: **7,8% dos confrontos SEM drenagem eram resumidos e 0% dos COM**.
- **O PREÇO É DE TELA, e ele é pequeno na mediana e grande na cauda** (o MESMO bot contra os dois
  builds, 7.810 confrontos, 900 batalhas):

  | | com teto | sem teto |
  |---|---|---|
  | linhas por confronto | 2,27 | **2,62** (+16%) |
  | confrontos resumidos | 7,6% | **0%** |
  | cabem em até 3 linhas | 84% | 76% |
  | cabem em até 6 linhas | 98% | **94%** |
  | pior caso visto | 23 linhas | **31 linhas** (Furret × Shuckle) |
  | animação de uma batalha 6x6 | 38,8s | **43,9s** (+5,1s) |

  **É menos do que parece porque 59% das lutas se resolvem em UMA ou DUAS linhas** — o teto só
  alcançava a minoria comprida. O pior caso é um Shuckle (230 de Defesa) apanhando de um Furret.
- **NA DIFICULDADE, NADA — por construção, e conferido por impressão.** O mesmo build com e sem o
  teto dá o **MESMO hash** em 900 batalhas semeadas. `TETO_GOLPES` nunca existiu no servidor e não
  entrava em conta de dano nenhuma; ele vivia no `sequenciaDoConfronto`, que é apresentação.
- **⚠️ A RECONSTRUÇÃO NÃO FOI REMOVIDA, e não pode ser.** Ela continua sendo **o fallback de
  confronto gravado ANTES de o diário existir** (`m.golpes` vazio) e **o partidor da Faixa de Foco**,
  que quebra a luta em duas metades. O que não existe mais é um confronto **com** diário cair nela.
  Consequência pro teste: só se chega naquele código **tirando o `golpes` do matchup à mão**, e é
  exatamente o que `tools/test-especiais.js` passou a fazer — sem isso o bloco inteiro da banda da
  fórmula viraria letra morta em silêncio.
- **HISTÓRICO: o teto já saiu inteiro uma vez, em 03/09/2026, e voltou no MESMO dia** — *"uma troca
  banal de Gloom contra Miltank virou seis linhas"*, reportado com print. O que mudou de lá pra cá
  é que ele tinha subido de 3 pra 4 (a cauda encolheu) e que três mecânicas já eram isentas — ou
  seja, **o corte tinha ficado mais estranho que o log comprido**.
- **Se um dia o log comprido incomodar**, o lugar NÃO é um teto novo: é o tempo por passo
  (`PAUSA_ANTES_DO_GOLPE_MS`, 1s) ou isentar o 2º tapa em diante da pausa. Um teto volta a criar
  dois pesos, e foi disso que o jogador reclamou.

**⚠️ E ELE DESENTERROU QUATRO TRAVAS QUE MEDIAM OUTRA COISA — a lição é a mesma da subida de 3 pra
4, agora inteira:** o que o teto escondia não era só defeito do jogo, era **cobertura de teste**.
Com ele, confronto comprido nunca chegava à tela, e quatro travas passavam sem nunca olhar o que
elas existem pra olhar:

| trava | o que ela media de verdade |
|---|---|
| a **banda da fórmula** ("dois golpes do mesmo pokémon não diferem mais que 1,176×") | ela nunca olhava o **`mv`**. Com o Metrônomo sorteando golpe a cada ataque, uma Clefairy que tira 124 com Meteor Mash e 286 com Fire Blast **não** é número impossível — são dois golpes diferentes. 20 dos 1.129 pares fora da banda eram isso |
| a **colagem** ("a tela não pode criar dois golpes seguidos do mesmo lado") | pulava justamente a luta comprida, que é onde o reordenamento tem mais chance de colar |
| o **selo de crítico** | a passada da reconstrução ficou em zero: agora ela roda **duas vezes**, a tela de verdade e a mesma tela sem diário |
| a **Faixa de Foco** ("nenhum confronto passa de 7 linhas") | a promessa era do caminho RECONSTRUÍDO. Hoje a Faixa é uma linha no meio dos golpes reais, e o que se cobra dela é posição e soma — não tamanho |

### O PLACAR VIROU POKÉBOLAS (15/09/2026)

Pedido assim: *"naqueles quadros que aparece escrito o nome do usuário: 5/6 e Misty: 4/4, vamos
reformular: Voce vai colocar o nome do usuário centralizado e embaixo voce vai criar sprites de
pokebolas, caso o usuário tenha 5 pokemons vai aparecer 5 pokebolas, conforme os pokemons forem
morrendo, as pokebolas vao ficando pretinhas ... e pode tirar aqueles emojis que tem antes dos
nomes"*.

- **A FRAÇÃO DIZIA A MESMA COISA, MAS COBRAVA UMA LEITURA:** pra saber quem estava na frente o
  jogador tinha que comparar dois números. Seis bolinhas com duas pretas se leem **de relance**, que
  é o que este quadro existe pra fazer — ele fica acima dos lutadores, no canto do olho de quem está
  olhando a barra de HP.
- **⚠️ ELE APARECIA EM SEIS TELAS, COPIADO** (jornada, batalha especial, Torre/raide, liga assistida
  e as DUAS do online), e elas **já tinham divergido**: quatro usavam 🎒/🥊 e a liga assistida usava
  🎽/🥊, sem motivo nenhum. Hoje é o `placarDoTreinador`, num lugar só — e o teste **lê o código** pra
  cobrar que nenhum render volte a montar o chip à mão.
- **A POKÉBOLA É DESENHADA EM CSS, não é imagem.** É a regra da casa ("nenhuma imagem de fora" — já
  houve dois episódios de hotlink que funcionava local e morria publicado), e um gradiente sobrevive
  à redução melhor que pixel art de 13px, que é o tamanho que cabe **seis vezes** num chip de 137px
  (6×13 + 5×3 de gap = 93px).
- **⚠️ A PRETA NÃO USA OPACIDADE, e a primeira versão usava.** O `opacity:.55` clareava o `#2b2b2b`
  contra o fundo claro do chip e a bolinha saía **cinza**, não preta — conferido no navegador. O
  pedido foi "vão ficando pretinhas", e cinza se lê como "desabilitado", que é outra coisa.
- **⚠️ O `min-width:0` MORA NO CHIP, não só no nome.** Um flex item se recusa a encolher abaixo do
  conteúdo por padrão, então sem ele o chip do nome comprido **crescia e roubava a largura do
  outro** — os dois quadros ficavam de tamanhos diferentes na mesma linha. Também conferido no
  navegador: com ele, "TreinadorNomeComprido" trunca com reticências e os dois chips ficam em 137px.
- **ELA TOLERA MAIS DE SEIS:** o teto do jogo é 6, mas a **Vigília do Arco-Íris** monta DEZ
  adversários. O `flex-wrap` deixa as bolinhas quebrarem em duas fileiras de cinco em vez de
  estourarem o chip — medido, o chip vai de 46 pra 62px de altura nesse caso.
- **Medido a 320px, no navegador:** chip de **137×46px**, seis bolas numa fileira só, nome truncando,
  **sem rolagem lateral**.

### AS POKÉBOLAS FICARAM MENOS PRETAS, E O ESCURO AVANÇA DA ESQUERDA (15/09/2026)

Dois ajustes pedidos no dia seguinte ao placar nascer: *"Coloque para que as bolinhas fiquem menos
pretas, e que o primeiro pokemon que morrer, a primeira bolinha da esquerda que fica escura, hoje ta
ficando a primeira bolinha da direita"*.

- **⚠️ A ORDEM ERA O DEFEITO, e a contagem não pegava.** As vivas vinham primeiro, e a razão escrita
  era *"o placar conta quantos SOBRARAM, não quem caiu em que ordem"* — ela não sobreviveu ao teste
  do olho: **o jogador lê a fileira como uma BARRA que se gasta**, e barra se gasta da esquerda pra
  direita. Com as vivas na frente, ela parecia encolher pelo lado errado.
  Nenhuma bolinha muda de lugar de um confronto pro outro nas duas ordens (a contagem é a mesma); o
  que muda é **de que lado o escuro avança**. Por isso a trava passou a ler a **SEQUÊNCIA**
  (`Xooooo`), e não o número de cada tipo — a contagem dá igual nas duas.
- **A ESCURA É UM CINZA, não um quase-preto.** Ela nasceu em `#1c1c1c` e num chip claro **seis
  daquelas viravam uma fileira de furos**. Hoje é `#5f5f5f`: continua se separando da vermelha de
  relance — que é o único trabalho dela — sem pesar na tela.
  **E continua SEM opacidade**, que é o remendo errado aqui: ela clareia o preto contra o fundo claro
  e a bolinha sai indistinguível de "desabilitado". Quem clareia é a **cor**, que dá pra escolher.
  O teste cobra as duas coisas — nada de `opacity` e o valor fora da faixa do quase-preto.

### A CENA DO REMOINHO: SAI, FICA VAZIO, ENTRA COM A BARRA ENCHENDO (15/09/2026)

Pedido assim: *"Quando o Pidgeot usa Remoinho, a animação não esta muito legal, melhore ... aparece
a barra de hp do pokemon que ta entrando, vazia e começa a encher ... nas batalhas onlines quando um
pokemon morre, fica um espaço no lugar do pokemon esperando o treinador escolher qual o proximo,
faça mais ou menos assim"*.

A cena em três quadros já existia desde 12/09/2026; o que mudou foi **o que cada quadro mostra**.

| passo | cabeçalho do adversário | linha de status |
|---|---|---|
| 0 | **Psyduck** | ⚔️ Trocando golpes... |
| 1 | Psyduck | 🌪️ Pidgeot usou Remoinho e soprou Psyduck pra fora! |
| 2 | **❔ entrando...** (sem barra) | idem |
| 3 | **Machop**, com a barra **enchendo** | **Psyduck foi trocado por Machop!** |
| 4+ | Machop | a luta |

- **⚠️ A VAGA VAZIA REUSA O QUADRO DO ONLINE**, que foi o pedido ao pé da letra. Ela era um travessão
  solto (`—`) mais uma barra de **`0/1 HP`** — e esse `0/1` era o pior detalhe: é um número que não
  existe em lugar nenhum do jogo, e quem o lesse de relance acharia que o pokémon tinha ficado com 1
  de vida. Hoje é o mesmo `fighter-oculto` que o online já usa pra "ninguém em campo" (um ❔ apagado
  com a palavra embaixo), e **sem barra nenhuma** — é a ausência que ela precisa mostrar.
- **⚠️ E O QUADRO DE ENTRADA PASSOU A EXISTIR.** O `trocaDoRemoinho` devolvia `null` do `i+3` em
  diante, e `null` quer dizer "é o pokémon do matchup, desenhe normal" — o que está certo pro resto
  da luta e estava errado pro PRIMEIRO quadro dele: o pokémon novo aparecia com a barra **já no valor
  final**, sem nada dizendo que ele tinha acabado de entrar.
- **A BARRA NASCE VAZIA E ENCHE, e o valor continua sendo o HP de verdade:** a classe acrescenta uma
  **animação**, não troca o número. **Por que animação e não transição:** a transição do `.hp-bar-fill`
  precisa de DOIS desenhos (um com o valor velho, outro com o novo) pra existir, e aqui há UM só — o
  pokémon aparece do nada. O `@keyframes` sem `to` usa o valor computado do elemento como destino,
  então ela chega exatamente no HP que ele tem, **seja ele qual for**, sem o CSS precisar saber.
- **O sprite entra junto, com um fade curto no mesmo tempo da barra.** Sem ele o sprite PISCA (sai de
  "nada" pra "opaco" num quadro) enquanto a barra ao lado sobe devagar, e as duas coisas do mesmo
  evento andam em ritmos diferentes.
- **⚠️ A ALTURA NÃO PULA, e isso foi medido:** os QUATRO quadros da cena ficam em **219px** no
  navegador a 320px. O `min-height` da vaga teve que mudar junto (ele cobria só o sprite, porque o
  resto da altura vinha da barra e dos selos de tipo; hoje ela é a altura inteira do quadro).
- **O log continua com UMA linha** — os três quadros são da animação, a mesma forma da drenagem
  (duas entradas no diário, uma linha) e dos golpes de vários tapas.


#### ⚠️ E A CENA COMEÇAVA PELO FIM: O PASSO VELHO SOBREVIVIA À VIRADA DE CONFRONTO

Reportado logo depois: *"antes de trocar o pokemon, ta aparecendo qual vai ser o novo pokemon
rapidamente e rapidamente troca para o pokemon que vai ser trocado"*.

- **A CAUSA NÃO ESTAVA NA CENA, e sim na VIRADA.** Os laços faziam
  `Phase = 'loading'; render(); setTimeout(advance, 1200)` — e quem zerava o passo era o ramo
  `loading` do `advance`, ou seja **1,2 segundo DEPOIS do desenho**. Nesse intervalo o cabeçalho era
  desenhado com o passo do confronto ANTERIOR, que é alto: o `trocaDoRemoinho` via um passo além do
  fim da cena, devolvia `null` ("é o pokémon do matchup") e a tela mostrava **quem ENTROU** — e só
  então voltava pro que estava saindo.
  Medido: **38 de 40** confrontos com sopro (que não fossem o primeiro da batalha) abriam assim.
- **⚠️ É A TERCEIRA PORTA DO MESMO DEFEITO.** O "golpe fantasma" de 09/09/2026 era o `LastHit`
  sobrando de um confronto pro outro, e o conserto de lá zerou os dois JUNTOS — mas **só nos pontos
  que já zeravam o passo**. Os pontos que entram em `loading` não zeravam nenhum dos dois, e ficaram
  de fora. Ele só ficou visível agora porque o Remoinho é a primeira coisa que faz o CABEÇALHO
  depender do passo; até então o passo velho só afetava a linha de status.
- **HOJE HÁ UMA PORTA SÓ (`abrirConfronto(qual)`)**, chamada nos **16 pontos** que entram em
  `loading`, nos cinco laços. Uma função com o prefixo do laço em vez de duas linhas em cada ponto:
  com duas linhas à mão, o próximo ponto nasceria sem elas — que é exatamente o que aconteceu no
  conserto de 09/09.
- **⚠️ E ELA TEM QUE VIR ANTES DO `render()`, não depois.** O problema nunca foi o valor ficar velho
  — foi ele ser **DESENHADO** velho. O teste cobra a posição, não só a presença.
- **CONFERIDO QUE NÃO É MOTOR:** o `abrirConfronto` só escreve dois campos de tela
  (`<qual>HitStep` e `<qual>LastHit`), e nenhum dos dois é lido por conta de dano nenhuma.

**A PROVA É DE PONTA A PONTA, e ela foi a terceira tentativa de escrever a trava.** As duas
primeiras montavam a fase `loading` **à mão** e davam verde nos dois builds — quem chama o
`abrirConfronto` é a VIRADA, então a virada precisa acontecer de verdade. Hoje o teste começa no
confronto ANTERIOR (fase `result`), chama `advanceReveal()` e anota o cabeçalho a cada desenho:

```
sem o conserto:  Machop > Geodude > Geodude > (vazio) > Machop > ...
com o conserto:  Geodude > Geodude > Geodude > (vazio) > Machop > ...
```

A primeira linha é literalmente o relato. Conferido que a trava **acusa** com a chamada removida.

### O HISTÓRICO DO RANKING DA TORRE (15/09/2026)

Pedido assim: *"No ranking da torre de treinadores, adicione do lado do titulo 'Hoje' um botão
chamado 'Histórico', quando clicado, exibir como foi o ranking do dia nos 5 últimos dias"*.

- **⚠️ É UMA CHAMADA SEPARADA, e o CUSTO é a razão.** Cada dia é uma consulta de até 10 documentos,
  então o histórico inteiro são **~50 leituras**. Junto do `getTrainerTowerRanking`, TODO jogador que
  abrisse a Torre pagaria isso — e a maioria só quer ver o de hoje. Sob demanda, quem paga é quem
  clica. E o cliente **cacheia por abertura do modal**: ir e voltar entre as abas não cobra de novo.
- **SÃO OS 5 DIAS ANTERIORES A HOJE**, e não "os 5 últimos incluindo hoje": o de hoje já está na aba
  ao lado, e repeti-lo gastaria uma das cinco linhas dizendo o que a tela já diz.
- **⚠️ A DATA SAI DO MESMO `trainersLeagueDateStrPlusDays` do fechamento do dia.** Uma segunda regra
  de data (a minha, em UTC) discordaria da do jogo em algum fuso, e aí o histórico mostraria um dia a
  mais ou a menos que o ranking.
- **⚠️ E NA TELA ELA É FORMATADA DO TEXTO, não por `new Date(dateId)`** — essa construção lê a string
  como UTC e, num fuso a oeste, devolve o **dia anterior**: o histórico mostraria 13/09 no lugar de
  14/09. O `dateId` já vem no formato do jogo, então o que se quer é só reordenar os pedaços.
- **DIA SEM NINGUÉM FICA NA LISTA**, com a lista vazia e a frase dizendo isso. Sumir com ele faria o
  histórico mostrar cinco datas que **não são as cinco últimas**, e o jogador leria isso como se
  tivesse havido torre em dias que não houve.
- **⚠️ O PÓDIO PASSOU A SER CALCULADO POR LISTA**, e não uma vez a partir do `r.hoje`: cada dia do
  histórico tem o PRÓPRIO pódio (os três ANDARES distintos mais altos daquele dia). Lido do de hoje,
  um dia antigo mostraria a medalha no andar errado — ou em ninguém.
- **E o 🍬 do histórico fala no PASSADO** ("Ganhou um Doce Raro na virada do dia"): ali o dia já
  virou e o doce já foi pago. A mesma marca com o texto de hoje anunciaria um prêmio que já saiu.
- **As abas NÃO usam o `.btn` da casa**: aquele é botão de AÇÃO, com moldura de 3px; aqui são dois
  lugares onde se ENTRA — o mesmo raciocínio que já tinha tirado o `.btn` das prateleiras da loja e
  das linhas da ficha da Pokédex.
- **Medido a 320px, no navegador:** cada aba **101×33px** sem quebra de texto, o modal em **265px** de
  largura rolando por dentro (o `max-height:80vh` já existia), e o histórico de 5 dias em **938px** de
  conteúdo.

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
- **Preços: Doce Raro 300, Despertar 50, Super Poção 50, Faixa de Foco 50,
  Poção 30, os cinco de atributo 30.** O número vive no cliente (`ITENS`) E no servidor (`LOJA`):
  o cliente precisa dele pra desabilitar o botão, o servidor é quem cobra. Se os dois divergirem, a
  tela promete um preço que a cobrança não pratica.
  A Super Poção era 30 e a Poção 15; subiram em 04/09/2026. Pela medição anterior isso põe a Poção
  em **0,070 ponto por moeda** (era 0,141) e a Super em **0,063** (era 0,105) — elas deixam de ser
  as compras mais eficientes e passam a valer o mesmo que os de atributo.
- **A LOJA VENDE DE VOLTA por metade do preço desde 11/09/2026** -- ver a seção **VENDER**, mais
  abaixo, que é onde está a torneira de moeda que isso cria.
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
- **A loja vende os CINCO desde 03/09/2026.** O Doce Raro voltou a ter preço (o Bônus Shiny também
  teve, e **saiu em 12/09/2026** — ver a seção VENDER); eles continuam vindo de jogar, e é por isso
  que **cada um lê de uma fonte própria** (`quantoTenho`) em vez de sair de um campo só:
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

### A MOCHILA VIROU A LOJA (14/09/2026)

Pedida assim: *"A mochila, deixe igual a loja, o quadro em cima, e a lista com os itens que o
usuário possui e os 3 botões de navegação (Para as batalhas, Especiais e TMs/HMs)"*.

- **ELA ERA UMA GRADE DE QUADRADINHOS, e a loja já tinha deixado de ser uma pelo mesmo motivo**: o
  quadradinho mostra só o **ÍCONE**, e metade dos ícones do jogo são emojis parecidos (❤️ ⚔️ 🛡️ 🔮 ✴️)
  — não dava pra escolher sem clicar em cada um. Hoje as duas telas dividem a MESMA marcação:
  `.loja-fixa` em cima, `.loja-abas` com as três prateleiras e `.loja-lista` ao lado.
- **⚠️ AS PRATELEIRAS SÃO A MESMA LISTA (`LOJA_PRATELEIRAS`), e a regra de qual item cai em qual
  também (`prateleiraDoItem`).** Duas listas separadas divergiriam no primeiro item novo — é a lição
  das três telas de golpe, que viraram uma cópia só **depois** de já terem divergido no texto. O que
  muda é o que cada prateleira CONTA: na loja é o que está **à venda**, na mochila é o que o jogador
  **TEM**.
  A terceira mudou de nome junto: **"TMs" virou "TMs/HMs"**, porque na mochila ela tem um HM de
  verdade dentro — um rótulo que diz só "TMs" na tela que mostra um HM seria a tela discordando de
  si mesma.
- **⚠️ A TELA SEPARADA DE TMs E HMs MORREU, e virou a terceira prateleira.** Ela existia porque TM e
  HM *"não empilham, não se gastam, não se vendem e não se usam daqui"* — todas as regras da GRADE
  eram falsas pra eles. Com a grade fora, a razão de eles ficarem noutra tela foi junto: **a lista
  mostra NOME, e nome era o que faltava.**
  O `abrirTmHm` **fica**, apontando pra prateleira: ele é o que o resto do jogo chama (a frase da
  vitória do HM01 manda pra lá), e um atalho que leva ao lugar certo é melhor que um chamador
  quebrado.
- **O `MOSTRAR_TM_HM` CONTINUA, e agora esconde a PRATELEIRA em vez do botão.** Ele já foi puxado
  uma vez (de 12/09 a 13/09/2026) e voltou em uma linha — é o que essa chave compra. **Ele não
  encosta na LOJA**: lá a prateleira das TMs é a vitrine de algo que ainda não existe, e fechá-la
  junto esconderia a porta antes de ela ter o que mostrar.
- **A MÁQUINA NÃO SE USA NEM SE EXCLUI: ela ENSINA.** No lugar do par Usar/Excluir, o quadro traz um
  **📀 Ensinar** — o mesmo caminho que a linha da tela antiga abria. Ela não se gasta: é da conta e
  ensina quantas vezes quiser, como no jogo original.
- **⚠️ E O QUADRO MOSTRA O CARTÃO DO GOLPE (16/09/2026, a pedido)** — nome, **tipo** e **poder**, no
  vazio que sobrava entre o resumo e o botão.
  **É o MESMO `cartaoDeGolpe` das três telas de golpe e da tela de ensinar, e ser o mesmo é o
  ponto:** o jogador compara o Surf daqui com os golpes que o pokémon já tem LÁ, e um formato
  próprio obrigaria a reaprender a ler no meio da decisão. O teste compara o HTML dos dois.
  **E é a informação que decide**: o resumo diz o que a Máquina FAZ, o cartão diz se ela vale a
  vaga — Água/95 ao lado de um Hiper Raio de 150 é uma conta que só dá pra fazer vendo os dois
  números. Item comum não ganha cartão: ele não ensina golpe nenhum.
  **Medido a 320px:** cartão de 243×56px, o quadro fica nos mesmos **375px** fixos (não dança ao
  trocar de Máquina), o miolo **não precisa rolar** e sobram 113px abaixo do cartão.
- **⚠️ O QUADRO DE CIMA FICA EM BRANCO NA PRATELEIRA VAZIA, e do MESMO tamanho.** Foi o pedido ao pé
  da letra (*"caso não possua nenhum TM/HM, deixar em branco"*), e é a mesma decisão que a loja já
  tinha tomado em 13/09: um quadro que vai e vem — e cresce e encolhe — faz a tela inteira dançar a
  cada clique. Quem conta que não há nada é a **lista**, que é onde a ausência está.
- **SAIU A FRASE QUE ENSINAVA O CAMINHO DO HM01** (*"está por aí: Embarcando no S.S. Anne e vencendo
  o Lt. Surge de primeira"*) e **"Nenhuma Máquina ainda" virou "Nenhum TM/HM"**, os dois a pedido. O
  caminho continua escrito no `comoGanhar` do `HMS`, que é de onde ele saía; o que mudou é a tela
  não entregar de graça um achado que a jornada devia entregar.
  **⚠️ AS OUTRAS DUAS PRATELEIRAS CONTINUAM DIZENDO DE ONDE VEM O QUE FALTA** ("Doces Raros vêm da
  Torre dos Treinadores…", "Estes se compram na Loja"): era o que a mochila vazia dizia antes das
  prateleiras, e uma tela que só diz "vazio" faz a pessoa procurar no jogo inteiro. Só a das
  Máquinas ficou muda, porque foi o que se pediu.
- **ELA ABRE NA PRIMEIRA PRATELEIRA QUE TEM ALGUMA COISA**, não sempre na primeira da lista: quem só
  tem Doce Raro abriria numa prateleira vazia, com o quadro em branco, e teria que descobrir sozinho
  que o que ele tem está na de baixo.
- **⚠️ ESCOLHER UM ITEM LEVA A PRATELEIRA JUNTO.** Pela TELA isso nunca é preciso — a linha clicada
  está sempre na prateleira aberta —, mas quem escolhe por AÇÃO escolhe às cegas: o `usarItem` e o
  `excluirItem` repõem a seleção quando o item acaba, e o que sobra pode estar na prateleira de
  baixo. Sem isso a seleção apontava pra um item que a lista nem lista, e o quadro saía vazio.
- **MEDIDO A 320px, no navegador:** a página fica em **757px** nas três prateleiras (era uma grade
  de 12 quadradinhos), o quadro em **375px** sempre — o mesmo da loja —, a linha em **34–36px** e
  **nenhum nome quebra**. Sem rolagem lateral. A quantidade ("2x", "3x") foi pra coluna da direita,
  a mesma em que a loja põe o preço.
- **MORREU JUNTO:** `gradeDeItensHtml`, `slotsDaGrade`, `INVENTARIO_SLOTS_MINIMOS`, `renderTmHm`,
  `sairDoTmHm` e o CSS `.item-grade`/`.item-slot`. O piso de 12 slots era uma decisão com razão
  escrita ("um inventário que encolhe até caber no que você tem não parece um inventário") e ela não
  vale mais: a lista tem prateleira, e prateleira vazia diz que está vazia.
- `tools/test-inventario.js` tranca as três prateleiras na mochila, a contagem de cada uma, o quadro
  em branco com a lista dizendo **"Nenhum TM/HM"** ao pé da letra, que o S.S. Anne e o Lt. Surge
  **não** aparecem mais ali, o botão de Ensinar sem Usar nem Excluir, o `abrirTmHm` caindo na
  prateleira certa, e que a grade e a tela antiga não existem mais no arquivo.

### AS TRÊS PRATELEIRAS DA LOJA (12/09/2026)

Pedidas assim: *"na loja, na parte que exibe a lista dos itens, diminua ela pela metade na
horizontal e adicione do lado esquerdo 3 botões: o primeiro é 'Para as batalhas', e adicione nessa
seção todos os itens que são usados equipando um pokémon; no segundo botão coloque 'Especiais', e
adicione o Rare Candy; e o terceiro botão coloque TMs, ainda sem nada para vender"*.

| prateleira | o que tem |
|---|---|
| **Para as batalhas** | os **9** que se equipam num pokémon |
| **Especiais** | o Doce Raro |
| **TMs** | vazia, de propósito |

- **⚠️ A PRATELEIRA SAI DO PRÓPRIO ITEM, nunca de uma lista escrita na tela.** "Para as batalhas"
  **é** exatamente o `equipável` — a marca que já existia e que diz que o item vai num pokémon pelo
  `+` da tela de ordem —, e o resto cai em "Especiais". Assim um item novo nasce numa prateleira
  sozinho e nenhuma lista envelhece calada: o teste cobra que **todo `comprável` apareça em
  exatamente uma**, e que a prateleira das batalhas case item a item com o `equipável`.
  É a mesma lição do "59 espécies das quatro listas" que envelheceu calado na ficha da Pokédex.
- **As TMs ficam vazias antes de ter o que vender**, que é o mesmo desenho do HM01: primeiro a
  porta, depois o que tem atrás dela.
- **TROCAR DE PRATELEIRA MOVE A SELEÇÃO JUNTO** (`escolherPrateleira`). Sem isso o quadro de cima
  continuava mostrando um item que a lista ao lado nem lista mais — e na prateleira VAZIA ele
  mostraria o da anterior, com botão de comprar e tudo.
- **NA PRATELEIRA VAZIA O QUADRO DE CIMA SOME.** Ele é o DETALHE do item selecionado, e ali não há
  item: com ele, a tela dizia a mesma coisa duas vezes (em cima e na lista). Quem carrega o recado
  — e o saldo — passa a ser a própria lista, que é onde a ausência está.
- **MEDIDO A 320px, no navegador** (as duas colunas são `1fr 1fr`):

  | | antes | depois |
  |---|---|---|
  | largura da lista | 281px | **137px** (a outra metade são as prateleiras) |
  | altura da página, prateleira cheia | 931px | **1.008px** |
  | altura de uma linha | 46px | 51px a 68px |
  | rolagem horizontal | nenhuma | **nenhuma** |

  A página cresce 8% na prateleira mais cheia porque a coluna pela metade faz o nome quebrar; a de
  Especiais fica em **597px**. Os três nomes de prateleira cabem, e "Para as batalhas" usa duas
  linhas.
- **⚠️ O PAPEL DO JOGO É `--box`, não `--cream`** — essa variável não existe na paleta, e com o
  fallback vazio a aba ficava TRANSPARENTE sobre o fundo escuro da página, com o texto em `--ink`
  por cima: ilegível. Só a selecionada (amarela) se lia. Pego no navegador, a 320px, não pelo teste
  — layout quebrado passa em qualquer asserção de HTML.
- **A prateleira NÃO usa o `.btn` da casa**: aquele é botão de AÇÃO, com moldura de 3px. Aqui a
  lista é de lugares onde se entra — o mesmo raciocínio que já tinha tirado o `.btn` dos cartões de
  golpe e das linhas da ficha.

### O QUADRO DE CIMA É SEMPRE O MESMO, E DO MESMO TAMANHO (13/09/2026)

Pedido assim: *"teria como sempre deixar aquele quadro de cima fixo e ser o mesmo quadro para todos
os botões? E mesmo quando clicar no botão de TM e não ter TM à venda, ficar o quadro lá sem nada
mesmo, mas do mesmo tamanho, porque hoje ele tá dinâmico e tá ficando feio quando fica trocando de
item"*.

- **A ALTURA É FIXA, e não mínima.** Medido a 320px, o quadro ia de **253px** (Def Up) a **375px**
  (Despertar, o único que tem o botão de Vender E a linha de "Faltam 🪙 X") — **122px de pulo** a
  cada item clicado, com a lista inteira dançando junto. Hoje ele é `height:375px`, o maior medido.
  O `overflow-y:auto` é o que faz a altura ser uma PROMESSA: um item de descrição mais longa rola
  por dentro em vez de voltar a esticar o quadro. Com `min-height` o pulo voltaria no primeiro item
  que passasse de 375.
- **⚠️ ELE SOME NA PRATELEIRA VAZIA? NÃO MAIS — e isso reverte uma decisão de 12/09.** Ela era "não
  dizer a mesma coisa duas vezes, em cima e na lista", e durou um dia: com o quadro indo e vindo (e
  crescendo e encolhendo) a tela inteira dançava, que é justamente o que se pediu pra consertar.
  Na prateleira das TMs ele fica lá, do mesmo tamanho, **sem nada dentro** — foi o pedido ao pé da
  letra. Quem conta que não há nada à venda continua sendo a lista, que é onde a ausência está.
- **A LISTA MOSTRA 6 ITENS E ROLA** (`max-height:390px`). A linha mede **63px** a 320px, medida no
  navegador; 6 delas mais o padding dão os 390.
- **Conferido no navegador, nos 11 casos** (os 10 itens mais a prateleira vazia): quadro em 375px em
  todos, nenhum precisando rolar por dentro, lista com exatamente 6 linhas visíveis, sem rolagem
  horizontal.
- **⚠️ E OS BOTÕES TAMBÉM PARARAM DE DANÇAR (13/09/2026, a pedido):** *"dependendo do tamanho do
  texto eles sobem ou descem"*. A altura fixa tinha parado o QUADRO de pular entre um item e outro;
  o que ainda se mexia eram os botões DENTRO dele, porque a descrição muda de tamanho. Hoje o quadro
  é uma **coluna de três andares** — topo, miolo que rola, rodapé colado embaixo —, e quem cede é o
  miolo. Medido: o fim dos botões fica a **21px do fim do quadro nos 10 itens**, sem exceção.
  O `overflow` saiu do quadro e foi pro miolo: no quadro inteiro, o rodapé rolava junto.
- **⚠️ O VENDER ESTÁ SEMPRE NA TELA**, desabilitado e cinza quando não há o que vender. Ele aparecia
  e sumia conforme o estoque, por dois dias — a ideia era que a ausência dele já dizia "você não tem
  nenhum". Só que **um botão que vai e vem muda a altura do rodapé**, e aí o Comprar mudava de lugar
  conforme o item: exatamente o que se pediu pra parar. Ele diz por que está apagado ("Você não tem
  pra vender") em vez de só ficar cinza.
- **O PREÇO FOI PRO LADO DO NOME** na lista, e o "você tem N" saiu. Com os preços alinhados numa
  borda eles viram uma COLUNA que se compara de relance, que é pra isso que a lista existe.
- **⚠️ ISSO CUSTOU LARGURA, e a conta foi feita.** O CSS tinha um comentário explicando por que o
  preço estava embaixo: *"na coluna pela metade... sobram ~95px de texto; com o preço ao lado, Atk
  Special Up quebrava em três linhas"*. Era verdade — então a coluna da lista teve que crescer:
  `1fr 1fr` virou **`0.45fr 1fr`** (lista de 137px para 188px) e a fonte do nome caiu de .72 para
  **.68rem** — seis pixels são o que separa uma linha de duas em "Atk Special Up".
  Medido depois: **nenhum nome quebra** e todas as linhas ficam em 34-36px.
- **AS PRATELEIRAS PAGARAM A CONTA, e o ícone subiu pro topo delas.** Em linha, o ícone e o padding
  comiam 49 dos 85px e sobravam **36** pro rótulo: "Especiais" não cabia inteiro e "Para as
  batalhas" ia a três linhas, quebrando no meio da palavra. Empilhado, o texto fica com a largura
  toda do botão.
- **⚠️ E O TETO DA LISTA TEVE QUE CAIR DE 390 PARA 228px.** A linha encolheu de 63 para 36px quando
  o preço subiu pra mesma linha, e com o teto velho os **9 itens cabiam**: o limite de 6 tinha
  virado letra morta sem ninguém ver. **Número de tela envelhece junto com a tela** — é o mesmo
  tropeço do "59 espécies" da ficha da Pokédex, agora em CSS.
- `tools/test-inventario.js` cobra o quadro existindo nas TRÊS prateleiras, vazio na das TMs, os
  botões no RODAPÉ (irmão do miolo, não filho dele), o Vender presente e desabilitado sem estoque, o
  preço como IRMÃO do nome e o "você tem" fora da lista — e **lê o CSS** pra altura fixa, pra quem
  rola ser o miolo e pro teto da lista. Nada disso aparece em asserção de HTML.

### O ITEM EQUIPADO VAZAVA ENTRE SAVES (14/09/2026)

Reportado assim: *"o item que a gente equipar no pokémon, ele fica equipado no pokémon do slot,
porque hoje se eu equipo um pikachu no slot 3 com uma poção, está exibindo que o pikachu do slot 7
também tá com poção"*.

- **⚠️ A CHAVE ESTAVA CERTA; QUEM ESTAVA ERRADO ERA O CARIMBO.** A chave é `"SLOT:LINHA"` desde
  04/09/2026 e o servidor grava certo. O que vazava era o `slotDaConta` — o campo que diz **de que
  save este pokémon é** — porque o `equiparItens` o escrevia **UMA VEZ SÓ** (só quando estava
  vazio) e **a instância vai pro SAVE**. Um Pikachu equipado no slot 3 gravava `slotDaConta:"3"`
  DENTRO do save dele; dali em diante toda leitura daquele pokémon procurava o item do **slot 3**,
  e o Pikachu do slot 7 aparecia com a poção que não é dele.
- **HOJE O CARIMBO É REFEITO A CADA CHAMADA**, com esta precedência: o slot do **próprio pokémon**
  (`p.slot`, que só time misturado carrega) > o slot que **quem chamou** informou > o carimbo que já
  estava lá.
  **⚠️ O TERCEIRO DEGRAU NÃO É ENFEITE:** a Torre e o Ginásio da Cidade carimbam o slot **por
  pokémon** (o time mistura saves) e chamam o `equiparItens` **sem `slotPadrao`** — conferido, são
  as 4 chamadas de liga/online/torre do servidor. Sem ele, a correção teria apagado o item de quem
  mistura saves, que é justamente o caso pra que a chave com slot foi criada.
  Na jornada é o contrário: quem sabe de qual save o time é, é sempre quem chamou.
- **⚠️ E NEM `slotDaConta` NEM `item` VÃO MAIS PRO SAVE.** Os dois são **DERIVADOS** do que a conta
  tem equipado (`game.equipados`), e quem os escreve é sempre o `equiparItens` — gravados, eles só
  conseguiam ficar velhos. O corte é no `limparParaFirestore`, ao lado da regra do `_`, e não no
  `serializeGame`: é a camada que decide o que vai pro banco, e é por ela que passam **os dois**
  caminhos de gravação (o save inteiro e o `{ team }` do HM01).
  **Eles não ganharam `_` porque o SERVIDOR persiste o `slotDaConta` de propósito**: a subida da
  Torre é um documento que mistura saves e precisa lembrar de qual veio cada pokémon.
- **⚠️ E POR ISSO O SAVE RECARIMBA AO ABRIR** (`equiparItens` logo depois do `hydrateTeam`). O
  `p.item` é lido pelo **`calcMaxHp`**, que roda **FORA da batalha** (distribuição de níveis, Doce
  Raro): sem recarimbar na abertura, um HP Up equipado só contaria a partir da primeira luta e **a
  barra mudaria de tamanho sozinha ao entrar nela** — exatamente o que a sincronização do
  carregamento da conta existe pra evitar. É o primeiro instante em que dá pra saber as duas
  coisas: QUAL save abriu e o que a conta tem equipado.
- **⚠️ O `p.item` TINHA O MESMO VAZAMENTO, por outro caminho, e ele não foi relatado porque não tem
  selo na tela:** o `botaoDeItemHtml` lê o `game.equipados` (certo), mas o `calcMaxHp` lê o
  `p.item`. Um HP Up desequipado meses atrás continuaria inflando a barra daquele pokémon até a
  próxima batalha recarimbar.
- **⚠️ E O PRÓPRIO COMENTÁRIO DERRUBOU A TRAVA.** Ela procura o código velho (`if(p.slotDaConta ==
  null)`) nos dois arquivos — e a primeira versão do comentário CITAVA esse código, no `index.html`,
  que é publicado inteiro. O comentário se acusava. É a mesma armadilha já registrada na
  bifurcação ("citar nome de líder no comentário faz um teste que procura nome de líder na tela
  acusar o próprio comentário"), agora numa trava que lê o CÓDIGO em vez da tela.
- `tools/test-inventario.js` tranca o caso do relato com o carimbo velho já gravado (o slot que
  equipou mostra, o outro não), que nenhum dos dois campos chega ao banco, que o HP Up conta antes
  da primeira batalha, que o time misturado mantém o item de cada slot, e — **lendo o código** — que
  o carimbo não gruda nos dois motores e que o save recarimba ao abrir. Conferido que ele acusa **4
  falhas** com o defeito religado.

### VENDER: metade do preço de compra (11/09/2026)

Pedido assim: *"na loja, caso o usuário já tenha um dos itens listado, ele pode ter a opção vender
por 50% do valor de compra. Então vai abrir um botão Vender embaixo do botão Comprar"*.

- **O BOTÃO SÓ APARECE QUANDO HÁ O QUE VENDER**, e é o que o pedido diz. Um botão sempre visível e
  quase sempre desabilitado seria mais uma coisa apagada na tela — e aqui a **ausência dele já
  informa**: "você não tem nenhum". Fica **embaixo** do Comprar (a `.loja-acoes` empilha em coluna;
  a `.item-acoes` sozinha é uma LINHA, porque ela nasceu na mochila com Usar e Excluir lado a lado)
  e no **vermelho do `danger`**, pelo mesmo motivo do Excluir: sai coisa da conta.
- **A METADE SAI DO MESMO `preco` do catálogo**, nos dois lados (`precoDeVenda`, aqui e no
  servidor). Um segundo número escrito à mão divergiria no primeiro reajuste — é o mesmo cuidado
  que o preço de COMPRA já carrega, e o teste **compara os dois catálogos item a item**, lendo o
  preço do servidor direto do código.
  `Math.floor` porque os quatro preços do jogo são pares e dividem redondo hoje; o piso está ali
  pro dia em que um preço ímpar entrar, e ele erra a favor do JOGO.
- **⚠️ O QUE DÁ PRA VENDER NÃO É O QUE A MOCHILA MOSTRA, e o Bônus Shiny foi o caso que obrigou esta
  função a existir.** O `quantoTenho` soma os **CUPONS** (o save campeão e a notificação de liga) com
  o estoque comprado, porque pra USAR os dois valem igual. Pra VENDER não: cupom é uma marca de
  "você ganhou isso" dentro de um save ou de uma notificação, **não uma linha de estoque** — não há
  de onde descontar. Por isso existe o `quantoPossoVender`, que olha só o **armazém** (e o contador,
  no Doce Raro). Se as duas contas divergirem, a tela oferece um botão que a cobrança recusa.
  **⚠️ HOJE O BÔNUS SHINY NÃO SE VENDE DE JEITO NENHUM** (12/09/2026): ele saiu do catálogo, e o
  `quantoPossoVender` devolve 0 pra quem não é `comprável` antes mesmo de olhar o armazém. A função
  continua valendo pelo mesmo motivo — ela é o que impede a tela de oferecer o que a cobrança
  recusa — e o Doce Raro, que também vem de jogar, continua vendendo.
- **QUEM PAGA É O SERVIDOR, em transação** — a mesma regra de tudo que mexe em moeda. Aqui ela pesa
  mais que na compra: sem a transação, duas abas leem o mesmo estoque e as duas passam, e isso
  **cria moeda do nada**.
- **VENDE O QUE TEM, não menos:** pedir 10 tendo 4 vende 4, e a resposta diz quantos foram. É a
  mesma regra da compra, e pelo mesmo motivo — recusar tudo porque o estoque mudou entre a tela e a
  transação seria pior que fazer o que dá.
- **O POPUP É O MESMO da compra, em modo de venda** (`game.compraModo`): é a mesma pergunta
  ("quantos?"), com o mesmo stepper e o mesmo Máx. Duas telas pra isso divergiriam no primeiro
  ajuste — a lição das três telas de golpe, que viraram uma cópia só **depois** de já terem
  divergido no texto. O que muda é o **teto** (o estoque, não o dinheiro), o total ("Você recebe")
  e o botão.
  O `abrirCompra` **zera o modo**: sem isso um "vender" anterior grudaria e o popup aberto pelo
  Comprar diria Vender.

**⚠️ NÃO EXISTE LOOP DE ARBITRAGEM, e isso é por construção:** comprar por 300 e vender de volta
devolve 150 — **perde metade**. Qualquer fração acima de 100% viraria máquina de moeda, e há um
caso de teste que compra 10 poções por 300 e vende de volta por 150 justamente pra gritar no dia em
que alguém mexer na constante.

**⚠️ MAS ELA CRIOU UMA TORNEIRA, e esse era o custo real da feature.** O que vem de JOGAR passa a
virar moeda:

| | vende por | = quantas jornadas (70/jornada) |
|---|---|---|
| ~~**Bônus Shiny**~~ | ~~400~~ | **não se vende mais** — ver abaixo |
| **Doce Raro** (pódio da Torre) | **150** | **2,1 jornadas** |
| Despertar / Super Poção / Faixa | 25 | 0,36 |
| Poção e os cinco de atributo | 15 | 0,21 |

**⚠️ O BÔNUS SHINY SAIU DA LOJA EM 12/09/2026, a pedido: não se compra nem se vende.** Ele era ao
mesmo tempo o item mais forte que ela tinha (a chance escala +10 pontos por encontro sem shiny —
78% de já ter um no 5º encontro) e a maior torneira de moeda dela: **400 por unidade**, quase seis
jornadas de renda por um prêmio que vem de jogar. Este arquivo já apontava esse lugar como a
alavanca ("tirar os dois prêmios da venda"), e ela foi puxada — só que inteira, tirando também a
compra.
**O QUE FECHA OS DOIS É A AUSÊNCIA NO CATÁLOGO DO SERVIDOR** (`LOJA`): o `buyItem` e o `sellItem`
consultam ele antes de qualquer outra coisa, então nem um cliente velho em cache consegue comprar
ou vender. No cliente basta tirar o `comprável` e o `preco` — o `renderLoja` lista por `comprável`,
e o `quantoPossoVender` e o `precoDeVenda` já devolvem 0 pra quem não é.
**QUEM JÁ COMPROU CONTINUA COM O DELE**: a mochila lê o `quantoTenho` (que não passa pelo
`comprável`) e o `activateBoughtShinyBonus` lê o inventário direto. Apagar o estoque de quem pagou
seria tirar o que já foi comprado.
**⚠️ E ELE NÃO VEM SÓ DA ELITE 4 — são TRÊS fontes**, e vale saber quais, porque o pedido dizia "só
pode ser obtido quando ganha da elite 4":
  1. **a Elite 4** (`eliteShinyGranted` no save), que vira cupom na mochila;
  2. **o campeão de liga** (a notificação `league_champion`), que vira cupom do mesmo jeito;
  3. **o Top 10 da raide do Mew**, que não é item — ele escreve o `shinyBonusExpiresAt` direto, ou
     seja liga a hora na hora.
  As duas últimas **continuam valendo**: o pedido era sobre a loja, e tirar prêmio de modo inteiro é
  outra decisão. Se for pra ficar só a Elite, os lugares são o `cuponsDeBonusShiny` (a notificação)
  e o prêmio do `fightSundayBoss`.
**AS DUAS ALAVANCAS DO RE-SORTEIO CONTINUAM DE PÉ** (preço 5 e teto de 8 por save) — elas foram
puxadas justamente por causa desta torneira, e o que sobra agora é só o Doce Raro (150).
Se um dia incomodar, o que resta é **baixar a fração** (`VENDA_FRACAO`) ou tirar o Doce Raro da
venda, do mesmo jeito.

- `tools/test-moedas.js` tranca: a metade de cada preço, que o Doce Raro sai do CONTADOR e não do
  inventário, que pedir mais do que se tem vende o que tem, que sem estoque ele recusa **e não paga
  nada**, que o Bônus Shiny **não se compra nem se vende — nem tendo estoque**, que o estoque de
  quem já tinha fica intacto e continua ativável, que comprar e vender de volta perde metade, e que
  o preço que o cliente desenha é exatamente o que o servidor paga.
  `tools/test-inventario.js` tranca o outro lado: que a loja desenha **uma linha por item à venda**
  (contado do catálogo, e não um número escrito à mão — ele já envelheceu quando o Bônus Shiny
  saiu) e que **o único item do catálogo fora da loja é o Bônus Shiny**, pra o próximo que perder o
  `comprável` ser decisão e não descuido.

### O popup de quantidade
- **ELE SERVE COMPRAR E VENDER desde 11/09/2026** (`game.compraModo`): é a mesma pergunta, com o
  mesmo stepper e o mesmo Máx. O que muda é o teto — comprando é o que o dinheiro paga, vendendo é
  o que você TEM (`tetoDoPopup`) —, o total ("Você recebe") e o botão. Ver a seção **VENDER**, acima.
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
  **Doce Raro 4,3**. (O Bônus Shiny custava 11,4 e saiu da loja em 12/09/2026.)
- **O Doce Raro é +1 nível, e um nível sozinho quase não se vê**: medido em 8.000 batalhas 6x6
  nível 60 (1σ = 0,79 ponto), +1 nível no líder do time vale **+0,54 ponto** — dentro do ruído.
  O que ele compra é ACÚMULO: +5 níveis valem **+4,25** (5,4σ) e +10 valem **+8,19** (10,4σ).
  A 4,3 jornadas por doce, subir um pokémon 10 níveis custa **43 jornadas completas**. É lento de
  propósito, e o teto de nível 99 continua valendo.
- **⚠️ O BÔNUS SHINY É O EFEITO MAIS FORTE DO JOGO, e foi por isso que ele saiu da loja.** A chance
  dele não é fixa: começa em 5% e sobe **+10 pontos por encontro sem shiny** enquanto durar
  (`SHINY_PITY_STEP`). Calculado: 39% de já ter um shiny no 3º encontro, **78% no 5º, 99% no 8º** —
  ou seja, uma jornada inteira sob o bônus é praticamente um shiny garantido, contra **6,1%** sem
  ele no modo normal.
  As 11,4 jornadas de preço eram o que segurava isso. **Desde 12/09/2026 ele não tem preço nenhum**:
  não se compra nem se vende, e só vem de jogar (ver a seção VENDER, que é onde estão as três
  fontes que sobraram).

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
  e ele trabalha em **1,5%** das batalhas. Parece pouco e é: o sono era 5% por confronto (hoje é
  15%, o que triplica o trabalho dele -- o número acima é de antes) e
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
- **⚠️ O TETO DE DANO ESTÁ DESLIGADO desde 09/09/2026** (`DMG_CAP_PCT = Infinity` nos dois motores).
  Ele valeu **0.65** (0.70 no crítico) por quase toda a vida do jogo: limitava cada golpe a 65% do
  HP máximo do alvo, e era ele que garantia que **one-shot não existe** — nenhum golpe derrubava de
  vida cheia, e todo pokémon respondia pelo menos uma vez. **Isso acabou.**
  Saiu pra um experimento e o resultado foi aprovado pro ar. **Medido na retirada:** a jornada
  concluída sobe ~**9 pontos** e a dificuldade **inverte de formato** — os game overs no Brock caem
  de **799 pra 417** e os do Giovanni sobem de **171 pra 267**. O começo afrouxa (o time inicial
  deixa de apanhar de graça) e o fim aperta (líder de nível alto derruba num golpe).
  **Tudo que este arquivo diz sobre "o teto" abaixo está escrito na época em que ele valia**, e
  vários números foram medidos com ele ligado. Se um dia voltar, é `0.65`/`0.70` nos DOIS motores.
- **O que o teto fazia com os itens de atributo, medido quando ele ainda valia:** ele engolia o
  bônus em 12,3% dos golpes — quem já batia no teto não ganhava nada com mais ataque.
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
  mesmo `TETO_GOLPES`.** ⚠️ **Isto virou história em 15/09/2026**: sem teto, um confronto COM
  diário mostra os golpes reais e a Faixa é uma linha no meio deles; o partidor em duas metades só
  alcança log gravado antes de o diário existir.
  A luta corre normal até o pokémon chegar a zero, a Faixa o devolve a 1, e o que vem depois se lê
  como uma luta nova em que ELE ataca primeiro. No log continua sendo um confronto só.
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
- **O preço em linhas, medido de novo com o TETO_GOLPES em 4** (11/09/2026; o mesmo bot contra os
  dois valores, ~6.400 confrontos de cada tipo em cada lado): a luta comum fica em **2 linhas em 77%,
  3 em 7% e 4 em 16%** e nunca passa do teto — a regra da casa não se move. A com Faixa fica em
  **5 linhas em 52%**, 6 em 26%, 3 em 15%, e o **maior é 9** (era 14 na versão sem teto).
  **Ela ENCURTOU com o teto maior, o que é contra a intuição e tem causa:** cada metade é
  reconstruída em separado, e a reconstrução sempre devolvia **três** linhas; com o teto em 4 mais
  metades saem do diário REAL, e uma metade real costuma ter uma ou duas. No teto 3 eram 5 linhas em
  33% e 6 em 33%, com o maior em 8.
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
  ela entra na taxa de crítico (velocidade/512, regra da Gen 1).
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

## Painel de treinadores (`admin-treinadores.html`, 12/09/2026)

Pedido assim: *"uma página onde eu consiga ver todos os treinadores online, e também os offline, os
saves e como tá o time de cada save"*. Ela mostra quem está online, os saves de cada conta e o time
de cada save, com nível, shiny, tipos e barra de vida.

- **⚠️ POR QUE É UMA CLOUD FUNCTION E NÃO UMA PÁGINA LENDO O FIRESTORE.** A regra do
  `/users/{userId}` deixa ler **só o próprio documento** (`request.auth.uid == userId`), e os saves
  herdam isso — não existe consulta de cliente que veja a conta de outro. Afrouxar a regra pra isso
  abriria o save de todo mundo pra qualquer jogador logado, que é o oposto do que ela protege. O
  Admin SDK ignora as regras, então quem lê é o servidor (`adminListTrainers`).
- **⚠️ A PORTA É UM CAMPO QUE O CLIENTE NÃO ESCREVE** (`users/{uid}.admin === true`), e ela **não
  podia ser um segredo no código**: o `firebase.json` publica a RAIZ do repositório, então
  `jornadakanto.com/functions/index.js` é baixável — conferido, responde 200, junto com o
  `CLAUDE.md` e o `tools/`. Qualquer lista de uid ou e-mail ali seria pública.
  E o `userTest` **não serviria**: ele é livre pro dono (a trava de campos das regras não o cobre),
  ou seja uma linha no console do navegador e qualquer jogador lia a conta alheia. O `admin` entrou
  nessa trava junto com a função — só o console do Firebase escreve nele.
- **PRA LIGAR:** no console do Firebase, em `users/{seu uid}`, acrescentar o campo `admin`
  (booleano) = `true`. **A página mostra o uid na própria recusa** — sem isso a mensagem mandaria
  fazer algo que não dá pra fazer, porque o uid não aparece em lugar nenhum do jogo.
- **A PÁGINA É PÚBLICA e não tem como não ser** (é a raiz publicada). O que protege os dados não é
  ela estar escondida: é a função recusar. Sem o campo, ela abre e não mostra nada.
- **⚠️ CUSTO: 1 leitura por treinador MAIS 1 por save dele**, e é por isso que ela é PAGINADA (20
  por página, teto de 60) em vez de devolver a conta inteira. O cursor é o **id do documento** (o
  uid): é a única ordenação que não precisa de índice nem de um campo que todo documento tenha.
  **Ela lê um documento A MAIS** só pra saber se existe próxima página — sem isso, a última página
  cheia oferecia um "carregar mais" que carregava nada.
- **⚠️ QUEM ESTÁ ONLINE VEM SEMPRE NA FRENTE, e não só "ordenado primeiro" (13/09/2026).** Essa era
  a diferença que fazia a página mentir: a paginação caminha por **UID**, e quem está jogando agora
  está espalhado por essa ordem — com 20 por vez, um treinador online com uid no fim do alfabeto só
  aparecia depois de alguns cliques em "Carregar mais", e o contador dizia **"1 online" com 4
  jogando**. Reportado assim: *"hoje tem gente online mas só carrega 20 ... dessas que carregou
  mais, tinha gente online porém eu só conseguia ver se eu clicasse no carregar mais"*.
  Hoje quem está online sai de uma **consulta própria** (`where(lastSeenAt, >=) + orderBy` no MESMO
  campo, teto de `ADMIN_ONLINE_MAX` = 50) e é o começo da lista. **Não precisa de índice composto**:
  a desigualdade e a ordenação são do mesmo campo, então o índice de campo único que o Firestore cria
  sozinho já serve — conferido contra a produção antes de subir, `where + orderBy DESC` devolvendo
  29 contas em ordem. Quem não tem `lastSeenAt` não casa com a desigualdade, que é o certo: nunca
  visto é offline.
- **O BLOCO DE ONLINE NÃO CONTA PRO LIMITE** — ele vem por cima dos 20. Uma primeira página num dia
  de pico pode ter 50 + 20 linhas, e cada uma custa 1 leitura mais 1 por save: é o preço de a
  pergunta "quem está jogando agora?" ser respondida sem clique nenhum. Estourando os 50, a resposta
  diz (`onlineTruncado`) e a tela avisa, em vez de mentir a contagem.
- **⚠️ E A PÁGINA SE ENCHE DEPOIS DE TIRAR OS REPETIDOS.** Quem já veio no bloco de online não
  aparece de novo — e tirá-los da fatia deixava a página curta e, no pior caso, **vazia**: a última
  fatia podia ser só de gente online, e a tela oferecia um "Carregar mais" que não carregava nada. É
  o mesmo defeito que o `limite + 1` existe pra evitar, entrando por outra porta. Hoje ela busca de
  novo enquanto sobrar espaço e houver banco, com teto de `ADMIN_VOLTAS_MAX` (6) voltas pra uma
  coleção só de gente online não virar uma varredura inteira numa chamada só.
  **O cursor é o último documento MOSTRADO**, então a página seguinte relê os online que ficaram no
  meio e os filtra de novo — algumas leituras a mais, que é o lado certo pra errar: com o cursor
  adiantado, uma conta offline no meio sumiria da lista sem ninguém ver.
- **A CONTAGEM DE ONLINE É A DA COLEÇÃO, não a da página.** Ela sai da consulta acima; antes contava
  só o que tinha sido carregado, e era isso que fazia o número na tela estar errado. Se a consulta
  falhar (ela vive num `try` como a dos ginásios liderados), a página volta a ser o que era e o
  contador cai no que dá pra afirmar.
- **A ORDEM DA TELA — online primeiro, depois por visto por último — é a ordem em que a pergunta é
  feita**, e ela é refeita na lista INTEIRA a cada carga. O servidor ordena só o que ELE devolveu;
  concatenando páginas, um treinador offline da primeira ficava acima de um mais recente da segunda.
  Medido a 320px: o cabeçalho fica em 260px (308 com o aviso de truncado) e não há rolagem lateral.
- **ONLINE = visto nos últimos 10 minutos**, e o número não é escolhido aqui: é o mesmo do
  `vistoPorUltimo` do jogo ("agora há pouco"), que é o que o jogador já lê na lista de amigos. O
  carimbo tem folga de 5 min (`LAST_SEEN_THROTTLE_MS`), então qualquer janela menor mostraria
  offline quem está jogando.
- **O TIME E O SAVE VOLTAM RESUMIDOS.** O documento do save tem dezenas de campos de estado de tela
  (`wildOffer`, `routeCards`, `battleResult`) que não dizem nada sobre "como está o time", e mandar
  isso de 20 treinadores × N saves seria um payload enorme pra desenhar seis etiquetas. O **nome e
  os tipos saem do `SPECIES` do servidor**, então a página não carrega tabela nenhuma.
- **⚠️ A ORDEM DOS SLOTS É NUMÉRICA, na mão** — o Firestore devolve por id em ordem de TEXTO, então
  o `"10"` vem entre o `"1"` e o `"2"`. É a mesma armadilha que já mordeu a Trainers League.
- **O `tools/fake-firestore.js` aprendeu `select()`** junto com o bloco de online: o Firestore devolve
  os documentos sem dado nenhum, e é assim que as páginas seguintes descobrem quem já foi mostrado
  sem pagar o payload de novo (a leitura continua sendo cobrada; o que se economiza é banda).
- **O `tools/fake-firestore.js` aprendeu `startAfter` e `FieldPath.documentId()`** por causa disto.
  Sem eles o `startAfter` era ignorado e **a segunda página devolvia a primeira** — o teste passava
  e a paginação quebraria só em produção. É a mesma lição do `increment` dentro de mapa e do ponto
  no `update()`.
- **A busca da página filtra o que JÁ foi carregado**, não vai ao servidor: com a lista paginada,
  buscar no banco exigiria um índice por nome e mudaria o custo da página.
- **O login erra igual pros dois casos** ("E-mail ou senha incorretos"), como o do jogo: repassar o
  `user-not-found` do Firebase transformaria o formulário num oráculo de quem tem conta.
- **⚠️ ELA MOSTRA A CONTA INTEIRA, e isso foi pedido depois** (13/09/2026): *"quero saber tudo o que
  está acontecendo na conta dos outros treinadores sendo o admin do jogo"*. Por treinador vêm
  moedas, doces, **mochila** (sem os itens zerados — o `increment` deixa a chave em 0 quando acaba),
  **o que está equipado e em quem**, HMs, Pokédex normal e shiny, especialidades, ligas, sequência,
  bônus shiny valendo, empréstimo do Mewtwo, cidade e **os ginásios que ele lidera**.
  Por save vem **onde a jornada está** — trecho, região, rota, tela, derrotas naquele ginásio,
  etapa da Elite, fase do esconderijo — e o time com **golpes e item**.
  **O que fica de fora é o que não diz nada sobre o jogador:** o `startersSorteados` e o
  `geracaoDosSlots` são trava anti save-scumming, e a `leagueLeaderboard` é uma cópia do ranking que
  a própria tela do jogo já mostra.
- **OS GINÁSIOS LIDERADOS SAEM DE UMA CONSULTA SÓ pra a página inteira** (`where(leaderUid, in, ...)`,
  em blocos de 30, que é o teto do `in`), e não uma por treinador — com 20 por página seriam 20 idas
  ao banco por uma linha de informação. Eles **não dariam pra deduzir do save**: a defesa do ginásio
  é um código CONGELADO, não o time atual.
  **A consulta está num `try` que só loga**: ela precisa de índice em `leaderUid`, e sem ele a lista
  inteira de treinadores viria vazia por causa de uma linha de enfeite.
- **O NOME DOS GOLPES VEM DO SERVIDOR** (`GOLPES_PT`), que já mora lá desde o moveset dos NPCs —
  então a página não carrega tabela nenhuma. **O nome dos ITENS é a exceção**: a `LOJA` do servidor
  só guarda preço, e o catálogo com nome e descrição é do cliente do jogo; mandar tudo isso pro
  painel seria duplicar uma tabela de apresentação, então são onze nomes na página e item novo sem
  nome sai com o id.
- **O `tools/fake-firestore.js` aprendeu o `in`** por causa disto. Sem ele a consulta dos ginásios
  caía no `catch` do próprio código testado e **o teste dava verde sem cobrir nada** — a mesma
  classe de armadilha do `startAfter`.
- `tools/test-admin.js` tranca a porta (sem login, sem o campo, `admin:'sim'`, `admin:false`, conta
  inexistente), **lê a REGRA como texto** pra garantir que o campo continua fora do alcance do
  cliente, e cobre a paginação, a ordem dos slots e o save não voltando cru.
  E tranca o ONLINE PRIMEIRO no caso que foi reportado: um treinador online com o uid no FIM da
  ordem do banco tem que sair na PRIMEIRA página mesmo com limite 2, os online vêm na frente, a
  contagem é a da coleção, o resto da página vem cheio, e -- caminhando todas as páginas -- ninguém
  repete nem some. Conferido que ele acusa 4 falhas com o bloco de online removido.

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

## O HISTÓRICO DAS LIGAS NO FIRESTORE (13/09/2026)

Perguntado assim: *"o `leagueCycles` está guardando vários registros de liga clássica ao longo do
tempo. Seria interessante limpar os registros que estão a mais de uma semana pra melhorar
performance/custo, ou não influencia em nada?"*. **Não influencia** — e a resposta importa mais que
a pergunta, porque ela vale pra toda coleção deste projeto.

- **O CUSTO DO FIRESTORE É POR DOCUMENTO LIDO, NÃO POR DOCUMENTO GUARDADO.** Uma coleção com 10 mil
  documentos custa igual a uma com 10, desde que ninguém a varra — e a busca por id é O(log n).
  Conferido: **nenhum acesso ao `leagueCycles` varre a coleção**, é tudo `cycleDocRef(typeId, id)`.
- **E A PODA JÁ EXISTIA, mais agressiva que uma semana:** `LEAGUE_HISTORY_RETENTION = 48` mantém os
  48 ciclos concluídos mais recentes. Como a Clássica roda de hora em hora, são **2 dias**. O número
  está amarrado à lista "Suas últimas Ligas" do cliente — baixá-lo quebra o botão "Rever".
- **Medido em produção:** 48 ciclos vivos (~7 KB cada), `leagues/schedule_classic` com 49 entradas e
  **9,5 KB** — e é ele, não o `leagueCycles`, o documento que é lido a toda consulta de liga. Tudo
  somado dá menos de 1 MB, contra 1 GiB gratuitos.

### ⚠️ MAS APAGAR UM DOCUMENTO NÃO APAGA AS SUBCOLEÇÕES DELE

A poda fazia `cycleDocRef(...).delete()` e pronto. No Firestore isso apaga **só o documento**: as
subcoleções continuam existindo, invisíveis no console (o pai vira *missing*), pra sempre.

- **Medido um mês depois de a poda entrar: 687 ciclos órfãos**, de 13/08 em diante, com **~3.400
  documentos de inscritos** parados dentro.
- **Hoje isso custava centavos** — alguns MB, dentro do gratuito. Mas cresce pra sempre: no ritmo de
  hoje são ~8.000 órfãos por ano. É o tipo de coisa que só vira problema quando já é grande demais
  pra limpar sem susto.
- **A LISTA DAS SUBCOLEÇÕES VIVE NUMA CONSTANTE** (`SUBCOLECOES_DO_CICLO`): o dia em que nascer uma
  terceira, ela entra lá e os dois caminhos de poda já limpam junto. Escrita em cada lugar, a
  próxima ficaria pra trás.
- **A limpeza apaga em LOTES de 300** (o `batch` do Firestore aceita 500) e devolve quantos apagou,
  pra o log contar.
- **⚠️ E ELA TEM QUE VIR ANTES DO `delete()`**: depois, o pai já não existe pra alcançar as
  subcoleções por referência. `tools/test-liga-treinadores.js` cobra as duas coisas — a limpeza
  funcionando em 700 documentos (pra o laço de lotes dar mais de uma volta) e, **lendo o código**,
  que a poda a chame antes de apagar: os casos chamam a função na mão e passariam com a chamada
  órfã.
- **O que já tinha vazado foi limpo à mão**, com o script em seco antes.

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
  é pago**. Um campeão de antes do sistema receberia 70 moedas de uma vez — 14 re-sorteios de
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

- **5 moedas trocam a oferta INTEIRA — espécies e níveis** da rota atual (`MOEDAS_RESSORTEIO`, no
  cliente e no servidor; se os dois divergirem, a tela promete um preço que a cobrança não pratica).
  **ERA 3 ATÉ 11/09/2026**, e subiu a pedido — no mesmo dia em que a loja passou a COMPRAR itens de
  volta, que é o que tinha criado moeda nova. Ver o custo medido no fim desta seção.
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
  Ele carrega os dois textos: **"🪙 5 - Sortear novamente"** à esquerda e **"Possui: 🪙 N"** à
  direita, dentro do mesmo botão. Por isso a fonte dele é menor que a dos outros botões, e isso foi
  medido: a 320px sobram ~170px pra ação depois do saldo, e a frase no corpo normal (14,4px) mede
  200 -- quebrava em duas linhas. Quem tem que caber com folga é o SALDO, que cresce com 4 dígitos;
  a ação é texto fixo.
  A frase que explicava tudo isso em texto ("Você tem X. O re-sorteio troca as espécies E os
  níveis") saiu a pedido em 02/09/2026: o botão já diz o preço e o saldo.
- **COM O BÔNUS SHINY LIGADO O PREÇO SOBE A CADA RE-SORTEIO NA MESMA ROTA: 5, 10, 15...**
  (`precoDoRessorteio`, no cliente e no servidor). Sem o bônus fica nos 5 de sempre.
  **A ESCALADA SAI DA PRÓPRIA CONSTANTE** (`MOEDAS_RESSORTEIO * (1 + wildRerolls)`), e é por isso
  que subir o preço de 3 pra 5 mudou a série de 3/6/9 pra 5/10/15 sem tocar na fórmula — era uma
  linha em cada motor. Insistir até o 5º na mesma rota custava 45 e passou a custar **75**.
  O motivo da escalada é a matemática do bônus: a chance dele **escala +10 pontos por encontro sem
  shiny** (78% de já ter um no 5º encontro), então re-sortear sob o bônus é quase comprar um shiny.
  **Volta pros 5 na rota seguinte**, porque o `wildRerolls` zera a cada encontro novo: o que se
  quer encarecer é insistir NA MESMA rota, não jogar.
- **⚠️ TETO DE 8 RE-SORTEIOS POR SAVE (11/09/2026, `MAX_RESSORTEIOS_POR_SAVE`).** É a trava que o
  PREÇO não consegue ser: preço depende de quanto o jogador tem, e **toda fonte de moeda nova**
  (o pagamento da jornada, a venda de itens, o que vier depois) reabre a torneira. O teto não se
  importa com o saldo.
  Oito é **um por encontro** — a jornada tem 8 —, mas eles NÃO são por rota: dá pra queimar os oito
  no primeiro encontro e ficar sem nenhum no resto. É decisão, e é o que faz o teto virar escolha.
- **⚠️ O CONTADOR NÃO PODE MORAR NO SAVE, e essa é a parte que quase passou.** O documento do save é
  LIVRE pro dono (`allow read, write: if uid == userId`), e o `wildRerolls` se dá ao luxo disso
  porque **mentir nele não paga**: ele alimenta a SEMENTE, então um re-sorteio barato devolve a
  MESMA oferta. **Mentir no TOTAL paga** — compra re-sorteio a mais. Por isso ele vive no documento
  da CONTA (`rerollsPorSave`), **na mesma trava das moedas** no `firestore.rules`, e quem escreve é
  o `rerollWildOffer`. Há um caso de teste que gasta os 8, zera o `wildRerolls` do save "no console"
  e confirma que **não volta nenhum**.
- **A CHAVE É `slot:saveGen`**, e isso resolve o reuso de slot de graça: quando um save é apagado e
  outro nasce ali, a **geração do slot avança** e a chave muda — o teto do save novo nasce zerado
  sem ninguém limpar nada. É o mesmo mecanismo que já fecha o save-scumming dos iniciais, reusado.
  Uma limpeza à mão teria esquecido algum caminho; esta não tem o que esquecer.
- **⚠️ SEM SLOT ELE PASSOU A RECUSAR**, e isso mudou o comportamento antigo. Antes, cliente sem slot
  "caía no preço de sempre, em vez de quebrar"; com o teto isso virou buraco — **não mandar o slot
  seria o jeito de furá-lo**, e um cliente adulterado faria exatamente isso. O `index.html` vai com
  `no-cache` e revalida a cada visita, então cliente velho de verdade dura um F5.
- **O contador sobe na MESMA transação da cobrança.** Separados, duas abas passariam pelo teto
  juntas — e há um caso que deixa 1 sobrando, dispara duas abas e cobra que só uma passe e o total
  pare **exatamente em 8**.
- **NA TELA:** o botão apaga ao acabar, e o **saldo cede o lugar** pra "Acabaram os desta jornada" —
  os dois não cabem juntos a 320px (sobram ~170px pra a ação depois do texto da direita, e
  "Possui: 🪙 1000" já ocupa isso). Enquanto há re-sorteio, quem decide é o dinheiro; quando acaba,
  o dinheiro deixou de importar e o que a pessoa precisa saber é POR QUE o botão apagou.
  A linha "Restam N" só aparece **depois do primeiro re-sorteio**: numa jornada em que ninguém
  re-sorteou, dizer "8 de 8" seria anunciar um limite que ninguém estava perto de encostar.
  E a recusa do servidor **nomeia o teto, não a moeda** — são problemas diferentes, e um botão
  apagado sem motivo faz procurar bug.

**O PREÇO MEDIDO DO TETO:**

| | re-sorteios | jornadas com shiny |
|---|---|---|
| sem gastar nada | 0 | 22,2% |
| o que 70 moedas pagavam a 3 | 23 | **62,2%** |
| o que 70 moedas pagam a 5 | 14 | 49,9% |
| **com o teto de 8** | **8** | **39,5%** |

Ou seja, os dois freios do mesmo dia levaram o caçador de shiny de **62,2% pra 39,5%** — e o teto
sozinho vale **−10,4 pontos** em cima do preço.

**DUAS CONSEQUÊNCIAS QUE VALE SABER, e nenhuma delas é ruim:**
1. **A ESCALADA DO BÔNUS SHINY VIROU QUASE DECORATIVA.** Ela existe pra impedir farmar UMA rota;
   com o teto, gastar os 8 numa rota só custa `5+10+15+20+25+30+35+40 = 180` moedas — **2,6
   jornadas de renda**, que ninguém tem em mãos. O teto já faz o trabalho dela. Ela FICA porque
   ainda molda ONDE os 8 vão (espalhar é muito mais barato que amontoar), mas virou o segundo freio
   de uma roda que o teto já parou.
2. **O RE-SORTEIO DEIXOU DE SER O SUMIDOURO DE MOEDA QUE ERA.** Oito a 5 custam **40** de uma
   jornada que paga **70** — sobram 30 por jornada sem destino urgente, e eles vão pra loja. É
   provavelmente bom, mas é uma mudança de papel: antes o re-sorteio absorvia tudo que entrava.
   ⚠️ Esta conta virou HISTÓRIA em 12/09/2026: o Bônus Shiny saiu da loja e não se vende mais.
   E a venda de um Bônus Shiny (400 moedas) deixou de virar 80 re-sorteios numa jornada: viram
   **10 jornadas com o teto cheio**, espalhados no tempo em vez de concentrados.
- **O contador do PREÇO vem do SAVE, e isso é seguro por construção — mas só pro PREÇO.** O
  servidor lê `wildRerolls` do save gravado, que o cliente escreve. Mentir que é zero não compensa:
  ele entra na **semente da oferta**, então o re-sorteio barato devolve a MESMA oferta de antes.
  Quem falsifica o contador não recebe pokémon novo nenhum.
  **⚠️ ESSE ARGUMENTO NÃO VALE PRO TETO**, e é por isso que o teto mora em outro lugar: lá mentir
  compra re-sorteio a mais. Ver o item do teto, logo acima.
  Por isso o cliente faz `await saveCurrentGame()` **antes** de chamar a cobrança: sem ela, dois
  re-sorteios seguidos leriam o mesmo contador velho e o segundo sairia pelo preço do primeiro.
- **A recusa diz quanto falta E o preço CERTO** ("Você tem 5 moedas — o re-sorteio custa 15"), senão
  o botão promete um preço e a cobrança pratica outro. Ele também já nasce desabilitado abaixo do
  preço da vez.
- **O PREÇO MEDIDO.** Com as 70 moedas de uma jornada completa gastas na jornada seguinte, a chance
  de ver um shiny numa jornada (4.000 jornadas de cada caso):

  | re-sorteios por encontro | ofertas na jornada | jornadas com shiny |
  |---|---|---|
  | 0 (sem gastar nada) | 8 | **22,6%** |
  | 1 | 16 | 39,0% |
  | 2 | 24 | 52,2% |
  | 3 | 32 | **62,5%** |

  **⚠️ O QUE AS 70 MOEDAS COMPRAM MUDOU EM 11/09/2026, quando o preço foi de 3 pra 5:**

  | preço | re-sorteios que 70 moedas pagam | por encontro | jornadas com shiny |
  |---|---|---|---|
  | 3 (antes) | 23 | 2,9 | **62,2%** |
  | **5 (hoje)** | **14** | **1,8** | **49,9%** |

  Ou seja: gastar tudo em re-sorteio ainda **dobra** a chance de shiny por jornada (de 22,6% pra
  ~50%), mas deixou de quase **triplicar**. São **−12,3 pontos** de chance de shiny por jornada pra
  quem gasta tudo nisso.
  **E O TETO DE 8 CORTOU MAIS 10,4 PONTOS em cima disso** (49,9% → **39,5%**), porque as 70 moedas
  passaram a pagar mais re-sorteios do que o save permite usar. Hoje quem manda é o teto, não o
  preço — ver o item dele acima.
  **O número é calculado, não simulado** — `1 − (1 − 1/128)^(ofertas × 4 cards)` —, e o cálculo foi
  validado contra a tabela medida acima: ele devolve 22,2% / 39,5% / 52,9% / 63,4% contra os 22,6% /
  39,0% / 52,2% / 62,5% que a simulação de 4.000 jornadas deu. Bate dentro do ruído nas quatro
  linhas, então a projeção pros 14 re-sorteios é confiável.
  **POR QUE SUBIU:** a loja passou a COMPRAR itens de volta no mesmo dia (ver a seção **VENDER**), e
  isso transformou o Bônus Shiny da Elite e o Doce Raro da Torre em moeda. A 3 por re-sorteio, os
  400 moedas de um Bônus Shiny vendido viravam **133 re-sorteios**; a 5, viram **80**. O Doce Raro
  cai de 50 pra **30**.
  Se um dia precisar mexer de novo, os lugares são o **preço** (`MOEDAS_RESSORTEIO`), o **pagamento**
  (`MOEDAS_POR_GINASIO` e companhia) e a **fração da venda** (`VENDA_FRACAO`) — e o mais direto
  continua sendo o preço.
- O servidor **não sorteia a oferta** — ele só cobra. Quem sorteia é o cliente, com a semente dele:
  o servidor não conhece rota nem pool, e mandar a oferta de lá duplicaria as tabelas de encontro,
  que é justamente o que o projeto evita.
- `tools/fake-firestore.js` ganhou **`getAll` dentro da transação** por causa disto: o `Transaction`
  do Firestore tem, e sem ele qualquer função que leia dois documentos de uma vez morre com
  "tx.getAll is not a function" — erro do harness, não do código testado. Passa pela mesma trava de
  leitura-depois-de-escrita.

## HMs — a primeira Máquina Oculta (11/09/2026)

Começou pelo **HM01 (Corte)**, e por enquanto ele **só existe**: entra na mochila e não faz nada.
É de propósito — primeiro a porta, depois o que tem atrás dela. O plano é ele destravar uma terceira
rota por trecho, com cadeado visível; nada disso está implementado.

- **⚠️ O HM É DA CONTA, NÃO DO SAVE — mudou em 11/09/2026, a pedido.** Ele nasceu por save, e a
  razão registrada aqui era boa: a condição do HM01 é uma conquista DAQUELA jornada, e guardada na
  conta uma jornada de sorte apagaria o cadeado de todos os saves pra sempre. O pedido foi o
  contrário — *"depois que qualquer save conseguiu ele, ele fica permanentemente na conta do
  usuário"* — e a consequência é exatamente essa: **a condição virou um aro de UMA VEZ SÓ por
  conta**. Ganhou uma vez, todo save novo já nasce com ele.
  Ele mora em `users/{uid}.hms` e é gravado pelo **cliente**: não está na trava de campos do
  `firestore.rules`, que guarda os que dão poder de compra (`moedas`, `rareCandies`, `inventario`,
  `equipados`, `rerollsPorSave`). É o mesmo nível de confiança do `badgesEarned` — conquista, e
  livre pro dono.
  **⚠️ E ELE PRECISOU ENTRAR NO `CAMPOS_DA_CONTA`:** o `resetGame` tira um instantâneo desses campos
  e restaura depois, então um campo de conta que fique de fora dele **some ao abrir outro save** —
  em silêncio, e só pra quem tem mais de um. O teste lê o código pra cobrar isso.
  Com ele na conta, a tela de TMs e HMs deixou de ter o estado "abra um save pra ver os dele": a
  mochila aberta da home mostra os mesmos.
- **⚠️ O BOTÃO DA MOCHILA FICOU ESCONDIDO DE 12/09 A 13/09/2026** (a pedido: *"esconda o botão na
  mochila de tm/hm para todos"*), e **voltou a aparecer quando o HM01 passou a ENSINAR o Corte**:
  enquanto a tela era só uma vitrine — uma lista de uma linha que não fazia nada — ela não tinha
  por que existir; hoje ela é o **único caminho pra usar a Máquina**.
  Quem manda é o **`MOSTRAR_TM_HM`**, e ele é uma constante e não uma remoção porque o pedido foi
  "esconda", não "tire" — foi justamente isso que fez a volta custar **uma linha**. O teste LÊ a
  constante em vez de só procurar o botão, então no dia em que ela mudar de novo ele acompanha
  sozinho.
- **A LISTA É SÓ O NOME E UMA LEGENDA PEQUENA** (11/09/2026, a pedido). Ela tinha um parágrafo azul
  por baixo de cada Máquina dizendo que ela ainda não faz nada — com um item só na lista, a
  explicação ocupava mais espaço que a coisa explicada. O campo `descricao` saiu da tabela junto,
  em vez de virar dado morto, e o `resumo` ("Abre caminho onde a mata fecha.") caiu de .7rem
  (o `.mon-sub` da casa) pra **.55rem**: o nome é a informação, ele é a legenda.
- **A CONDIÇÃO DO HM01**: escolher a rota do **S.S. Anne** e vencer o **Lt. Surge em no máximo uma
  tentativa** (nenhuma derrota naquele ginásio).
  **As duas peças já existiam no jogo**, e é por isso que ela encaixou sem inventar nada: o
  `ss_anne` é uma das duas rotas do trecho 3, e o trecho 3 é justamente o do Surge. O teste cobra as
  duas — se qualquer uma mudar de lugar, o HM01 fica **inalcançável em silêncio**.
- **⚠️ A ORDEM DENTRO DO `finishBattle` É O QUE SUSTENTA A CONDIÇÃO.** O `game.losses` (derrotas
  naquele ginásio) só zera **depois**, na distribuição de níveis. Lida de lá, a condição acharia zero
  sempre e daria o HM a quem perdeu quatro vezes. O teste **lê o código** pra cobrar que o
  `conquistouHM01()` está no `finishBattle` e que o `game.losses = 0` **não** está — os casos chamam
  a função direto e passariam com a ordem trocada.
- **O `routeHistory` GANHOU O PRIMEIRO LEITOR DE REGRA.** Ele guarda a rota escolhida por trecho e
  este arquivo dizia "só o mapa lê" — agora a condição do HM01 depende dele. Se ele deixar de ser
  gravado, o HM01 some sem erro nenhum.
- **O ANÚNCIO sai do `ganhouHmAgora`**, marcado no `finishBattle` — não de "tem HM na mochila". A
  tela de vitória é relida a cada render, e sem a marca ela anunciaria o mesmo HM em toda vitória
  dali pra frente. Ele fica **ao lado do prêmio de moedas**: é a mesma leitura ("o que esta vitória
  me deu"), e um lugar novo faria o jogador procurar.
- **⚠️ A TELA DE TMs E HMs VIROU UMA PRATELEIRA DA MOCHILA EM 14/09/2026** — ver **A MOCHILA VIROU
  A LOJA**. Ela era separada porque TM e HM não cabiam na GRADE (não empilham, não se gastam, não
  se vendem, não se usam dali); com a grade fora e a lista mostrando NOME, a razão foi junto.
  O estado "diz onde achar" também saiu: hoje a prateleira vazia diz só **"Nenhum TM/HM"**.
- **⚠️ O GOLPE `cut` FOI CADASTRADO À MÃO EM 13/09/2026, e ele é o ÚNICO da tabela `GOLPES` que não
  veio do gerador.** A base é aprendizado por **NÍVEL** da Gen 3, e HM ninguém aprende por nível —
  o gerador nunca o viu (é o mesmo motivo do `surf`). Ele é **Normal, poder 50**, os valores da
  Gen 1/2/3. Sem ele o HM01 não teria o que ensinar.
  **⚠️ ELE NÃO ENTRA NO `GOLPES_IDS`, e isso é decisão:** aquele array é **indexado** pelo
  `APRENDIZADO` (as entradas são `[nível, índice]`), então inserir um id no meio deslocaria todos os
  índices seguintes e trocaria o moveset das 250 espécies **em silêncio**. Ele não precisa dele:
  ninguém o aprende por nível, e o campo `ataques` guarda o id em TEXTO.
  **⚠️ MAS ELE ENTRA NO BOLO DO METRÔNOMO** (`POOL_METRONOMO` é derivado do `GOLPES`), que foi de
  **155 pra 156** golpes. Isso desloca a semente do sorteio — esperado, e é o preço de o Metrônomo
  sortear "qualquer poder existente no jogo", que é o que ele promete.
- **⚠️ O `slash` VIROU "TALHO", porque o nome "Corte" era dele e passou pro dono certo.** Ele é
  Normal 70, um dos oito de crítico alto, e 22 espécies o aprendem — dois golpes escritos igual no
  log, um de poder 70 com crítico alto e outro de 50, seria indistinguível de defeito. "Talho" é o
  nome oficial dele em português. O nome é resolvido **na hora de desenhar**, então log velho só
  troca a palavra — e troca pra a palavra certa.

**MEDIDO — e o número muda a leitura da condição.** Ela tem três filtros em série:

| | |
|---|---|
| o trecho 3 ser **Kanto** (o outro lado é a Whitney) | o jogador escolhe |
| o **S.S. Anne** entre as duas rotas | o jogador escolhe |
| vencer o Surge **sem perder** | **1 game over em 1.500 jornadas** |

**O 3º ginásio é o menos letal da jornada inteira** — 1 game over contra 115 no 1º, 173 no 8º. Ou
seja, "vencer de primeira" é uma barra baixa: **a condição real é saber escolher a rota.** Ela é um
portão de CONHECIMENTO, não de dificuldade. Por acaso ela sai em ~25% das jornadas (50% × 50%); quem
sabe o caminho pega perto de 100%.
Se a intenção for que o HM01 seja uma prova, o Surge é o lugar errado — os candidatos seriam o 1º, o
6º ou o 8º ginásio. Ficou como pedido.

### A MÁQUINA ENSINA, E O CORTE É UM GOLPE DE VERDADE (13/09/2026)

Pedido em três passos, e o desenho mudou no meio do caminho. A primeira ideia foi **equipar** o HM
num pokémon, como a Poção; ela foi recusada: *"eu acho que o equipar como se fosse um item não é
legal, gosto de ser um item para ensinar um ataque como no jogo mesmo, e aí o cortar pode virar uma
habilidade passiva"*. O pedido final: *"quando o usuário entrar na mochila e clicar no item do HM01,
vai aparecer todos os pokémons que podem aprender o HM01 dentro dos saves dele. No pokémon que ele
clicar, vai abrir a tela para ensinar o cut e qual habilidade o pokémon vai perder"*.

- **⚠️ A DIFERENÇA ENTRE AS DUAS IDEIAS É GRANDE, e é ela que explica o resto.** Equipado, o HM
  seria mais um item com chave `slot:raiz` no armazém da conta, e "saber cortar" seria uma consulta
  ao `equipados`. **Ensinado, quem sabe cortar é o POKÉMON** — no campo `ataques` dele. Isso ganha
  três coisas de graça: o Corte **viaja no save** (o `ataques` já era serializado), ele **vale em
  TODA batalha** como golpe de verdade (Normal, 50), e a **Máquina não se gasta** — é da conta e
  ensina quantas vezes quiser, como no jogo original.
- **⚠️ E ELE ATRAVESSA SAVES.** A lista é de TODOS os saves da conta, porque a Máquina é da conta —
  ensinar só no save aberto faria a mochila da HOME (que é de onde ela é aberta na maior parte das
  vezes) não ter o que mostrar.
- **⚠️ A GRAVAÇÃO ESCREVE SÓ O `team`, NUNCA O ESTADO INTEIRO — e isso custou o defeito mais grave
  desta feature.** Reportado: *"eu tava na tela que apareceu a nova rota ... fui no Mochila e
  ensinei para ele, quando voltei para o save ... já tinha avançado o estágio do save ... pulou a
  etapa de eu escolher uma rota, capturar pokémons da rota, foi direto para enfrentar o ginásio"*.
  A primeira versão chamava `saveCurrentGame()` quando o alvo estava no save ABERTO — o que parecia
  o certo, porque ele grava o estado consistente e espera a confirmação do servidor. **Só que a
  mochila é aberta da HOME, e ir pra home NÃO descarrega o save:** o `game` continua com o time, o
  trecho, as cartas de rota e tudo o mais — só o `game.screen` muda. Então o `serializeGame()`
  gravava **`screen:'hmAlvo'` por cima da tela em que a jornada estava**, e o save voltava noutro
  ponto. Reproduzido no sandbox: save parado em `walkNext` (a escolha de rota) gravado como
  `hmAlvo`.
  Hoje os dois caminhos gravam a MESMA coisa — `{ team }` com `merge` — e nenhum toca em estado de
  tela. No save aberto isso é exato: o objeto mutado **é** o `game.team`, então o autosave seguinte
  já leva o golpe novo junto com o resto.
  **A REGRA QUE FICA: nada chamado de FORA da jornada pode gravar o estado da jornada.** Ela vale
  pra qualquer coisa que a home venha a fazer com um save — é o mesmo tipo de vazamento que o
  `game.escolhaDepois` já tinha tido, por outra porta.
- **⚠️ A TELA É POR TIME, EM DOIS NÍVEIS** (a pedido: *"não exiba pokémon por pokémon, exiba time
  por time, assim como fica na tela home, porém só exiba no card do time os pokémons que podem
  aprender o HM01, e quando clicar no time, aí sim abre a lista"*). A primeira versão era uma lista
  corrida de todos os saves — com 20 slots ela vira uma parede de dezenas de linhas em que a única
  pista de onde cada um mora é uma legenda pequena.
  **O card é o MESMO da home** (a estrela com a média e a fileira de sprites): é por ele que o
  jogador reconhece um time, e repetir a forma é o que evita reaprender a ler.
  **⚠️ A FILEIRA TRAZ O TIME INTEIRO desde 16/09/2026, com quem NÃO aprende APAGADO** (a pedido:
  *"mostre o card completo dos pokémons do time, porém só deixe com aspecto de ativo os pokémons que
  podem aprender o move"*).
  Ela trazia **só os candidatos** até aqui, e a razão registrada era boa — *"um card com seis
  sprites em que dois servem faria o jogador clicar pra descobrir quais"*. **O que mudou é que agora
  a tela DIZ quais:** o apagado resolve o mesmo problema sem esconder metade do time, e some com a
  pergunta *"cadê o resto?"* que a fileira curta criava.
  **⚠️ O APAGADO É O `.caiu` QUE JÁ EXISTE** — o mesmo do pokémon desmaiado na fileira do time e no
  log de batalha (`opacity:.35` + `grayscale(.5)`), que foi exatamente o que se pediu. Reusar a
  classe é melhor que criar uma segunda com as mesmas duas regras: o jogo já ensinou o olho a ler
  esse cinza como *"esse não entra"*, e duas classes iguais divergiriam no primeiro ajuste. O NOME
  fala de desmaio e aqui o motivo é outro — quem explica é o `title` de cada sprite.
  **⚠️ E ELE TEM DOIS MOTIVOS, que o título separa:** a espécie **não aprende**, ou o pokémon **já
  sabe** o golpe. Sem a distinção, quem acabou de ensinar veria o pokémon apagado sem entender por
  quê.
  **A média da estrela virou a do TIME**, pelo mesmo motivo de sempre: ela descreve o que está
  desenhado ali. Enquanto a fileira só trazia os candidatos, ela era a média DELES.
  **Save sem nenhum candidato continua NÃO virando card** — um time inteiro apagado na lista diria
  menos que não estar lá, e isso não mudou com o time inteiro na fileira. E **quando o último candidato de um time aprende, a tela volta sozinha pros
  times**, com o anúncio: uma lista vazia ali não diz nada que o anúncio na tela de cima não diga
  melhor.

- **⚠️ A FRASE DA TELA ENCURTOU (16/09/2026)**, pedida palavra por palavra: **"Ensine quantas vezes
  quiser. O ataque fica para sempre no Pokémon."** Ela era *"A Máquina não se gasta — dá pra ensinar
  o Corte a quantos pokémons quiser. Cada card mostra só quem pode aprender."*, e as duas metades
  tinham problema: a primeira explicava a **MECÂNICA** da Máquina ("não se gasta"), que é vocabulário
  de motor -- a nova diz o mesmo pelo que o jogador FAZ e acrescenta o que ele precisa saber pra
  decidir, que o golpe **não sai depois** (isso não estava escrito em lugar nenhum da tela, e é a
  parte irreversível da decisão); a segunda **descrevia a tela** ("cada card mostra só quem pode
  aprender") e deixou de ser verdade no MESMO pedido, porque o card passou a mostrar o time inteiro.
  **Frase que descreve o layout envelhece junto com ele.**
  Medido a 320px: ela cai em 3 linhas e o card do time fica em **114px** com os seis sprites.
- **⚠️ O TIME DE UM SLOT SAI DE DUAS FONTES, e escolher a errada mostra um time velho.** O
  `game.saveSlots` é uma cópia carregada na HOME; o `game.team` é o time VIVO do save aberto. Pro
  slot aberto a fonte é o `game.team` (`timeDoSlot`) — sem isso um pokémon capturado nesta sessão
  não apareceria, e pior: os **ÍNDICES** das duas listas deixariam de bater e o Corte iria parar no
  pokémon ERRADO.
- **QUEM TEM VAGA APRENDE SEM PERGUNTAR** (menos de `MAX_GOLPES`): não há o que trocar, e a tela
  seria uma pergunta de uma resposta só. É a MESMA regra da fila de aprendizado por nível.
- **⚠️ O GOLPE RETIRADO É RECUSADO** (`ataquesRecusados`), exatamente como na tela de troca por
  nível. Sem isso ele voltaria pela fila de aprendizado no próximo nível — e voltaria pra sempre,
  que é o **carrossel infinito de 09/09/2026**. Golpe esquecido não volta sozinho.
- **⚠️ MAS O GOLPE DE MÁQUINA NÃO SE DESAPRENDE** (`ehGolpeDeMaquina`). Reportado: *"o HM01 não pode
  ser desaprendido, acabei de ensinar para um Persian, e depois ele aprendeu Talho e eu consegui
  tirar o corte"*. É assim no jogo original — HM é permanente —, e **aqui ele é mais que um golpe:
  é a CHAVE da Mata Fechada**. Perdê-lo sem querer numa tela de troca fecharia a rota de novo, e o
  jogador não teria como ligar uma coisa à outra.
  **Era pela tela de aprendizado por NÍVEL que ele se perdia** — o Persian aprende Talho no 50 e a
  tela oferecia trocar justamente o HM. Hoje ele não entra na lista, e a tela **diz por quê** (sem
  a frase, um golpe some da lista sem explicação e isso se lê como bug).
  **Quem valida é a AÇÃO**, não a tela: `responderAprendizado` recusa o golpe de Máquina mesmo que
  o clique venha forjado — a mesma regra do `confirmarAtaques` e do `chooseRoute`.
  **A lista sai dos próprios HMs**, não é o `cut` escrito à mão: o HM02 nasce protegido sozinho.
- **⚠️ E A REGRA PRECISOU DE UM LUGAR SÓ (`ataquesTrocaveis`), porque ela tem TRÊS leitores e um
  deles não é a tela.** Escrita dentro do render, ela travou o jogo: o **bot do smoke lê o ESTADO**
  — ele escolhia o golpe mais fraco de `p.ataques`, caía no Corte (poder 50, o mais fraco de um time
  maduro), a ação recusava em silêncio e a jornada **parava naquela tela até o `MAX_STEPS`**.
  **72 falhas em 100 jornadas**, e nenhuma delas existia antes da guarda.
  Hoje a TELA, a AÇÃO e o BOT leem a mesma função. **Regra que só a tela aplica é regra que o resto
  do jogo não enxerga** — e o preço disso aqui foi o carrossel infinito de 09/09/2026 voltando por
  uma porta nova.
- **A TELA DA TROCA reusa os MESMOS blocos das três telas de golpe** (o `golpe-cab` e o
  `cartaoDeGolpe`): ela conta a mesma coisa que a tela de aprendizado por nível, e um formato
  próprio obrigaria a reaprender a ler no meio da decisão.
- **A linha da Máquina na mochila virou botão**, e ela **não usa o `.btn` da casa** — aquele é botão
  de AÇÃO, com moldura de 3px; aqui a lista é de Máquinas que por acaso se tocam, o mesmo raciocínio
  que já tinha tirado o `.btn` dos cartões de golpe e das linhas da ficha da Pokédex. O **`ⓘ`** do
  fim é o que diz que há o que fazer: sem ele a linha se lê como as listas estáticas do jogo.

**⚠️ OS 72 CORTADORES, e a lista NÃO foi escrita de cabeça.** Ela saiu do `learnsets.ts` do Pokémon
Showdown pela tag de MÁQUINA da Gen 3 (**`3M`**) — a mesma geração da base de golpes do jogo, e o
mesmo caminho que gerou o `GOLPES_CRIT_ALTO` e as listas de golpe especial.
**⚠️ ATENÇÃO À FONTE:** as tags `1M` e `2M` dão **ZERO** nas 250 do jogo, porque o arquivo do
Showdown é podado e só traz da Gen 3 pra frente — exatamente a armadilha que a seção da base de
golpes já registra. Quem for refazer a lista tem que usar a `3M`.

A intuição erra três vezes:

| | |
|---|---|
| **cinco dos sete iniciais cortam** | Bulbasaur, Charmander, Chikorita, Cyndaquil, Totodile |
| **a linha do Squirtle e o Pichu NÃO** | e são justamente os dois que "pareceriam" cortar |
| **os quatro lendários da lista ficam** | Raikou, Entei, Suicune e Celebi — é o que o dado diz, a mesma decisão do Lugia no `RECUPERACAO` e no `REMOINHO`. O Celebi é INTOCÁVEL, então a entrada dele não roda hoje |

### O HM02 (VOAR): O PRIMEIRO QUE COBRA COMO O TIME FOI MONTADO (16/09/2026)

Pedido assim: *"implemente o HM02, Fly, para um treinador obter ele, ele tem que vencer a oitava
insígnia usando os 6 pokemons sendo voadores, pode ter mais tipo além do voador, como por exemplo o
Charizard que é Fogo e Voador, porém todos os 6 devem ter o selo de voador"*.

**Os três HMs cobram coisas de naturezas diferentes**, e é isso que faz eles não se parecerem: o
**HM01** cobra uma ROTA e uma vitória limpa, o **HM03** cobra uma COLEÇÃO (as 17 da Zona de Safári),
e este cobra **COMO você montou o time**. É também o único que dá pra perder sem perceber — trocando
um pokémon antes do último ginásio.

- **O GOLPE: Voador, poder 70** — o número da **Gen 3**, conferido pela cadeia de mods 8→3, o mesmo
  caminho do `cut` (50) e do `surf` (95). Entra no `GOLPES` e no `GOLPES_PT` **dos dois motores**,
  no `A_MAO` do gerador e no `golpes-pt.json`, e fica **fora do `GOLPES_IDS`**.
  **O `POOL_METRONOMO` foi de 157 pra 158**, como nos outros dois.
- **⚠️ A CONDIÇÃO É SOBRE O TIME, não sobre quem lutou.** O pedido é *"usando os 6 pokémons"*, e num
  ginásio o time inteiro está em jogo mesmo que a luta acabe no terceiro confronto.
- **⚠️ E ELA NÃO OLHA A LISTA DE QUEM APRENDE** (confirmado a pedido: *"independente se essas 6 podem
  aprender o Fly ou não"*). São duas perguntas diferentes e elas não se encostam: a **condição**
  pergunta o TIPO do time, a **lista** pergunta o que a ESPÉCIE aprende.
  **Seis voadores em que NENHUM aprende o Voar ganham o HM do mesmo jeito** — e aí ele fica na
  mochila esperando um pokémon que saiba usá-lo. O caso extremo existe de verdade e está trancado no
  teste: Gyarados, Scyther, Butterfree, Gligar, Mantine e Golbat voam e nenhum aprende.
- **⚠️ SEIS, e não "todos os que tiver".** Levar três voadores não é a mesma proeza — é o que a
  palavra *"os 6"* diz, e é o que faz dela um desafio.
- **⚠️ E O TIPO SAI DA INSTÂNCIA (`p.types`), não da espécie:** é ele que o `tryEvolve` atualiza e é
  ele que a tela DESENHA no selo. Lido da espécie, um save cujo campo ficou pra trás discordaria da
  tela — e a regra é literalmente *"todos com o selo de Voador"*. Sem o campo, cai na espécie.
  O segundo tipo é livre, que é o pedido ao pé da letra: o Charizard (Fogo/Voador) entra.

**⚠️ ELE É ALCANÇÁVEL, E ISSO FOI MEDIDO ANTES DE ESCREVER A CONDIÇÃO** — HM impossível é o pior
defeito que existe, e este projeto já teve um (o desafio do Mewtwo, impossível por semanas por causa
do Celebi).

| | |
|---|---|
| jornadas que chegam aos **seis voadores** | **76,3%** |
| idem **sem contar o inicial** (quem não escolheu Charmander) | 53,0% |
| trechos que oferecem voador | **8 de 8** |
| linhas evolutivas voadoras em rota | 19 |

(600 jornadas simuladas, com o jogador escolhendo sempre a rota que mais oferece voador e pegando
2 por trecho — que é o que alguém caçando o HM faria.)

**E um time desses GANHA o 8º ginásio** (600 batalhas por lado, time de seis voadores Lv.58):
**72,8%** contra o Giovanni e **67,2%** contra a Clair. Faz sentido que o de Kanto seja mais fácil —
Voador é **imune** a Terra, e o time do Giovanni é quase todo de Terra.

**OS 24 QUE APRENDEM saíram da tag de MÁQUINA da Gen 3 (`3M`)**, o MESMO caminho dos 72 cortadores e
dos 65 surfistas — e o método foi conferido de novo rodando o extrator pro `cut` e pro `surf`:
devolve **exatamente 72 e 65**, sem uma divergência.

**⚠️ TODO MUNDO QUE APRENDE VOAR É VOADOR, MAS O CONTRÁRIO NÃO VALE — e a diferença é grande: 14
voadores não aprendem.** Gyarados, Scyther, Butterfree, Gligar, Mantine, Natu, Yanma, a linha do
Hoppip, Ledyba/Ledian, e — o detalhe que só o dado sabe — **Zubat e Golbat não, mas o Crobat sim**.
Ou seja, **dá pra ganhar o HM02 com um time em que metade não consegue usá-lo**, e está certo: a
CONDIÇÃO é sobre o time, a lista é sobre a espécie.
O Lugia e o Ho-Oh ficam por ser o que o dado diz, como no `RECUPERACAO` e no `REMOINHO`: os dois são
INTOCÁVEIS e a entrada não roda hoje.

- **⚠️ OS HMs DE VITÓRIA VIRARAM UMA TABELA** (`HM_DA_VITORIA`) — o comentário do `finishBattle` já
  previa isto por escrito: *"o `ganhouHmAgora` guarda o ID, não um booleano, porque o próximo HM vai
  passar por esta mesma linha"*. Hoje o próximo é uma linha na lista.
  **SÓ UM É ANUNCIADO POR VITÓRIA, e isso é seguro por construção:** o HM01 se decide no 3º ginásio
  e o HM02 no 8º, então eles não podem cair na mesma luta. Há trava cobrando que as duas condições
  **nunca valham no mesmo ginásio** — se um dia valerem, é ali que se decide o que fazer.
- **⚠️ E A LISTA TEVE QUE IR PRO SERVIDOR TAMBÉM**, e isso quase passou: o `APRENDEM_HM` do
  `golpesValidos` é quem deixa um golpe de HM sobreviver na liga e no online (HM ninguém aprende por
  nível, então o `APRENDIZADO` não o conhece). Sem a entrada, **quem ensinasse Voar perderia o golpe
  em toda partida de liga, em silêncio**. Conferido no ato: `golpesValidos('charizard', 70, ['fly'])`
  devolvia lista vazia.
  Hoje há trava varrendo o `HMS` e cobrando que **todo HM do jogo tenha entrada na tabela do
  servidor** — o próximo nasce coberto.
- A trava do `A_MAO` pegou o `fly` sozinha, que é exatamente o que ela foi escrita pra fazer: ela
  **varre o `HMS`** em vez de nomear os golpes.

`tools/test-inventario.js` tranca 29 pontas: o golpe (Voador/70, o nome PT, fora do `GOLPES_IDS`,
não se desaprende), a lista (24, todas voadoras, o Crobat sim e o Golbat não, os 14 que voam sem
aprender), a condição (os seis, o segundo tipo livre, um não-voador derrubando, cinco não bastando,
só no 8º ginásio, o tipo vindo da instância), o gancho da vitória com o HM01 ainda saindo por ele, o
não-cruzamento das condições, e — a mais importante — que **existe voador pra capturar nos 8
trechos**, que é o que sustenta os 76,3%.

#### ⚠️ E ELE DESENTERROU UM FLAKE DA RAIDE, que não era dele

`tools/test-boss.js` falhava **2 em 12 rodadas**, com quatro travas caindo juntas. **Não era o
`fly`** — medido, falhava igual sem ele.

A causa é a pendência que a seção do golpe moribundo já registra: **desde 15/09/2026 uma investida
tira ~12,5 de dano relativo em vez de ~40,5**, porque o Mew é mais rápido que o time inteiro e mata
cada um numa troca — quase todo o dano vinha do **revide de quem caía**.

O teste desbastava a vida do Mew até `hp > 250` e então mandava N investidas simultâneas, supondo
que **uma** tirava mais que 250. Não tira mais: o Mew sobrevivia, e as quatro travas do "fio de
vida" caíam juntas.

**⚠️ O ALVO CERTO É `N × a MENOR investida`, e isso custou TRÊS tentativas — as duas grandezas em
jogo são OPOSTAS:**

| tentativa | o que quebrou |
|---|---|
| parar quando a vida cabe na **MAIOR** investida | a leva não derruba quando todas as N saem fracas — 2/12 virou **1/37**, ainda flake |
| parar na **MENOR** | o próprio laço **MATA** o Mew, e a leva estoura com *"O Mew já foi derrotado"* |
| **escrever o HP** direto (determinístico!) | quebra a trava do fim, que cobra que a soma das **contribuições** bate com o `maxHp` — ou seja, que tudo que saiu do Mew foi creditado a alguém. Pular 25 mil de vida escrevendo o campo quebra exatamente essa conta |

`N × menorDano` satisfaz as duas: ele é **maior que a maior investida já vista** (10 × 13 = 130
contra 68), então o laço nunca mata; e é o **piso** do que N investidas somam, então a leva derruba.

E o laço **não pode esperar que toda volta machuque**: uma investida pode sair com dano ZERO, então
ele guarda o menor dano **não nulo** e tem teto de voltas — sem o teto, uma raide mal calibrada
travaria o teste em vez de acusar.

**⚠️ E O MESMO DANO ZERO DERRUBAVA OUTRA TRAVA, num bloco que nem é sobre isso:** o `tester2` atacava
uma vez, tirava zero, e a trava do *"cada jogador tem o dano dele"* caía lá embaixo — ~1 rodada em
25. Ele passou a **atacar até machucar**, com teto.

Medido depois de tudo: **0 falhas em 25 rodadas**, contra 2 em 12 no começo.

**O que isto NÃO conserta é a raide**, que continua descalibrada e por isso **DESLIGADA**
(`BOSS_ATIVO`). Recalibrar é mexer no nível do Mew ou no `BOSS_MAX_HP`, e exige apagar
`globalBoss/mew`, `globalBoss/mewRank` e a subcoleção `players` — o `maxHp` fica gravado no
documento e o dano acumulado está na escala antiga.

### O HM03 (SURF): O PRIMEIRO HM QUE NÃO VEM DE UMA BATALHA (15/09/2026)

Pedido assim: *"quando um usuário conseguir capturar TODOS os pokemons da rota da Zona Safári, ele
vai ganhar o HM03, o Surf. Mesmo coisa que o HM01, ele fica na conta, e nao no save, e ao ensinar
para algum pokemon, esse movimento nao pode mais ser retirado."*

- **QUASE TUDO SAIU DE GRAÇA, e isso é o que a estrutura do HM01 comprou.** "Ficar na conta" já é o
  `game.hms` (com o `CAMPOS_DA_CONTA`), "não pode ser retirado" já é o `ehGolpeDeMaquina` — que
  **varre o `HMS`** em vez de nomear o `cut`, então o HM03 nasceu protegido sem uma linha. A tela de
  ensinar, a prateleira da mochila e o `abrirEnsinarHm` também já eram genéricos pelo `hmId`.
- **⚠️ MAS TRÊS COISAS ESTAVAM AMARRADAS AO CORTE, e as três teriam oferecido o SURF aos 72
  CORTADORES.** O `podeAprenderCorte` era chamado direto pelas **três portas** da tela (a lista de
  candidatos, a escolha do alvo e o próprio ensinar) e lia o `CORTADORES` escrito à mão.
  Hoje a lista vive **DENTRO do item** (`hm.aprendem`) e quem responde é o `podeAprenderHM(hmId,
  speciesId)`. O próximo HM já nasce perguntando a lista certa.
  A **frase** da tela também citava "72 espécies que aprendem o Corte" com o nome na mão — ela sai do
  `hm.aprendem` e do `hm.golpe` agora, e os exemplos são um campo do item.
- **O GOLPE: Água, poder 95** — o número da **Gen 3**, que é a geração da base deste jogo. O moderno
  é 90, e é o mod `gen5` do Showdown que devolve o 95; fixado no teste pelo mesmo motivo que o Tackle
  35/95 é fixado. Ele entra no `GOLPES` e no `GOLPES_PT` **dos dois motores** e no `A_MAO` do gerador
  (ver a seção da base de golpes), e fica **fora do `GOLPES_IDS`**.
  **⚠️ E ELE DESLOCA A SEMENTE DO METRÔNOMO:** o `POOL_METRONOMO` é derivado do `GOLPES` e foi de
  **156 pra 157**. É o mesmo preço que o `cut` já tinha cobrado, e é o que o Metrônomo promete
  ("qualquer poder existente no jogo").

**OS 65 SURFISTAS saíram da tag de MÁQUINA da Gen 3 (`3M`) do `learnsets.ts` do Showdown**, o MESMO
caminho dos 72 cortadores — e **o método foi conferido reproduzindo os 72 sem uma divergência**, que
é o que dá confiança na lista nova. A intuição erra três vezes:

| | |
|---|---|
| **o Squirtle surfa** | e ele é justamente o inicial que **NÃO corta** |
| **o Totodile faz as duas** | e é o único inicial nas duas listas |
| **Snorlax, Tauros e Lickitung surfam** | nenhum dos três é de Água |

O **Lugia** e o **Suicune** ficam, porque é o que o dado diz — a mesma decisão do Lugia no
`RECUPERACAO` e no `REMOINHO`, e dos quatro lendários do `CORTADORES`. O Lugia é INTOCÁVEL, então a
entrada dele não roda hoje.

**A CONDIÇÃO: as 17 formas PRÓPRIAS da Zona de Safári, na Pokédex DA CONTA.**

- **Ela lê a Pokédex permanente, não o save** — o HM é da conta, então a captura conta por conta: dá
  pra juntar as 17 em **várias jornadas**, que é o que o texto do `comoGanhar` promete. O
  `caughtSpecies` do save aberto conta junto, porque é o que ainda não sincronizou.
- **⚠️ SÃO 17 E NÃO 24, e a diferença são as pré-evoluções de inicial.** A tela "Pokémons desta rota"
  mostra **24**; sete delas (Ivysaur, Charmeleon, Wartortle, Bayleef, Quilava, Croconaw e o Pikachu)
  são o **evento do trecho 5**, caem em QUALQUER rota daquele trecho e **o sorteio nunca dá a do
  PRÓPRIO inicial** — exigi-las faria a condição depender de o jogador ter jogado com outro inicial,
  que é uma regra que ninguém adivinharia lendo *"todos os pokémon da rota"*.
  A TELA continua mostrando as 24, porque ali a pergunta é outra: **o que dá pra capturar aqui**.
- **⚠️ A ROTA E O TRECHO TÊM QUE EXISTIR**, e o teste cobra os dois: se qualquer um mudar de lugar, a
  condição para de fechar **em silêncio** e o HM03 fica inalcançável. É o mesmo par que o HM01 já
  cobra (o S.S. Anne e o Lt. Surge).
- **NADA NO JOGO ANUNCIA A CONDIÇÃO ANTES, e é decisão** — a mesma do HM01, cuja prateleira vazia
  deixou de contar o caminho ("a tela não entrega de graça um achado que a jornada devia entregar").
  Quem quiser acompanhar tem a tela **"Pokémons desta rota"** da Zona de Safári, que já marca com o
  ícone da Pokédex quem você tem.

**⚠️ E ELE PRECISOU DE UM AVISO PRÓPRIO, porque é o primeiro que não sai de uma batalha.** O do HM01
é o `ganhouHmAgora`, lido pela tela de **VITÓRIA** — e ele funciona porque o HM01 sai de uma vitória.
Este sai de uma **CAPTURA**, e pode sair até do **carregamento da conta**: não há uma tela pra pegar
carona. O modal é **anexado ao render principal** (como a caixa que explica o especial), então ele
aparece venha de onde vier, e o **convite online fica por cima dele** — aquele tem 15 segundos de
prazo.

- **SÃO DOIS PONTOS DE CONFERÊNCIA, e os dois são necessários:**
  - depois de uma **captura** (`confirmWild`), que é quando a condição pode virar verdadeira — e
    **DEPOIS do laço**, não dentro: quem fecha a Zona de Safári pode fechá-la com os DOIS pokémon da
    mesma oferta, e conferir por captura anunciaria no meio da leva;
  - no **carregamento da conta** (`loadPermanentUserData`), pra quem já tinha as 17 antes desta
    feature — sem ele teria que capturar tudo de novo, e não dá: a Pokédex não esquece. É a mesma
    ideia do `repararEvolucoesAtrasadas`. Ele vem **depois** de a Pokédex e o `game.hms` entrarem,
    senão leria uma Pokédex vazia.
- **⚠️ O `hmGanhoModal` ESTÁ NO `CAMPOS_DA_CONTA`, e isso não é enfeite:** o HM03 pode ser dado no
  carregamento, com o jogador na home — sem o campo lá, abrir um save apagaria a marca e **o aviso
  não voltaria NUNCA**, porque o `conferirHM03` vê o `temHM` e vai embora. Ele fica **fora do
  `serializeGame`** (que é uma lista de permissão): é estado de tela, não vai pro banco.

**O QUE O SURF VALE, MEDIDO** (1x1 contra um painel de 8, nível 50 dos dois lados, o HM trocando o
golpe mais fraco do moveset — que é o que o jogador faria):

| | sem | com | |
|---|---|---|---|
| **Dragonite** | 45,5% | **71,0%** | **+25,6** |
| **Lickitung** | 3,9% | 25,6% | +21,7 |
| **Snorlax** | 31,1% | 52,3% | +21,2 |
| Feraligatr | 48,0% | 64,1% | +16,1 |
| Blastoise | 48,8% | 64,7% | +16,0 |
| Tauros | 37,3% | 50,0% | +12,7 |
| Starmie | 66,3% | 72,6% | +6,3 |
| Kangaskhan | 41,3% | 45,2% | +3,9 |
| Lapras | 71,4% | 71,4% | 0,0 |
| **Gyarados** | 90,2% | **78,4%** | **−11,9** |

**⚠️ ELE PODE CUSTAR, E O GYARADOS É O CASO — a razão é o SLOT, não o poder.** São três golpes só
(`MAX_GOLPES`), e o Gyarados larga o **Salto (Voador 85)** pra levar um SEGUNDO golpe de Água ao lado
da Hidro Bomba (120): ele perde **cobertura de tipo** e ganha nada. A Lapras larga o Golpe de Corpo e
fica igual, pelo mesmo motivo. Quem mais ganha é justamente quem tinha **arsenal fraco** — o
Lickitung e o Dragonite estavam com o **Enrolar, poder 15**.
É o mesmo desenho do Ditto e do Smeargle, com uma diferença que vale dizer: aqui **a troca é do
jogador**, e a tela de ensinar mostra o poder de cada candidato justamente pra ele fazer essa conta.

**O PREÇO NA JORNADA: nada. 56,58% contra 57,17% de conclusão** — **+0,58 ponto, 0,8σ** (6 blocos de
800 jornadas de cada lado, **4.800 de cada**, o MESMO bot contra os dois builds pelo `--html`, com o
desvio tirado de ENTRE os blocos e **4 de 6** blocos pro lado do HM03). Ruído puro, e por construção:
**o bot nunca ensina HM**, então a única diferença que a jornada enxerga é o deslocamento da semente
do Metrônomo. O que a feature vale de verdade está na tabela acima.

- **Ele NÃO destrava rota nenhuma por enquanto**, e é o mesmo desenho do HM01 no primeiro dia:
  primeiro a porta, depois o que tem atrás dela. O golpe existe, se ensina e vale em batalha.
- **O NPC nunca ganha o Surf**: o `equiparNpc` dá o moveset por NÍVEL, e HM ninguém aprende por
  nível. Um Blastoise de líder batendo de Surf seria golpe que ele não tem — e há trava pra isso.
- **Medido a 320px, no navegador:** o modal do achado fica em **265×334px** (cabe sem rolagem numa
  tela de 568), a lista de times em **568px**, a lista de pokémon do time em **700px**, a tela de
  troca em **665px** e a prateleira TMs/HMs com os dois em **780px** — nenhuma rola pro lado.
- `tools/test-inventario.js` tranca o conjunto: o golpe (Água/95, o nome PT, fora do `GOLPES_IDS`),
  a lista (65, todas no `SPECIES`, as três surpresas, os lendários), a lista vindo **do item** e não
  de um `if` com o id na mão, a condição (17 formas, as 24 da tela, as 7 dispensadas, a rota e o
  trecho), o HM ser **da conta** (faltando uma não ganha; dez da conta mais sete do save fecham), o
  modal (abre, nomeia, fecha, e o convite por cima), os **dois** pontos de conferência com a ORDEM de
  cada um, e ensinar + não poder tirar. Conferido que ele acusa com cada defeito religado — 8 falhas
  com o `podeAprenderHM` ignorando o HM, 2 sem o `conferirHM03` na captura, 2 sem o modal no render e
  1 sem o `hmGanhoModal` no `CAMPOS_DA_CONTA`.

### A MATA FECHADA: A TERCEIRA ROTA (13/09/2026)

Pedida assim: *"na jornada, coloque aleatoriamente a partir do trecho 4, que pode exibir alguma nova
rota ao invés das 2 que já tem por padrão, pode aparecer 3, essa nova rota o treinador só pode
acessar caso tenha um pokémon equipado com o Cut"*.

- **A partir do TRECHO 4** (`ROTA_DO_CORTE_A_PARTIR_DE = 3`) e em **1 de cada 4** trechos
  (`CHANCE_ROTA_DO_CORTE = 0,25`). Em cinco trechos elegíveis isso dá **~75% de chance de ver a mata
  pelo menos uma vez** numa jornada — medido, 74,8%. Rara o bastante pra ser um achado, comum o
  bastante pra existir.
- **⚠️ O SORTEIO É SEMEADO PELO SAVE**, como o do encontro selvagem, e pelo mesmo motivo: com
  `Math.random` bastaria sair do save e voltar até a mata aparecer. A semente carrega o slot, a
  **GERAÇÃO** do slot (senão recriar no mesmo slot repetiria a jornada) e o trecho.
- **⚠️ E O CADEADO É CALCULADO NO DESENHO, nunca gravado no estado — e isso é o pedido ao pé da
  letra:** *"caso o treinador esteja nessa tela e não possui um pokémon que tem o cut, e então ele
  sai da tela, vai pro home, pra mochila e ensina para o pokémon do time dele e volta para o save,
  deve habilitar a rota"*. Com a trava gravada, voltar da mochila encontraria o cadeado do jeito que
  ele estava. Lida no render, ela responde à pergunta certa: **este time, AGORA, sabe cortar?**
  O sorteio **não olha o time**: a mata aparece independente de o treinador saber cortar — quem
  decide se dá pra ENTRAR é o desenho, e é isso que faz a mecânica funcionar.
- **A tela NOMEIA quem abre o caminho** (*"🪓 Venusaur abre caminho"*): um cadeado aberto que não diz
  quem o abriu faz o jogador conferir o time golpe a golpe pra ter certeza. Trancado, ela diz o que
  falta.
- **Quem VALIDA é a ação, não a tela** (`chooseRoute` recusa a rota trancada): o card apagado é
  apresentação — a mesma regra do `confirmarAtaques` e do `toggleRelease`.
- **⚠️ AS CARTAS DE ROTA SÃO MONTADAS EM TRÊS PONTOS** (a saída do laboratório, a escolha de ginásio
  e a auto-recuperação de save antigo), e por isso a soma vive numa função só (`cartasDeRota`): três
  cópias fariam a mata aparecer em dois deles e sumir no terceiro.
- **⚠️ ELA NÃO TEM POOL, e por isso não é uma rota como as outras**: escolhê-la NÃO leva ao encontro
  selvagem. O pokémon do trecho, ali, se ganha lutando.

### O ROLAMENTO DOBRA A CADA USO SEGUIDO (14/09/2026)

Pedido assim: *"ajustar o movimento Rollout, dobrar o poder a cada uso, depois de 5x usados
consecutivamente, reseta o poder para 30 novamente, caso use outro ataque sem ser o Rollout, reseta
também"*. É o **primeiro golpe do jogo cujo poder depende do que aconteceu nas trocas anteriores** —
até aqui o poder era um número fixo da tabela, e o único que variava era o de vários tapas (que
varia por SORTEIO, não por histórico).

- **30 → 60 → 120 → 240 → 480, e o 6º uso volta pra 30** (`ROLAMENTO_USOS = 5`). O contador vive na
  INSTÂNCIA e começa com `_`, então não vai pro Firestore — e é solto no fim da batalha junto com os
  outros marcadores: sem isso um Golem sairia da luta com 480 guardado e a batalha seguinte começaria
  com ele. É o mesmo cuidado que o teto de HP da Fúria já tinha custado.
- **A ESCALA ENTRA NOS DOIS LADOS** — o `poder` (que vira o dano) e a `nota` (que decide a escolha).
  Só no dano, o motor escolheria um Rolamento de 30 e aplicaria um de 480: é a lição do
  `EXPOENTE_TIPO` e a da chuva.
- **O CONTADOR ANDA NO `golpesDaTroca`, não no `calcDamage`** — este é o único ponto que roda uma vez
  por ATAQUE. No `calcDamage` ele contaria uma vez por TAPA, e um golpe de vários tapas daria cinco
  usos num ataque só.

**⚠️ E ELE ACHATAVA NO LOG, porque a suavização de 12/09 existe pra impedir exatamente o que ele
faz.** Aquela regra reparte dois golpes do mesmo atacante quando a razão passa de 1,176×, porque *"o
mesmo golpe contra o mesmo alvo só difere pelo sorteio de 0,85 a 1,00"* — e o Rolamento é a **primeira
exceção real** a isso. Medido: a barra caía 30 e 60 e o log dizia **82 e 72**.
A escala passou a viajar por linha (campo `rl`) e entra como **PESO na suavização**, exatamente como
o crítico pesa 2. Duas travas do teste tiveram que aprender a mesma coisa (elas comparavam dano cru).

**⚠️ E O CONFRONTO COM ROLAMENTO SAÍA DO `TETO_GOLPES`, que era a MESMA exceção do sono** (história
desde 15/09/2026 — hoje NENHUM confronto com diário é cortado; ver **O TETO ACABOU**). A
reconstrução não conhece escala nenhuma — ela interpola HP e devolve golpes inventados, todos do
mesmo tamanho. Medido: a escala só chegava na tela em **31,6%** dos confrontos com Rolamento; nos
outros 68% o jogador via o mesmo nome com números lisos e a mecânica ficava invisível.
O preço é pequeno porque o caso é raro: 7,9% dos confrontos, e neles a tela vai de 2,7 pra 5,5
linhas — **+0,22 linha na média de todos**.

- **O SELO DIZ `×2`, `×4`, e não `2x`**: o `Nx` já quer dizer "bateu N vezes" nos golpes de vários
  tapas, e um Rolamento "2x" se leria como dois tapas. Aqui o que dobrou foi o PODER. O `×1` não sai:
  no primeiro uso não há o que explicar.

**⚠️ O NÚMERO QUE IMPORTA, E ELE É DESCONFORTÁVEL: na prática QUASE NINGUÉM O USA.** O motor escolhe
pelo DANO, e 30 de poder perde pra qualquer alternativa no PRIMEIRO uso — que é o único que conta pra
decisão. Dos 14 que aprendem, 4 o levam no moveset padrão, e medido no nível 50 contra um painel de 8:

| espécie | leva | usa | o que ele vale |
|---|---|---|---|
| Graveler, Golem, Donphan, Dunsparce | sim | **0,0%** | nada — eles têm Terremoto (100) e Derrubada (90) |
| **Shuckle** | sim | **8,8%** (sequências de até 5) | **+12,1 pontos** de vitória (7,8% → 20,0%) |

É **a mesma armadilha da Fúria**, que "implementada ao pé da letra nunca saía: 0,0% dos confrontos".
A diferença é que aqui ela não é total — quem não tem nada melhor o usa, e pra esse ele é enorme.

**⚠️ E A SAÍDA ÓBVIA FOI MEDIDA E É PIOR.** O precedente da casa é o `poderEfetivo` dos multi-tapas,
criado justamente porque *"o seletor compara PODER, e o tapa vale 15 — perde pra qualquer coisa"*.
Aplicando a mesma ideia (a nota olhar a MÉDIA da sequência, 186), o Rolamento passa a ser escolhido em
60% a 97% dos ataques — **e custa vitória em todos**:

| | usa hoje | vitória hoje | usa investindo | vitória investindo |
|---|---|---|---|---|
| Golem | 0,0% | 56,4% | 59,2% | **48,5%** (−7,9) |
| Donphan | 0,0% | 62,5% | 66,2% | **44,5%** (−18,0) |
| Dunsparce | 0,0% | 18,8% | 79,9% | **10,2%** (−8,6) |
| Shuckle | 8,8% | 19,7% | 97,5% | **11,8%** (−7,9) |

A causa é direta: o motor largaria um Terremoto de 100 por um golpe que começa em 30, e **a sequência
raramente chega ao 4º uso** — o confronto acaba antes. **O motor está certo em recusar.**
Se um dia se quiser vê-lo mais, a alavanca honesta é o **poder base** (30 é muito baixo pra um golpe
que precisa sobreviver a um primeiro uso) ou a **velocidade da escala**, não a nota.

### O SINO CURATIVO (Heal Bell) — 14/09/2026

Pedido assim: *"adicionar a habilidade passiva Heal Bell da Miltank e Celebi, tendo a mesma mecânica
que o RECOVER do Alakazam"*. Ele cai no **mesmo ramo `cura`** do Recuperar: abre o confronto, só vale
abaixo de `CURA_MAXIMO_DO_HP`, e é `continue` — a luta acontece inteira depois.

- **REUSA A MECÂNICA INTEIRA** em vez de nascer como efeito novo: a caixa da ficha é indexada pelo
  EFEITO e não pelo nome (ver **A CAIXA QUE EXPLICA O ESPECIAL**), então o texto veio de graça. O que
  muda é o nome que a ficha e o log mostram.
- **⚠️ O CELEBI JÁ ESTÁ NO `RECUPERACAO`, e o Recuperar vem ANTES na fila**: ele cura com "Recuperar"
  em 10% e o Sino sai na chance composta (9%). Na prática isso não roda — ele é INTOCÁVEL e ninguém o
  captura —, e a entrada fica porque é o que foi pedido e o que o jogo original diz. **Quem aparece
  de verdade é a MILTANK**, que não tem outro especial e cura nos 10% cheios.
- Tipo **Normal**, como no jogo oficial.

**O PREÇO DOS DOIS JUNTOS, NA JORNADA: dentro do ruído.** 57,88% sem contra **58,99%** com —
**+1,12 ponto, 1,8σ** (16 blocos de 800 jornadas de cada lado, **12.800 de cada**, desvio tirado de
ENTRE os blocos, 10 de 16 blocos pro lado fácil). Faz sentido: o Rolamento é usado por uma espécie e o
Sino por outra, e as duas caem dos dois lados da luta.

### O GOLPE MORIBUNDO ACABOU (15/09/2026)

Pedido assim: *"esse negócio de golpe moribundo eu queria acabar com ele, vamos acabar com ele e eu
vou começar a testar e a gente vê as diferenças"*.

Era a regra mais antiga do `doExchange`: **quem era derrubado ainda conectava o contra-golpe**. Ela
existia pra que um pokémon raspando de HP não varresse uma fila inteira só por ser mais rápido —
cada abate cobrava o seu preço. **Hoje o abate é limpo: caiu, acabou.**

- **A MUDANÇA NO MOTOR É UMA LINHA** (`saiuNoPrimeiro = segundoCaiu ? [] : …`), e é o tamanho do que
  ela arrasta que importa. **SAÍRAM JUNTO CINCO COISAS**, todas remendos em cima do revide:
  o `DYING_BLOW_FACTOR`, o **PISO de 1%–10%** (12/09, que impedia o revide de matar), o
  `apararRevide` que o piso obrigava, o `REVIDE_PISO_MIN/MAX` e o ramo de **"quem já estava raspando
  não leva revide"** (13/09). Sem o revide, nenhum deles tem o que fazer.
- **⚠️ O QUE FICA É O TETO DE QUEM RASPA** (`MORIBUNDO_TETO_NO_CHEIO`, 14/09), e ele **não é a mesma
  coisa**: aquele é sobre o **ATAQUE** de quem tem pouca vida — ele não derruba um pokémon cheio num
  golpe só — e continua valendo por conta própria. O comentário dele dizia que ele era "a outra
  metade do piso do revide"; hoje ele é a **única** metade.
- **OS DOIS NUNCA MAIS CAEM NA MESMA TROCA, e agora por construção.** O revide era o único caminho
  para isso fora da autodestruição — que continua sendo a exceção, porque ela zera o HP dentro do
  `tentarGolpeEspecial` e devolve antes de chegar na troca. Medido: **0 em 2.666** abates, e todo
  confronto em que os dois caem tem explosão.
- **⚠️ A MARCA `m` DO DIÁRIO NUNCA MAIS É GERADA, MAS O REORDENAMENTO FICA.** É a mesma decisão do
  `x:'desempate'`: diário gravado antes de hoje **tem** a marca, e sem o reordenamento aquele log
  volta a mostrar pokémon atacando com a barra em zero. Há caso de teste com um diário velho (o
  revide gravado por último, com `m:1`) provando que ele continua legível. O que não existe mais é
  **produzir** um caso novo.

**O PREÇO NA JORNADA: −8,05 PONTOS DE CONCLUSÃO — a segunda maior mexida de dificuldade já medida
aqui**, atrás só do moveset dos NPCs (−12,56). 62,05% → **54,00%**, **9,8σ**, 8 blocos de 800
jornadas de cada lado (6.400 de cada, desvio tirado de ENTRE os blocos) e **8 de 8 blocos apontando
pro mesmo lado** — não é amostra sortuda.

**⚠️ E ELE SE CONCENTRA NO FIM, como as outras mexidas desta série** (1.200 jornadas de cada lado):

| ginásio | com o revide | sem o revide |
|---|---|---|
| 1º | 65 | 71 |
| 5º | 45 | 38 |
| **6º** | 105 | **138** |
| **8º** | 231 | **284** |

Faz sentido: é no fim que os confrontos se decidem em poucas trocas, e é lá que o revide mais
cobrava o preço de cada abate. **A causa mecânica é direta** — um pokémon rápido e forte agora varre
a fila sem tomar nada de volta, e quem tem times assim são os líderes.
**Se um dia isso for demais, a régua não é o revide de volta:** é o nível dos líderes (que já custou
−11,42 quando subiu 2) ou o bolo de derrota.

**⚠️ E A RAIDE DO MEW É O CASO EXTREMO — ela ficou 3,2× mais lenta.** O Mew é Lv.4999, mais rápido
que qualquer pokémon do time, e mata cada um numa troca: **o revide era o que garantia que o
derrubado ainda conectasse UM golpe**, e era dali que vinha quase todo o dano.

| | dano por ataque | ataques pra derrubar |
|---|---|---|
| com o revide | 40,5 | ~621 |
| **sem o revide** | **12,5** | **~2.016** |

**⚠️ E UM ATAQUE INTEIRO PODE SAIR COM DANO ZERO** — o time todo cai sem conectar um golpe. Isso não
é raro o bastante pra ignorar: dois casos do `tools/test-boss.js` que pressupunham "um ataque sempre
tira vida" passaram a falhar em ~3 rodadas de 5, e o jogador que visse isso leria como jogo quebrado
(pior: quem tira zero **não entra no ranking**).
O evento está **DESLIGADO** desde 13/09 (`BOSS_ATIVO`), então isso não afeta ninguém hoje — mas
**ele precisa ser recalibrado antes de voltar**, e essa é a pendência que esta mudança deixou. A
régua é o **nível do Mew** (que entra no divisor do dano) ou o `BOSS_MAX_HP`, e mexer neles exige
apagar `globalBoss/mew`, `globalBoss/mewRank` e a subcoleção `players`: o `maxHp` fica gravado no
documento e o dano acumulado está na escala antiga.
Os dois fixtures do teste passaram a **atacar até causar dano** — o laço tira o flake e não conserta
a raide, e o comentário deles diz isso com todas as letras.

**O QUE ISSO CUSTOU NOS TESTES, e vale como lição:** sete travas mediam o revide ou remendos dele, e
foram de 300+ casos para **zero** — falhando sem nada estar errado. Elas viraram um bloco só, que
cobra o invariante novo (quem cai não revida, a marca não é gerada, os dois nunca caem juntos) e —
**lendo o código** — que os cinco remendos não voltem. Duas amostras também tiveram que crescer: sem
o revide cada confronto rende menos linhas, e os limiares passaram a falhar por falta de dado.

### A PASSIVA DE DRENAGEM ACABOU, E O GOLPE GANHOU ASTERISCO (15/09/2026)

Pedido assim: *"retire a habilidade passiva Absorver que vários pokémons têm também, assim como o
Zubat que tem o sanguessuga e tals, e coloque um * nessas habilidades naquele quadro que aparece
quando aprende habilidade: 'Cura o Pokémon que utilizou ao atacar o oponente'"*.

**A passiva (`ABSORCAO`) era a drenagem de ABERTURA**: 10% por confronto, 23 espécies, tirava
10%–30% do teto do alvo e punha em si antes da luta. Ela existia por um motivo que deixou de valer:
**o golpe drenante não fazia nada**, e ela era a única forma de o Zubat "usar Sanguessuga".

- **⚠️ COM A DRENAGEM NO GOLPE ELA VIROU A MESMA COISA DUAS VEZES — e pior, com regras diferentes.**
  A passiva era **sorteada** (10%) e tirava uma fração do TETO; a do golpe acontece **sempre** e
  devolve metade do DANO. O mesmo Oddish tinha as duas, e o jogador não tinha como saber qual estava
  vendo na tela.
- **⚠️ ELA JÁ ESTAVA QUASE MORTA, e isso explica o número:** ela só dispara **abaixo de 70% da
  vida** (`CURA_MAXIMO_DO_HP`), e a cura no golpe mantém o dono acima disso. Medido, a passiva
  aparecia em **3,1%** dos confrontos de um Zubat numa fila de quatro.
- **O PREÇO NA JORNADA: nada.** 51,58% → **52,33%**, **+0,75 ponto, 1,0σ**, 8 blocos de 800 (6.400
  de cada lado), com **3 de 8 blocos** pro outro lado — ruído puro.
- **⚠️ A APRESENTAÇÃO DELA FICA.** O motor não gera mais `absorb`/`absorbdano`, mas o log, a
  animação e a reconstrução continuam sabendo desenhá-los: diário gravado antes de hoje tem as duas
  entradas, e sem elas aquele log perde uma linha e **a soma para de fechar com a barra**. É a mesma
  decisão do `x:'desempate'` e da marca `m` do moribundo. Há caso de teste com um diário velho
  provando que ele ainda desenha e que a frase continua saindo.
- **SAIU JUNTO DA FICHA DA POKÉDEX**, e é coerente: a ficha conta o que a espécie faz **sozinha**, e
  drenar deixou de ser isso — virou escolha de golpe. O Oddish fica só com o Pó do Sono e o Zubat só
  com o Supersom. A explicação do efeito `drenar` saiu da caixa pelo mesmo motivo (e porque o teste
  cobra que nenhuma explicação sobre sem dono). **Os especiais foram de CATORZE para TREZE.**

**O ASTERISCO NO CARTÃO DO GOLPE** é a outra metade do pedido, e ele **substitui** o que a ficha
contava: *"* Cura o Pokémon que utilizou ao atacar o oponente"*. Ele mora no `obsDoGolpe`, ao lado
do `* Golpe repete entre 2-5x` — a mesma função, o mesmo lugar, e vale nas **três telas de golpe**
porque as três dividem o `cartaoDeGolpe`.
- **É o caso mais forte dessa função inteira:** o cartão do Absorver mostra **PODER 20**, o número
  mais baixo da tela, e sem a frase o jogador larga o golpe sem saber que ele devolve **metade do
  dano**. Um Absorver de 20 que cura vale mais que um Talho de 70 num pokémon que precisa
  sobreviver — e essa conta ele só faz se a tela disser.
- **Sai da TABELA** (`GOLPES_DRENO`), como a dos multi-tapas: golpe novo na tabela já nasce com a
  observação, e um que saia dela perde junto. O teste cobra isso varrendo a tabela, não uma lista.
- **⚠️ CUSTO DE TELA: a frase tem 48 caracteres contra 23 da dos multi-tapas — 2,1× mais longa.**
  Medido no navegador a 320px (15/09/2026): o cartão do Absorver vai a **78px**, contra 53 de um
  golpe comum — **+25px**. O do Comedor de Sonhos, que tem DUAS observações, vai a **120px**. Se incomodar, o
  lugar é o `obsDoGolpe` e as alternativas medidas são *"Cura quem usou, ao atacar"* (25) ou
  *"Devolve metade do dano em vida"* (30).

### A DRENAGEM NO GOLPE: TIRA E DEVOLVE NO MESMO INSTANTE (15/09/2026)

Pedida assim: *"os ataques que tiram dano do oponente e recuperam seu hp, como absorb e giga drain,
quando usar um desses ataques, recuperar a vida do pokemon que usou no mesmo instante que tira hp
do adversario"*.

**⚠️ É O PRIMEIRO EFEITO DO JOGO COLADO NUM GOLPE COMUM, e essa é a diferença que organiza tudo.**
Os onze do `tentarGolpeEspecial` são **sorteados na abertura** e valem por CONFRONTO; este vale por
**GOLPE**, toda vez que o golpe sai, **sem sorteio nenhum** — quem decide se ele acontece é o motor
ter escolhido aquele golpe. ⚠️ Ela CONVIVEU por algumas horas com a **drenagem de ABERTURA**
(`ABSORCAO`, 10%, 23 espécies) — e foi essa convivência que matou a passiva no mesmo dia: duas
drenagens com regras diferentes, e o jogador sem saber qual estava vendo. Ver a seção acima.

- **SÃO OS CINCO da tabela `GOLPES`**, e todos devolvem **50%** (`GOLPES_DRENO`), a fração do jogo
  oficial: Absorver (20), Sanguessuga (20), Mega Dreno (40), Giga Dreno (60) e Comedor de Sonhos
  (100). Nada precisou ser cadastrado — eles já estavam na base da Gen 3.
- **⚠️ A CURA SAI DO DANO EFETIVO, e ela é calculada DEPOIS DE TODOS OS APAROS.** O número que sai
  do `aplicarGolpes` ainda vai ser aparado por QUATRO coisas: o teto de quem raspa, a Faixa de Foco,
  o piso do revide moribundo e o `apararRevide`. Calculada antes deles, a cura sairia de um dano que
  **não aconteceu** — a mesma família do aparo do desempate, que escrevia na tela um número que
  nunca existiu.
- **⚠️ E ELA É CRONOLÓGICA: são DOIS momentos, um por lado.** Quem bate primeiro cura primeiro,
  **antes de o outro revidar**. A primeira versão rodava as duas curas juntas no fim, e o teste
  pegou na primeira batalha: um **Oddish CHEIO** que matava o Geodude com Absorver tomava o revide
  moribundo e **só então** curava, terminando cheio de novo — quando no jogo ele cura zero (já
  estava cheio) e termina machucado.
  Por isso o **`firstHpBefore` virou `let`**: ele significa "a vida do first no instante em que o
  second vai bater nele", e a cura acontece ENTRE as duas coisas. Os três lugares que o leem (o
  `jaRaspando`, o clamp do piso do revide e o `ho` da marca da Faixa) querem esse valor — enquanto
  nada curava no meio, os dois eram o mesmo número.
- **⚠️ O `hp` DA LINHA É CAPTURADO NA HORA DA CURA, não na hora de gravar.** A linha do first é
  escrita depois de o second já ter revidado: lida na gravação, ela registrava a vida pós-revide.
  Medido: um Oddish que curou 77 gravava **`hp:0`** — e esse campo é lido pela reconstrução (o laço
  do `base`) e por toda conta que lê o diário.
- **QUEM CAIU NÃO SE CURA** (o revide moribundo é de quem já está em 0, e devolver vida ali o
  ressuscitaria) e **a cura NUNCA passa do teto**, senão a soma das linhas não fecharia com a barra.
- **ELA RODA FORA DO `if(diario)`**: o diário é apresentação e é opcional, e uma mecânica que só
  valesse com ele faria a mesma batalha terminar diferente conforme quem a chamou.
- **⚠️ ELA NÃO ENTRA NA NOTA do `melhorAtaque`, e isso é decisão:** quem escolhe continua sendo o
  DANO. Inflar a nota faria o Absorver (poder 20) ganhar de golpes de 70 por causa da cura, e isso é
  balanceamento que não foi pedido. **Medido ANTES de implementar**, porque era o risco real da
  feature (a Fúria nasceu saindo em **0,0%** dos confrontos e teve que virar passiva): os drenantes
  já saem em **16,4%** dos golpes de um time de donos e em **2,57%** de um time sorteado.

**NA TELA a cura é UMA LINHA SÓ com o golpe** — *"Oddish atacou Geodude com Absorver e tirou −220 de
HP e recuperou +110."* É a regra da casa ("duas entradas no diário, uma linha"), a mesma da drenagem
de abertura e dos golpes de vários tapas. Na ANIMAÇÃO ela é um passo próprio, com a barra **subindo**
(`amount` negativo).
- **⚠️ E A LINHA DA CURA QUEBROU UM EXTRATOR DE TESTE, pelo mesmo caminho de sempre.** A trava do
  selo de crítico lia a tela com um regex que termina em `de HP\.` — e a linha da drenagem **não
  termina assim**: ela é *"… e tirou −92 de HP e recuperou +46."*. Como o extrator colapsa o log
  numa linha só, o `(.*?)` do regex **atravessava** a linha inteira e casava com o `de HP.` da
  SEGUINTE. Medido no par Vileplume × Gloom: o primeiro match saía com `quem="Vileplume"` e
  `dano=80` — **um golpe que era do Gloom**. A trava comparava o selo com dano do lado errado, e
  falhava ~1 rodada em 3.
  É a MESMA armadilha que a conta de "uma linha por golpe" já tinha custado em 13/09/2026, e o
  conserto é o mesmo: **cortar pelo HTML** (`mlog-passo`), que é onde a linha de verdade começa —
  e não por um pedaço de texto que só por acaso aparece no fim de cada uma.
  ⚠️ **O marcador traz a classe do lado junto** (`<div class="mlog-passo p">`), então o corte tem que
  ser por `mlog-passo` seguido de espaço OU aspas — cortar por `mlog-passo">` dá zero linhas, o que
  é pior que o defeito: a trava passa a medir nada e continua verde.
- **A FRASE DO GOLPE FICA NA TELA enquanto a barra sobe, e isso saiu de graça:** o passo é marcado
  como `cura`, o `fraseDoGolpeUsado` devolve vazio pra passo de cura, e o pintor **só sobe a linha,
  nunca a rebaixa** — então o *"Oddish usou ABSORVER"* do passo anterior continua lá. O mesmo golpe
  tirou e devolveu: a frase é uma só.
- **A CURA ANDA COLADA NO GOLPE** no `passosVisiveis`, pelo mesmo motivo dos tapas: os dois são o
  MESMO lance. Solta, ela ficaria pra trás quando o reordenamento empurra o golpe moribundo pra
  frente, e a tela mostraria o pokémon se curando de um golpe que ali ele ainda não deu.
- **⚠️ A SUAVIZAÇÃO NÃO REPARTE O GOLPE QUE DRENOU**, e é a mesma isenção do multi-tapa e do golpe
  que matou: a linha dele carrega um **segundo número que o jogador confere** (a cura é metade do
  dano, lado a lado). Repartido, a conta que a linha promete quebraria.

**⚠️ O CONFRONTO COM DRENAGEM SAI DO TETO POR COMPLETO — e isso corrigiu um teto de 6 que durou
algumas horas no mesmo dia.** Ele nasceu com teto próprio de 6 (`TETO_GOLPES_COM_CURA`, a pedido:
*"para esses casos que tem os poderes de cura pode aumentar o teto para 6"*), e **6 não bastava**.

**REPORTADO COM PRINT: um Oddish Lv.12 × Sandshrew Lv.17 em que o Absorver não curava nada.** O
motor estava certo — o diário tinha **QUATRO** curas; o confronto passava do teto, caía na
**reconstrução** (que não conhece cura nenhuma) e a tela mostrava três golpes inventados sem um
"+N" sequer. O jogador via "Absorver −77 / −88" e nenhuma cura.

**⚠️ E A MEDIÇÃO QUE ESCOLHEU O 6 ESTAVA ENVIESADA — esta é a lição a guardar.** Ela usou donos no
**Lv.50 com moveset forte** e achou que 87,1% dos confrontos cabiam em 4. No **começo da jornada** é
o contrário: o Absorver tem poder **20**, o alvo tem 165 de HP, e a luta leva **8 golpes**. Medido
naquele par: **74% passavam do teto de 6, e em 74% a cura sumia da tela.** É o mesmo erro do "painel
forte demais" que este arquivo já registra na medição do Smeargle — e ele é pior aqui, porque o caso
que a amostra não cobriu é justamente o mais comum pra quem está jogando.

A isenção total é o que o **SONO** e o **ROLAMENTO** já usam, e pelo motivo idêntico: a reconstrução
não conhece a mecânica, então ela fica invisível nas lutas longas — que aqui são as do começo do
jogo, onde o golpe drenante costuma ser o **único** que o pokémon tem.

**O CUSTO EM LINHAS, medido** (4.000 batalhas, níveis 15 a 70): os confrontos com drenagem são
**2,1%** do total e ficam em **3,58 linhas** em média, contra 2,18 de um confronto comum.
**90,8% cabem em 6 linhas** e 95,4% em 8; a cauda vai a 19 numa fração de 0,3% deles — ou seja
**~0,1% dos confrontos do jogo**. É o mesmo perfil que o sono e o Rolamento já têm.

**⚠️ E A ISENÇÃO DUROU POUCAS HORAS: o TETO INTEIRO acabou no mesmo dia** (ver **O TETO ACABOU**).
Foi justamente ela que o matou — com sono, Rolamento e drenagem isentos, o log passou a ter **dois
pesos** no mesmo print, e foi disso que o jogador perguntou. Medido: **7,8% dos confrontos SEM
drenagem eram resumidos e 0% dos COM**.
- **A TRAVA QUE FALTAVA E QUE AGORA EXISTE: "a cura NUNCA some da tela".** Ela compara as curas do
  DIÁRIO com as da SEQUÊNCIA, e o fixture dela é o par do relato — duro de propósito, porque a luta
  dele passa de 8 golpes. Era ela que teria pego isto, e nenhuma das outras pegava: o motor estava
  certo o tempo todo, e o que falhava era só a apresentação.
  **Com o fim do teto ela ficou MAIS forte, não menos:** deixou de cobrar "o confronto é comprido,
  logo ele cai na reconstrução" e passou a cobrar que a cura chegue à tela em confronto de QUALQUER
  tamanho. Se um dia algum corte voltar — um teto novo, uma isenção, um resumo —, é ali que grita.

#### ⚠️ O COMEDOR DE SONHOS SÓ VALE CONTRA ALVO DORMINDO — e o preço dele é o maior desta feature

Pedido junto (*"o comedor dos sonhos pode colocar que o gengar só usa quando o adversário está
dormindo"*), e é o que o jogo oficial faz. **A trava mora na ESCOLHA** (`melhorAtaque` tira o golpe
dos candidatos), não no dano: barrado só no dano, o motor escolheria um golpe de 100 e aplicaria
zero — a mesma classe de erro do `EXPOENTE_TIPO` valendo num lugar e não no outro.
- Quem responde "o alvo está dormindo?" é o **`_dormeAgora`**, marcado pelo `doExchange` na troca em
  que o alvo perde o turno — e **não o `_dormindoPor`**, que é decrementado no COMEÇO da troca: na
  troca livre ele já está em 0 enquanto o pokémon ainda nem atacou, e lido dali o golpe **nunca
  sairia**.
- O filtro é **incondicional** (ao contrário do da anulação, que só morde quem tem alternativa):
  medido, o Comedor de Sonhos **nunca é o único golpe de dano de ninguém** nas 250 × 99 níveis.
- A guarda vale **também no motor da cura**, e é rede e não repetição: o **METRÔNOMO** sorteia entre
  todos os golpes de dano da tabela e podia trazê-lo por outro caminho.

**⚠️ O CUSTO É ENORME, E A CAUSA NÃO É A CURA — É QUE ELE É O ÚNICO GOLPE ESPECIAL DA LINHA DO
GASTLY.** Medido num painel fixo de 8, nível 50:

| | sem a trava | com a trava | |
|---|---|---|---|
| **Haunter** | 52,1% | **16,3%** | **−35,8** |
| **Gengar** | 81,9% | **67,5%** | −14,4 |
| **Gastly** | 15,0% | **1,3%** | −13,7 |

O Haunter Lv.50 tem **Ataque 50 e Sp.Atk 115**, e neste motor quem decide físico/especial é o TIPO
(regra da Gen 1): **Comedor de Sonhos é Psíquico = ESPECIAL**, enquanto Bomba de Lodo (Veneno) e
Bola Sombria (Fantasma) são **físicos**. Ou seja, tirar o Comedor os obriga a bater com **50 em vez
de 115** — menos da metade da força. Não é "trocar 100 por 90".
**A alternativa está medida e é uma linha:** ele **usa sempre, mas só CURA contra alvo dormindo** (a
guarda já existe no `drenar`; basta não filtrar no `melhorAtaque`). Ela devolve os três à taxa
original e mantém barrado o que preocupava — a cura de graça.

**O PREÇO NA JORNADA, medido em 8 blocos de 800 (6.400 de cada lado, desvio ENTRE blocos) — e as
duas metades desta feature se ANULAM:**

| A/B | conclusão | |
|---|---|---|
| só a **CURA** (com a trava do Comedor já valendo dos dois lados) | 60,30% → **62,20%** | **+1,91 ponto, 4,2σ**, 7 de 8 blocos |
| a **FEATURE INTEIRA** (cura + trava) contra o jogo de antes | 61,52% → **61,70%** | **+0,19 ponto, 0,2σ**, 4 de 8 blocos |

Ou seja: a cura é um ganho real e fora do ruído, e **a trava do Comedor de Sonhos come esse ganho
inteiro**. Na conta final a jornada não se move — mas ela não se move porque duas mexidas grandes se
cancelam, e não porque as duas sejam pequenas. Adotar a variante B (usar sempre, curar só dormindo)
devolveria a jornada aos **+1,9 pontos** da primeira linha.

- **20 das 250 espécies levam um drenante** no moveset padrão do Lv.50. Num time aleatório ele sai
  em **2,57% dos golpes**, **5,6% dos confrontos** e **34,4% das batalhas**.
- **ONDE ELA VALE, e não é decisão nova — é consequência do golpe escolhido.** Ela vive no
  `doExchange`, então vale na **jornada**, na **Elite**, na **Torre** e no **Ginásio da Cidade**:
  esses quatro montam o time a partir dos SAVES, e o campo `ataques` viaja junto.
  **⚠️ E VALE NAS LIGAS E NO ONLINE DESDE 16/09/2026** — foi justamente ela que trouxe o relato
  (*"o sanguessuga não está curando nas batalhas das ligas onlines"*) e o conserto está na seção
  **OS GOLPES ESCOLHIDOS CHEGAM NA LIGA E NO ONLINE**. Até lá não valia, porque o time vinha de um
  CÓDIGO que não carrega golpe: o `lastMove` era null e o motor caía no de tipo.
  **A única porta que existia ali era o METRÔNOMO**, que sorteia entre todos os golpes de dano e
  podia trazer um drenante — é coerente ("qualquer poder existente no jogo"), é por isso que a
  guarda do Comedor de Sonhos vive TAMBÉM no motor da cura, e é por isso que a medição do "antes"
  dá 1 e não 0.
  **Os NPCs drenam**: o `equiparNpc` dá o moveset inteiro da espécie ao líder, ao rival e ao
  treinador da Torre — então o Vileplume da Erika e o Gengar da Agatha usam a mecânica contra o
  jogador, que é o que faz o efeito na jornada ser pequeno.
- **Se um dia incomodar**, a régua é a **fração** (`GOLPES_DRENO`, hoje 0.5 em todos — ela é por
  GOLPE, então dá pra deixar o Giga Dreno em 0.5 e o Absorver em 0.25). **O teto de linhas não é
  régua aqui**: ele saiu, e voltar a limitá-lo traz de volta a cura sumindo da tela.
- **⚠️ ACHADO NO CAMINHO E NÃO MEXIDO (não foi pedido, e é ANTERIOR a esta feature): no online, quem
  é o lado B vê a luta RECONSTRUÍDA, não o diário.** O `meuM` que o `advanceOnlineReveal` monta pra
  virar a perspectiva carrega só os HPs — ele **não leva o `golpes`** —, e o
  `buildAnimatedHitSequence` lê o diário de lá. Então o lado A vê os golpes reais e o B vê os
  inventados. O resultado final é o mesmo (a reconstrução interpola entre os HPs), o que muda é a
  divisão em golpes. Hoje isso quase não custa, porque no online ninguém tem golpe escolhido; no dia
  em que a drenagem valer lá, o lado B não veria a barra subir. O conserto é uma linha (levar o
  `golpes` no objeto virado), mas ele muda o que metade dos jogadores vê numa batalha PvP e merece
  medição própria.
- `tools/test-especiais.js` tranca: as duas tabelas iguais nos dois motores, a cura sendo metade do
  dano efetivo (casada com o golpe que a gerou), o teto de vida, quem caiu não curando, a soma
  fechando, **quem entra CHEIO não curando** (a trava cronológica), o Comedor de Sonhos fora da
  escolha contra alvo acordado e dentro contra dormindo, ele nunca sendo o único golpe de alguém, a
  rede do Metrônomo, o `_dormeAgora` marcado antes dos golpes e limpo depois, a cura não abrindo
  linha no log, o passo com a barra subindo do lado certo, a frase do golpe não sendo apagada, a
  cura colada no golpe, e o teto de 6. E a comparação das 300 batalhas entre os dois motores
  **COBRA que ela apareça** — sem essa linha ela daria verde sem nunca ser tocada, e aqui isso pesa
  mais que nos outros: ela **muda o HP no meio da troca**, então um motor curando e o outro não faz
  a mesma batalha terminar diferente a partir do golpe seguinte.

**⚠️ E A LISTA DE "VIDA QUE SOBE" DO TESTE ESTAVA COPIADA À MÃO EM NOVE CONTAS** — exatamente a
armadilha que o `danoSemGolpe` já tinha registrado ("a quarta que ficasse pra trás falharia raro e
intermitente"). Ela virou `subiuAVida()`, numa função só, e o `dreno` entrou numa linha.

### AS DUAS FRASES QUE FALTAVAM (14/09/2026)

- **"Krabby acordou e voltou à luta!"** — pedida com estas palavras, e **só DEPOIS de ele apanhar**:
  *"quando um pokémon dormir, ele vai tomar um dano, E DEPOIS DISSO, exiba a mensagem"*.
  **⚠️ A PRIMEIRA VERSÃO GRAVAVA NO COMEÇO DO `doExchange`** e a linha saía ANTES do golpe que ele
  levou dormindo — o log dizia *"fez dormir / acordou / atacou"*, contando a história de trás pra
  frente. Hoje o começo só guarda QUEM acordou; o registro entra depois dos golpes daquela troca.
  **O `q` é de QUEM ACORDOU**, como o da fúria: a linha é sobre UM pokémon, não sobre um causador e um
  alvo — ao contrário do sono, cujo `q` é de quem USOU o golpe. O nome viaja junto (`g`) porque o log
  é relido dias depois, quando o matchup já não diz qual dos dois estava dormindo.
  **⚠️ E A ORDEM PRECISOU VALER NA TELA TAMBÉM, não só no diário.** Reportado logo depois, num
  Venusaur × Vileplume: *"a Vileplume fez o venusaur dormir mas ele já acordou sem a vileplume ter
  batido nele"*. **O motor estava certo** — o diário saía `sono → golpe → acordou` em 100% dos
  casos. Quem embaralhava era a `sequenciaDoConfronto`: eu tinha posto o `acordou` (e o `chuvafim`)
  na lista de **ABERTURAS**, e aquela lista tem **significado posicional** — o que está nela é
  puxado pro TOPO quando o confronto passa do `TETO_GOLPES` e cai na reconstrução. Por isso só
  aparecia em luta longa, que é justamente o caso do print.
  Hoje os dois têm lugar próprio na cena: o despertar vem **depois da troca livre em que ele
  apanhou** e a chuva **fecha o confronto**.
  **⚠️ E O DESPERTAR ENTRA ENTRE AS TROCAS LIVRES, não depois de todas.** Ele acontece no fim da
  troca em que o contador zera — a PRIMEIRA delas. Quem usou o sono pode ter mais de uma troca livre
  (se for o mais rápido, ele ainda bate primeiro na troca em que o outro acorda), e contadas todas
  antes do despertar a tela dizia que ele levou **dois** golpes dormindo. A posição sai do próprio
  diário: quantos golpes livres vieram antes da marca.
  **⚠️ E QUEM MORRE DORMINDO NÃO ACORDA (14/09/2026, a pedido:** *"quando um pokémon morre durante o
  sono, não precisa exibir que ele acordou e voltou para a luta, nem no log e nem na batalha"*).
  Reportado com print num **Venusaur × Mr. Mime**: o Mr. Mime levou o golpe dormindo, morreu (0/331),
  e a linha do despertar saiu logo abaixo.
  **O contador do sono anda no COMEÇO da troca e o pokémon leva o golpe no MEIO dela** — então só
  depois dos golpes dá pra saber se ele chegou vivo ao fim. É por isso que o começo do `doExchange`
  guarda o pokémon (e não só o lado e o nome): a decisão é lá embaixo.
  Medido: **450 confrontos** em que ele morre no golpe que leva dormindo, **0 com a linha** — e
  **120 de 120** em que ele sobrevive continuam anunciando.
  **⚠️ ARMADILHA DA MEDIÇÃO, e ela custou uma volta:** o `preservePlayerHp` preserva o time **A** e
  CURA o **B**. Com o Mr. Mime montado como B ele entrava sempre cheio e o cenário não acontecia
  **nenhuma vez em 12.000 voltas** — o teste passaria sem testar nada. É a mesma armadilha que a
  medição do revide moribundo já tinha custado.
  **⚠️ E O PONTO FINAL DEIXOU DE DOBRAR COM O "!".** A linha do log saía *"acordou e voltou à
  luta!."* — as duas frases novas já vêm pontuadas do pedido, e o `linhaEspecial` concatenava um "."
  cego. Hoje o `pontoFinal()` só acrescenta quando falta, exatamente como o `pontuada()` já fazia no
  aviso do meio da batalha.
  Medido depois: **0 de 521** confrontos com a ordem errada na tela (250 deles no caso exato do
  print), e há trava sobre a TELA — o diário já tinha a sua.
- **"A dança da chuva terminou!"** — e ela sai no confronto que foi o **ÚLTIMO debaixo dela**, não no
  seguinte. Pô-la no seguinte seria pior de duas formas: ele pode **não existir** (a batalha acaba
  junto) e, existindo, ele já é um confronto sem chuva — a frase chegaria depois de o jogador ver um
  golpe de Fogo voltar ao normal sem explicação.
  Ela **não nomeia ninguém**: o clima é do CAMPO, a mesma razão pela qual o 🌧️ do cabeçalho fica em
  cima do ×.
- **⚠️ E A PAUSA VALE NO ÚLTIMO PASSO TAMBÉM (14/09/2026, reportado:** *"a mensagem de fim da
  dança da chuva não está esperando 1,5s para ela seguir com o processo depois"*). O ramo do passo do
  MEIO já somava o `pausaDaFaixa`; o do **último** não — e só uma abertura cai ali SEMPRE, o
  `chuvafim`, que fecha o confronto por desenho ("ele foi o último debaixo da chuva"). Era por isso
  que só ela tinha sido relatada.
  **São os QUATRO laços de revelação**, e não só o da jornada: deixar em um só era garantir que a
  mesma frase durasse tempos diferentes na Elite, na Torre e na liga assistida — exceção em lista é
  onde a próxima omissão se esconde. O teste **lê o código** pra cobrar os quatro.
- As duas valem **1 passo** no `passosDaAbertura` e ganham o segundo e meio de leitura pela marca
  `leitura`, como toda frase que não mexe barra. Fora da tabela, valeriam pra SEMPRE — o defeito que a
  anulação teve.
- **⚠️ E O `!` DEIXOU DE DOBRAR.** As duas já vêm pontuadas do pedido, e a concatenação cega do
  `avisoDoConfronto` dava **"!!"** na tela. Hoje o `pontuada()` só acrescenta quando falta.

### O MAPA SAIU DA ABERTURA DA JORNADA (14/09/2026)

Pedido assim: *"o mapa que aparece logo quando inicia o save, pode tirar, deixar apenas naquele botão
do Mapa que já existe hoje quando se tem que escolher qual o próximo ginásio a enfrentar"*.

- Ele existia como um beat de tela pra dar a Kanto o tamanho que o texto sozinho não dava. O botão
  **"🗺️ Ver o mapa" continua em toda tela de escolha**, então o mapa não sumiu: o que sumiu é a parada
  obrigatória nele.
- **⚠️ A TELA `kantoIntro` FICA DESENHÁVEL, e isso é de propósito:** ela era ponto seguro de gravação,
  então save antigo parado nela precisa de uma tela pra abrir — sem ela, quem fechou a aba ali volta
  numa tela em branco. É a mesma decisão do `case 'tmhm'` quando o botão dele foi escondido.

### AS QUATRO CORREÇÕES DA BATALHA ONLINE (14/09/2026)

**1) +5s EM CADA JANELA.** São QUATRO: aceitar a partida (15→**20s**), escolher o TIME (15→**20s**), o
pokémon INICIAL (10→**15s**) e as trocas do meio da batalha (5→**10s**).
**⚠️ O `BATTLE_ANIM_MS` NÃO É UMA DELAS**, de propósito: ele não é tempo de DECISÃO, é a reserva que o
servidor dá pra a animação rodar antes de a janela começar a contar. O cliente desenha o cronômetro
com os MESMOS números — se divergirem, o relógio da tela começa num número que a partida não tem.

**2) DÁ PRA TROCAR ATÉ O TEMPO ACABAR.** Reportado: *"quando você seleciona um pokémon, não tá sendo
possível trocar para outro na mesma etapa"*.
**⚠️ O SERVIDOR SEMPRE ACEITOU** — o `pickOnlineBattlePokemon` sobrescreve a escolha enquanto a fase é
`choosing`, e o prazo nunca foi encurtado quando os dois escolhem cedo. **Quem travava era só a tela**:
ela desabilitava os cards assim que a primeira escolha era enviada. `escolhendo` (a janela está aberta)
e `escolhi` (já mandei uma) eram a mesma variável e são coisas diferentes — hoje o cabeçalho muda de
texto e os cards continuam clicáveis.

**3) A FRASE DA PASSIVA FICAVA ESTÁTICA.** Reportado: *"quando acontece alguma habilidade passiva na
batalha online, a mensagem fica estática e não sai mais, ou seja, não aparece os ataques dos pokémons,
somente essa frase"*.
A causa: o online calculava `avisoDoConfronto(m)` **UMA VEZ, sem passo**, e o `pintarGolpeOnline` saía
cedo enquanto ele existisse — então um confronto com sono, chuva ou qualquer abertura ficava com a
mesma frase do começo ao fim, e **nenhum golpe era nomeado**.
**As outras quatro telas já faziam certo desde 09/09/2026** (a tabela `passosDaAbertura`): a frase vale
os passos dela e CEDE o lugar ao nome do golpe. O online ficou pra trás porque é o quinto laço e o
único com perspectiva — **exatamente a exceção em lista onde a próxima omissão se esconde**, que é o
que já tinha acontecido com o buff de especialidade na raide do Mew.

**4) A VERIFICAÇÃO GERAL — e ela achou um quinto defeito.** Pedido: *"verifique em geral o
funcionamento das batalhas onlines se está seguindo a mesma mecânica das batalhas da jornada"*.
O online resolve **confronto a confronto** (`battleResolveMatchup`) e a jornada roda a batalha inteira
(`simulateGymBattle`) — mas os dois chamam o **MESMO `doExchange`**, então as **11 passivas de confronto
valem igual**: conferido uma a uma, todas saem (sono, fúria, confusão, Fúria do Dragão, as duas danças,
Recuperar, chuva, autodestruição, anulação, drenagem).

**⚠️ O QUE DIVERGIA ERA A CHUVA: ela durava UM confronto em vez de três.** E o comentário do código
dizia que *"a batalha online não tem clima"* e que ela não era sorteada ali — **isso era falso** desde
que a Dança da Chuva entrou: o sorteio mora no `tentarGolpeEspecial`, que o `doExchange` chama. Medido:
ela saía em **10,3% dos confrontos** e morria no primeiro, porque o `limparClima()` zerava o contador
antes de cada um.
Hoje o clima **vem do ESTADO da partida** (`definirClima(estado.chuva)`) e o que sobra volta pro
documento. **E zerar continua sendo obrigatório**, por outro motivo: o `chuvaRestante` é módulo-level e
no servidor a INSTÂNCIA é reaproveitada entre invocações — um `simulateGymBattle` (Torre, ginásio da
cidade) que acabe com chuva sobrando vazaria pro próximo confronto online. Ler do documento fecha as
duas portas de uma vez.

**O QUE CONTINUA DIFERENTE, e é decisão antiga:** o time do online vem de um CÓDIGO
(`especie:nivel:shiny`), então ele **não tem golpe escolhido** e luta no motor de tipo — o Rolamento,
que depende de golpe escolhido, não existe lá. E os **itens equipados** continuam fora (daria vantagem
a um lado num PvP).

### A MATA FECHADA: O CADEADO DIZ O QUE FAZER, E A CLAREIRA MOSTRA AS DUAS FILAS (14/09/2026)

- **O cadeado nomeia o HM01 e a MOCHILA**: *"🔒 Use o HM01 (na Mochila) em um pokémon do time pra
  liberar este caminho"*. Ele dizia *"precisa de um pokémon que saiba Corte"* — isso descreve o ESTADO,
  não diz que o HM01 mora na mochila nem que ele se USA num pokémon, e sem isso o jogador que tem a
  Máquina no bolso fica olhando o cadeado sem saber que a chave já é dele.
- **A clareira mostra a ORDEM dos dez e deixa arrumar a sua.** É a **única batalha do jogo em que o
  jogador vê a fila do adversário antes de lutar** — e isso é a coisa toda: 10 contra 6 sem cura entre
  confrontos se decide na ORDEM, e sem ver a fila a escolha seria no escuro. O 1º dele encara o 1º seu.
  As setas são as mesmas da tela de ordem do time, e reordenam o `game.team` — que é o que entra na
  batalha, sem cópia no meio. Elas **gravam**: a clareira está no `SAFE_SAVE_SCREENS`, então fechar a
  aba depois de arrumar a fila não pode desfazer o que foi arrumado.
- **⚠️ E A FILA É A `order-row` DA TELA DE ORDEM DE BATALHA, não um formato próprio** (14/09/2026, a
  pedido: *"as setinhas para ordenar têm que seguir o mesmo padrão que já existe em outras telas de
  ordenação, são 2 setinhas azuis, uma embaixo da outra, e também deixe os sprites dessa tela da
  vigília do mesmo tamanho... e também exiba o tipo dos pokémons do treinador (hoje não está
  exibindo)"*).
  Ela teve CSS próprio por um dia, e ele custava **três diferenças pra a mesma pergunta**: sprite
  menor, setas de outra forma, e a fila do JOGADOR saía **sem selo de tipo** (a dos dez tinha).
  Reusar a linha de sempre resolve os três de uma vez e não deixa o quarto nascer — a pergunta aqui
  é a mesma da tela de ordem ("em que ordem eles entram?"), e um formato diferente obrigaria a
  reaprender a ler no meio da decisão.
  **⚠️ O `botaoDeItemHtml` VEIO JUNTO EM 14/09/2026, a pedido** — e ele é o lugar certo: a clareira
  é a última tela antes de **10 contra 6 sem cura nenhuma entre confrontos**, ou seja é exatamente
  aqui que se decide quem leva a poção. Mandar o jogador sair pra equipar e voltar seria o oposto
  do motivo de o `+` existir ("decidir quem entra primeiro e quem leva o quê é a mesma conversa").
  **Medido a 320px: ele custa ZERO** — a página fica nos mesmos **2.442px**, a coluna do número nos
  mesmos 28px e a linha nos mesmos 103px, porque o `+` mora DENTRO da coluna do número (que já era
  mais alta que o texto dela). É a mesma conta que pôs o botão ali em primeiro lugar.
  **O QUE CONTINUA FORA é o `golpesDoTimeHtml`**: golpe não se troca aqui, e a clareira já é a tela
  mais alta da jornada.
  **Medido a 320px:** sprite de **48px** nas duas telas (idêntico), 12 setas `.circle-btn`, 24 selos
  de tipo, o "10º" cabendo na coluna do número (o `.order-num` ganhou `min-width`, que a tela de
  ordem nunca precisou — lá o máximo é 6º) e **sem rolagem lateral**. A tela vai a **2.464px** com as
  16 linhas.
  A quebra do nome comprido é **a mesma das duas telas** (4 de 6 na de ordem, 5 de 16 aqui) — e a
  clareira ainda sobra mais espaço pro nome, 205px contra 167px, porque não tem o botão de item.


### ⚠️ O HO-OH APARECE EM 5% DAS VIGÍLIAS (16/09/2026)

Pedido assim: *"adicione 5% de chance de o HoHo ser um dos pokemons que aparece na vigilia do arco
iris"*. **E isso o torna o único dos três INTOCÁVEIS que se deixa capturar**, porque o prêmio da
vigília é escolher 1 dos 10.

- **É O PAGAMENTO DO MITO.** A vigília EXISTE por causa dele — os selvagens esperam a passagem do
  arco-íris —, então ele aparecer na roda é o único jeito de a lenda se cumprir. Um Ho-Oh apagado,
  impossível de escolher no meio dos dez, precisaria de uma explicação que a tela não tem e se
  leria como defeito.
- **⚠️ O QUE ISSO NÃO MUDA, e é o que mantém tudo de pé: as metas de "capturar tudo" continuam
  EXCLUINDO os três.** Contando o Ho-Oh, **toda conta que já tinha a Pokédex de Johto ou o Mestre
  Pokémon PERDERIA a conquista** até tirar 5% numa mata fechada — e conquista que se perde sozinha
  é pior que conquista nenhuma. Ele é **troféu, não requisito**. Há trava pras duas metas.
  O Lugia e o Celebi continuam sem porta nenhuma, e ele continua fora das rotas selvagens
  (`SEM_CAPTURA_SELVAGEM` não foi tocado) — a vigília é a única porta.
- **A descrição do "Mestre Pokémon" mudou junto**: ela dizia que os três não se deixam pegar, e
  isso deixou de ser verdade inteira. Hoje ela nomeia a exceção.
- **⚠️ OS DOIS NÚMEROS DO SORTEIO SÃO LIDOS SEMPRE**, mesmo quando ele não vem: assim a sequência
  do rng é a MESMA com e sem ele, e a vigília de quem não tirou os 5% continua sendo exatamente a
  que ela seria. Lidos só quando passam, eles deslocariam o resto do sorteio.
- **ELE OCUPA UMA VAGA, não entra por cima das dez**, e com o NÍVEL daquela vaga: a vigília é
  calibrada em 10 contra 6 sem cura entre confrontos, e um 11º mudaria o preço medido da mata
  inteira. O que o torna duro é o CORPO (BST 680), não o nível.

**O QUE ELE CUSTA E O QUE ELE VALE, medido:**

| | |
|---|---|
| taxa de aparição | **4,91%** em 20.000 vigílias (0,6σ de 5%) |
| a vigília quando ele aparece | 56,2% → **49,3%** de vitória (**−6,8**) |
| diluído pelos 5% | −0,34 ponto na vigília em geral |

**Como PRÊMIO ele é forte e não é absurdo** (1x1 contra um painel de 8, Lv.45): **Ho-Oh 79,2%**,
contra 40,5% de um Vileplume (prêmio comum) e 11,4% de um Raticate. E o **Gyarados de rota faz
89,8%** no mesmo painel — ou seja, ele não é o melhor pokémon do jogo, é um troféu bom.

**O PREÇO NA JORNADA: nada. 56,20% contra 56,32% de conclusão** — **+0,13 ponto, 0,2σ** (8 blocos
de 700 jornadas de cada lado, **5.600 de cada**, com o bot `--corte` entrando na mata sempre, e o
desvio tirado de ENTRE os blocos; **4 de 8 blocos** pra cada lado). Ruído absolutamente puro, e faz
sentido pelos três motivos somados: ele sai em **5%** das vigílias, a mata aparece em 1 de cada 4
trechos a partir do 4º, e quando ele sai ele DIFICULTA a vigília (−6,8) ao mesmo tempo em que a
PAGA melhor — os dois se cancelam na conta da jornada.

- **Se um dia incomodar**, a régua é o `CHANCE_HOOH_VIGILIA`.

### ⚠️ TRÊS TELAS NASCERAM ILEGÍVEIS, E O DEFEITO ERA DE OMISSÃO (14/09/2026)

Reportado assim: *"o quadro da Vigília do Arco-Íris não dá para ler direito por conta das cores. Se
não me engano tem um quadro assim também em algum confronto com a equipe Rocket"* — e tinha.

- **O `renderSpecialIntro` mapeava o contexto pra classe numa escada de ternários** que cobria
  **três** (`rocket`, `rival`, `elite`), e o `startSpecialBattle` é chamado com **seis**. Os outros
  — **`vigilia`, `hideout1` e `hideout2`** — caíam na string vazia, ou seja no banner **BASE**, que
  não tinha fundo próprio: texto na cor escura da casa sobre o fundo escuro da página.
  **Medido: 1,10:1.** Praticamente invisível.
- **⚠️ NINGUÉM VIU PORQUE AS TELAS QUE JÁ EXISTIAM ESTAVAM CERTAS.** Cada contexto novo nascia
  invisível, e quem testa olha o que já estava lá. Por isso o conserto tem duas metades, e a segunda
  é a que importa:
  1. o contexto vira classe por **TABELA** (`CLASSE_DO_BANNER`), com os dois do esconderijo caindo na
     faixa da Rocket — que é o que eles são;
  2. **o banner BASE ganhou fundo e texto claro.** O pior que acontece com um contexto novo agora é
     ele ficar **sem identidade** — nunca invisível.
- **A VIGÍLIA MANTÉM O ARCO-ÍRIS, só que escuro.** A identidade dela é o arco-íris e ela fica; o que
  mudou é a luz. Com as cinco faixas claras e o texto escuro o contraste **passeava de 7,63:1 no
  verde a 3,67:1 no roxo** — ou seja ele MUDAVA debaixo da mesma frase conforme ela cruzava o
  gradiente, e no pior pedaço ficava abaixo do 4,5:1 que o AA pede pra texto normal. Com as faixas
  escuras e o texto branco o pior pedaço vai a **7,31:1** — o alvo que a fonte de PIXEL pede, porque
  ela é fina e piora o número na prática. É o mesmo remendo que a faixa da Rocket já tinha levado.

  | variante | pior contraste |
  |---|---|
  | **(base)** | 1,10:1 → **11,9:1** |
  | **vigilia** | 3,67:1 → **7,31:1** |
  | rocket | 12,51:1 (já estava) |
  | elite | 10,52:1 (já estava) |
  | rival | 5,94:1 (já estava) |

- `tools/test-jornada.js` varre os contextos **lidos das chamadas** — não de uma lista escrita no
  teste, que envelheceria do mesmo jeito — e cobra que todos tenham variante, que o base tenha fundo
  e que a vigília continue com as cinco faixas. Conferido que ele acusa `hideout1, hideout2, vigilia`
  com a escada de ternários de volta.

### A VIGÍLIA DO ARCO-ÍRIS: 10 CONTRA 6 (13/09/2026)

Pedida assim: *"nessa rota você vai exibir uma tela dizendo que ele encontrou uma reunião de pokémons
selvagens celebrando algo (procure alguma mitologia do pokémon), e que ele atrapalhou e agora esses
pokémons estão furiosos, e então você vai elaborar um time com 10 pokémons (média de level -5 level
da média do time do treinador), sendo que 2 devem ser shiny, e caso o treinador vença esses 10
pokémons, ele pode escolher 1 dos 10 para ir na jornada com ele"*.

- **O MITO É O DO ARCO-ÍRIS DE HO-OH**, e ele foi escolhido por caber nas duas regiões: no folclore
  de Johto, Ho-Oh cruza o céu deixando um arco-íris atrás de si, e quem o vê carrega a felicidade pra
  sempre — é a lenda que explica a Torre Sino e as três bestas. Os selvagens fazem vigília esperando
  a passagem dele; o galho cortado cai no meio da roda e desfaz o arco-íris.
  **A alternativa era o santuário do Celebi na Floresta Ilex** — que é justamente onde o Corte é
  obrigatório no jogo original, e seria a piscadela mais bonita. Ela foi descartada por ser de UM
  lugar só: a mata aqui aparece em qualquer trecho de 4 a 8, nas duas regiões.
- **⚠️ OS DEZ SÃO SORTEADOS COM SEMENTE DO SAVE**, como tudo nesta jornada: com `Math.random`
  bastaria fechar a aba antes da gravação pra re-sortear até vir um painel fácil — ou até vir o
  shiny que se quer de prêmio.
- **AS TRÊS EXCLUSÕES PEDIDAS**: nada de lendário, nada que o treinador já tenha, e nada repetido
  entre os dez — as duas últimas por **LINHA EVOLUTIVA** e não por espécie, que é a regra que o
  encontro selvagem já usa (dois Magikarp viram dois Gyarados).
- **⚠️ E A ESPÉCIE TEM QUE BATER COM O NÍVEL** (`formaNoNivel`): um Caterpie nível 45 não existe. A
  conversão vem ANTES da checagem de linha, senão dois ids diferentes (caterpie e metapod) viriam os
  dois como Butterfree.
  **⚠️ ERA O `especieNoNivel`, E ELE SÓ ANDA PRA FRENTE — foi o defeito de 14/09/2026**, relatado
  com print: *"está aparecendo Charizard no level 24, Poliwrath no level 25, Steelix no level 27"*.
  Aquele nasceu pro **encontro selvagem**, onde a rota lista a forma BASE e o que pode acontecer é
  ela já ter evoluído naquele nível; quem barra o contrário por lá é o **piso**
  (`EVOLVED_MIN_LEVEL`), que empurra o NÍVEL pra cima quando a rota lista uma forma evoluída.
  **A vigília não tem piso nenhum pra barrar:** ela sorteia da DEX INTEIRA, então tira forma FINAL
  direto e o nível dela é baixo por construção (a média do time menos cinco).
  **Medido: 28,5% dos dez** eram uma forma que não existe naquele nível — mais de um em quatro.
  O `formaNoNivel` **DESCE** a linha até a forma que existe ali e só então deixa o `especieNoNivel`
  subir. Charizard Lv.24 → **Charmeleon**, Poliwrath Lv.25 → **Poliwhirl**, Steelix Lv.27 → **Onix**,
  Blissey Lv.25 → **Chansey**, Magneton Lv.27 → **Magnemite**. Depois: **0 de 4.000**.
  O nível de CHEGADA de cada forma sai do próprio `EVOLUTIONS`, e os destinos da bifurcação entram
  pelo `EVOLUTION_CHOICES` — sem eles, Vileplume e Bellossom não teriam de onde descer.
  **⚠️ E VIGÍLIA JÁ GRAVADA É ARRUMADA NA LEITURA** (no `applySavedState`, os dois campos): quem
  está no meio da clareira — ou, pior, na tela do **PRÊMIO** — escolheria um pokémon impossível e o
  levaria pro time. É o mesmo espírito do `repararEvolucoesAtrasadas`: fechar a torneira não
  conserta o que já vazou.
  **O QUE ISSO CUSTOU À DIFICULDADE, medido** (600 batalhas por célula, mesmos times e sementes):
  a vigília ficou **9,8% mais fraca em BST**, e a vitória do jogador sobe
  **62,2% → 87,3%** num time ~27 (trecho 4), **71,0% → 72,3%** num ~45 e **41,0% → 42,7%** num ~56.
  Ela se concentra no começo porque é lá que a forma final era mais absurda: um Charizard Lv.24 é
  muito mais acima do trecho do que um Charizard Lv.56. **Não foi compensado** — era defeito, não
  balanceamento.
- **A MÉDIA BATE EXATO.** Os desvios são montados pra **somar zero**, então a média dos dez é
  exatamente `media − 5` e não "mais ou menos isso". E **os dois shiny são marcados depois, em
  posições distintas**: sorteando "shiny?" um a um, uma vigília sairia com zero e outra com cinco —
  o pedido diz DOIS.
- **⚠️ O `createInstance` NÃO COPIA A FLAG SHINY** — armadilha conhecida da casa, e a Vigília é a
  **primeira batalha especial em que o ADVERSÁRIO tem shiny**. O `runSpecialBattle` passou a copiar,
  e ele só **LIGA, nunca desliga**: os outros contextos não mandam o campo e continuam idênticos.
- **A VIGÍLIA VAI PRO SAVE**, e não só no `specialBattle` (que **não é serializado**): a clareira e a
  tela do prêmio são pontos de leitura e de decisão, e fechar a aba numa delas não pode perder os
  dez — muito menos o prêmio de quem já venceu. As duas entraram no `SAFE_SAVE_SCREENS`.
- **O PRÊMIO ENTRA COMO UM SELVAGEM CAPTURADO**: mesmo nível, mesmo shiny, e passando pela MESMA
  tela de escolha de golpes. **Com o time cheio ele entra assim mesmo e o time fica com 7** — quem
  resolve é a tela do Prof. Carvalho, exatamente como num encontro selvagem. Sem isso, o prêmio de
  quem tem 6 sumia.
- **PERDER NÃO CUSTA TENTATIVA DE GINÁSIO e não tira ninguém do time.** O preço é outro, e é grande:
  a mata **substituiu o encontro selvagem do trecho**, então quem perde atravessa aquele trecho SEM
  CAPTURAR. É o que faz dela uma aposta.

**⚠️ O PREÇO MEDIDO, E ELE É MUITO DESIGUAL AO LONGO DA JORNADA — este é o número que importa aqui.**
800 jornadas com o bot entrando na mata sempre que ela aparece (839 vigílias):

| trecho | vigílias | o jogador venceu | nível médio do time |
|---|---|---|---|
| 4º | 168 | **97,6%** | ~27 |
| 5º | 162 | **88,3%** | ~35 |
| 6º | 180 | **54,4%** | ~45 |
| 7º | 161 | **34,2%** | ~53 |
| 8º | 168 | **22,0%** | ~56 |
| **no total** | **839** | **59,2%** | ~43 |

**A CAUSA É ARITMÉTICA, não balanceamento:** "média −5" é uma diferença **absoluta**, e em termos
relativos ela encolhe — −5 em cima de 27 é −19%, em cima de 56 é −9%. No fim da jornada os dez estão
praticamente no mesmo nível do time, e **10 contra 6 sem cura entre confrontos** é esmagador.
Medido em painel fixo, a mesma coisa por outro ângulo: time ~25 vence **88,4%**, ~45 vence **37,7%**,
~65 vence **14,4%**.

**Se um dia incomodar, as três alavancas estão medidas** (time ~45, com os dois shiny):

| régua | |
|---|---|
| **`VIGILIA_TAMANHO`** (10) | contra 6 são **94,3%**, contra 8 **75,3%**, contra 10 **36,6%** — é a alavanca mais forte, de longe |
| **`VIGILIA_ABAIXO`** (5) | trocar o número fixo por uma FRAÇÃO da média resolveria a desigualdade por trecho de vez |
| **`VIGILIA_SHINIES`** (2) | os dois shiny custam **−13,9 pontos** no nível 45 e **−8,1** no 65 (1,20× em todos os atributos vale ~15 níveis) |

**NA JORNADA, MEDIDO: dentro do ruído.** Conclusão **58,60% sem a mata contra 57,40% com**,
**−1,20 ponto, 1,1σ** — 12 blocos de 500 jornadas de cada lado (**6.000 de cada**), desvio tirado de
ENTRE os blocos. A direção é pro lado difícil (8 de 12 blocos), o que faz sentido: o jogador troca um
encontro selvagem garantido — que rende **duas** capturas — por uma aposta de ~59% que rende **uma**.
**⚠️ E ISSO É UMA LIÇÃO DE MÉTODO:** os **6 primeiros blocos** deram −2,90 pontos e **2,1σ**, o que
pareceria efeito real. Com o dobro da amostra caiu pra 1,1σ. Amostra única não é medição neste
simulador, e meia amostra também não.
**E pra quem NÃO tem o HM01 o preço é zero por construção**: sem ninguém que corte, o card fica
trancado e a rota nunca é escolhida.

- **⚠️ O SMOKE PRECISOU DE DUAS MUDANÇAS PRA ENXERGAR A MATA, e as duas são armadilha de medição:**
  o bot ganhou `--corte` (ele finge um treinador que já ensinou o HM01 e sempre entra na mata), e o
  `currentSaveSlot`/`saveGen` passaram a variar por jornada. **Sem a segunda, as 300 jornadas tinham
  o MESMO perfil de trechos com mata** — a semente é do save — e a primeira medição deu **zero**
  entradas em 300 jornadas sem nada estar errado.
- **⚠️ E O `--corte` FICOU QUEBRADO POR UM COMMIT INTEIRO, EM SILÊNCIO (achado em 16/09/2026).**
  Quando o HM03 entrou, o `podeAprenderCorte` morreu — a lista passou a viver DENTRO do item
  (`podeAprenderHM('hm01', ...)`) —, e o `tools/smoke-jornada.js` continuou chamando a função que
  não existia mais. **O efeito não foi um erro barulhento: toda jornada com `--corte` morria no
  passo 3**, então o smoke devolvia `Falhas: N` e **zero jornadas concluídas dos DOIS lados** —
  qualquer A/B medido com essa flag daria "sem diferença" sem ter medido nada.
  Foi descoberto porque um A/B novo deu `sem=0 com=0` em quatro blocos seguidos, o que é
  impossível — e não porque alguém rodou o smoke: **ele só quebra com a flag**, e a bateria não a
  usa. **A lição é a de sempre aqui, do outro lado: ferramenta de medição quebrada mente calada,
  e um zero perfeito é mais suspeito que um número feio.**
- **Medido a 320px, no navegador:** a lista de TIMES da Máquina fica em **723px** com três cards de
  **114px**, e a de pokémon de um time em **962px**; o card da mata mede **138px** (uma linha a mais que os outros,
  por causa do cadeado), a clareira fica em **988px** com a roda de dez sprites em **duas fileiras de
  cinco**, e a tela do prêmio em **1.879px** (dez cards com a lupa da Pokédex). Nenhuma rola pro lado.

`tools/test-jornada.js` tranca a rota inteira (o sorteio nunca antes do trecho 4, a taxa, a
estabilidade da semente, o cadeado no desenho **e** na ação, o destrave ao voltar da mochila, as três
exclusões dos dez, a média exata, os dois shiny, a espécie batendo com o nível, o prêmio, o time
cheio caindo no Prof. Carvalho e a derrota sem prêmio) e `tools/test-inventario.js` tranca a Máquina
(os 72, as três surpresas da lista, a tela atravessando saves, quem tem vaga, o retirado recusado, e
o slot aberto lendo o `game.team`).

## TMs/HMs DENTRO DO "SEU TIME" (14/09/2026)

Pedido assim: *"quando o usuário clicar no Seu Time, adicione o botão TMs/HMs, e quando clicar,
mostre a lista TMs e HMs que o usuário possui na mochila, e quando ele clicar em algum para usar,
já mostra diretamente os pokemons desse time, sem ele precisar indicar qual time"*.

- **O modal do "Seu time" ganhou DUAS ABAS** (`game.timeModalAba`): o time e as Máquinas. É estado
  de TELA e não entra no save — ninguém volta amanhã querendo o modal aberto na lista de Máquinas —,
  então o `abrirTimeModal` a zera em toda entrada.
- **⚠️ O ATALHO É O PONTO: daqui o jogador já está olhando UM time**, então escolher a Máquina cai
  **direto nos pokémon dele**. A tela de escolher o time existe quando a Máquina é aberta pela
  MOCHILA, onde não há time nenhum em foco; aqui ela seria uma pergunta cuja resposta já está na
  tela.
  Ele **não inventa caminho novo**: o `hmTimeAberto` já é o segundo nível daquela tela, e pôr o slot
  nele faz o `renderHmAlvo` desenhar a lista de pokémon direto.
- **⚠️ "⬅ OUTRO TIME" SOME quando se entra por aqui.** Oferecer a lista de times ali seria devolver o
  jogador exatamente à tela que o atalho existe pra pular. No lugar dele vai um "⬅ Voltar" que leva
  **pra a tela da jornada em que ele estava** — e não pra mochila, que é o destino de quem entrou
  pela mochila. Quem guarda isso é o `hmVoltarPara`, mesmo desenho do `inventarioVoltarPara` e do
  `evolucaoDepois`.
  **⚠️ E ELE ZERA NA ENTRADA do `abrirEnsinarHm`:** um destino sobrando de uma passada anterior
  levaria quem abriu a Máquina pela MOCHILA de volta pra uma tela de jornada — no pior caso, a de um
  save que nem está aberto. Campo de caminho de volta tem que nascer limpo.
- **⚠️ MÁQUINA QUE NINGUÉM DESTE TIME APRENDE FICA APAGADA, COM O MOTIVO** ("ninguém deste time
  aprende") — e não escondida. Escondendo, ela sumia sem explicação pra quem a tem na mochila;
  deixando clicável, o `telaDoTimeDaMaquina` cai no fallback dele, que é **a lista de times**, e o
  atalho vira justamente a tela que ele pula. É a mesma regra do montador: desabilitar dizendo por
  quê é melhor que sumir. **Quem recusa é a AÇÃO**, não só a tela.
  A contagem da linha ("2 podem aprender") é do **time aberto**, não da conta.

### ⚠️ E UMA CRASE NUM COMENTÁRIO HTML MATOU A TELA

No mesmo dia, escrevendo esse modal, escrevi o nome de uma classe **entre crases** dentro de um
comentário `<!-- -->` que vive DENTRO de um template literal. **A crase FECHA a string**, e o que
vem depois vira um template **TAGUEADO**: o `node --check` passa (continua JS válido) e a tela morre
só no navegador, com `(…).btn is not a function`.
O CLAUDE.md já registrava isso num comentário da loja (*"este comentario vive DENTRO de um template
literal, entao ele nao pode ter crase nenhuma"*) — agora a regra é **cobrada**:
`tools/test-inventario.js` varre todo comentário HTML do `index.html` e falha se algum tiver crase.
É o tipo de defeito que o `node --check` não pega e o teste de HTML também não, porque a função
inteira estoura antes de devolver marcação.

- `tools/test-inventario.js` tranca o resto: a frase do aviso **palavra por palavra**, os três
  arredondamentos, o sumiço perto do zero, o CSS maior e a fonte de texto, o botão de TMs/HMs com a
  contagem, a aba listando a Máquina, o atalho caindo no `hmAlvo` com o time fixado, o Voltar
  devolvendo pra jornada, o destino zerando na entrada, e a linha apagada com o motivo. Conferido
  que ele acusa **5 falhas** com os defeitos religados.

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
  **APAGAR A MENSAGEM DEIXOU DE CUSTAR O ITEM (10/09/2026).** Até aqui a notificação de campeão de
  liga ERA o cupom, e apagá-la apagava o bônus shiny da mochila junto — reportado exatamente assim.
  Hoje o servidor **resgata o prêmio pro armazém** (`inventario.bonus_shiny`) antes de a mensagem
  sumir, nos dois caminhos (avulso e em lote), e o jogador ativa pela Mochila — o mesmo lugar de
  onde sai o bônus comprado na loja, então não houve caminho novo pra manter.
  **SÓ O DA LIGA precisava disso**, e vale registrar o que NÃO estava em risco: o **Doce Raro** é um
  contador no documento da conta e notificação nenhuma o carrega; e o prêmio da **Elite** mora no
  SAVE (`eliteShinyGranted` sem `eliteShinyUsed`) e já sobrevivia a apagar a notificação. Resgatar
  o da Elite seria contar o mesmo prêmio duas vezes.
  **O botão EXCLUIR da mochila manda `descartar:true`** e NÃO resgata: ali o jogador está jogando o
  item fora de propósito, e devolvê-lo ao armazém faria o botão não fazer nada. Ele também estava
  **quebrado desde sempre** — mandava `{id}` onde o servidor lê `{notificationId}`, então falhava
  com "Notificação não informada". Os dois defeitos viviam na mesma chamada.
  **O aviso da confirmação deixou de ser de PERDA** e passou a dizer PRA ONDE o prêmio vai. Ele
  fica: foi ver o item sumir da mochila que gerou o relato, e um aviso que assusta sem motivo seria
  tão ruim quanto nenhum.
  `tools/test-notif-premio.js` tranca tudo isso no servidor, com o fake-firestore.
- **A pilha:** cinco doces são **UM** slot com "5x", não cinco slots.
- **⚠️ A GRADE DE QUADRADINHOS SAIU EM 14/09/2026**: a mochila virou uma LISTA com três
  prateleiras, igual à loja — ver **A MOCHILA VIROU A LOJA**. O que este item descrevia (o piso de
  12 slots, o slot com a medida da célula da Pokédex, o vazio como `<div>`) não existe mais.
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
  **O fechamento roda dentro do cron que gera a torre do dia** — evita mais uma função agendada. É
  idempotente pelo campo `awarded`, porque o cron roda de hora em hora. A conta do "dia anterior"
  usa o `trainersLeagueDateStrPlusDays` que já existia: uma segunda regra de data (a minha, em UTC)
  ia discordar da do jogo em algum fuso.
  **MAS ELE NÃO PODE DEPENDER DE QUEM CRIOU A TORRE DE HOJE, e dependia.** A chamada ficava depois
  de um `if(snap.exists) return null` — o cron só fechava o dia anterior quando ELE mesmo criava a
  torre do dia. Só que quem cria a torre do dia também é o `towerGetToday`, no primeiro jogador que
  abre a tela: **o dia vira à meia-noite de São Paulo e o cron passa ~50 minutos depois**, e quem
  abrisse a Torre nessa janela criava a torre de hoje. Na volta seguinte o cron saía pela porta de
  cima, e o dia anterior **nunca** fechava.
  Medido nos dados de produção: torre criada **00:20 em 02/09** e **00:03 em 04/09** (as duas fora
  do cron — não há log de "Torre gerada" nesses dias), e os dias **01/09 e 03/09 ficaram sem
  fechar**. Os dois tinham vencedor, e o ranking geral inteiro tinha **UM dia** contabilizado: o
  02/09, o único em que o cron chegou primeiro. Reportado em 04/09/2026 ("ontem teve um vencedor da
  torre e não foi distribuído o ponto").
  **O cron passou a fechar sempre, e a varrer os últimos `TORRE_DIAS_A_FECHAR` (7) dias** em vez de
  só ontem: um dia que ficou pra trás se recupera sozinho na hora seguinte, sem depender de alguém
  reclamar — foi assim que o 01/09 e o 03/09 foram pagos. Custo: uma leitura por dia por hora, e o
  `awarded` corta na primeira. Fecha do mais VELHO pro mais novo, pras notificações chegarem na
  ordem em que os dias aconteceram, e a frase **nomeia a data quando o dia não é ontem** ("na torre
  de 03/09") — com a varredura, dizer "ontem" ali seria mentira.
  **O `awarded` passou a ser escrito DEPOIS de pagar**, não antes: marcar o dia como pago antes do
  laço fazia um erro no meio dele apagar o resto do pódio pra sempre — a volta seguinte via o
  `awarded` e ia embora. Pagar duas vezes não é o risco, quem trava isso é o `lastPrizeDate` de
  cada treinador, dentro da transação.
  `tools/test-torre.js` cobre isso do jeito que pega a próxima: o jogador abre a Torre ANTES do
  cron (é o `getTrainerTower` que cria o dia), e o teste cobra que o cron feche o dia anterior
  assim mesmo. Conferido que ele falha em 8 casos com o `if(snap.exists) return null` de volta.
- **A batalha do andar tem LOG depois** (`towerBattleResult`, 08/09/2026). Ela voltava direto pra
  torre quando a animação acabava: era a **única batalha do jogo sem log** — a jornada, a Elite, o
  ginásio da cidade, o online e a raide todos têm o seu. A tela traz o log, os dois times e o botão
  de volta pra torre.
  Os dois times saem do LOG (`deriveTeamStatusFromMatchups`): a Torre devolve só os confrontos, sem
  `playerStatus`/`brockStatus` prontos — reusar a tela do resultado de treinador sem derivar
  deixaria os dois quadros vazios. É o mesmo caminho do resultado do Ginásio da Cidade.
  O andar e o nome do NPC vêm do próprio retorno do servidor (`floor`, `npcName`), que já os
  mandava. Quem zerou a torre lê uma frase própria: "o próximo andar já está esperando" seria
  mentira ali.
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

### O TETO DE GOLPES DA TORRE ESTAVA EM 2 NO SERVIDOR (12/09/2026)

Achado investigando um print da Torre. O `MAX_GOLPES` do cliente é **3** desde 09/09/2026, mas o
servidor truncava em **2** em dois pontos do caminho da Torre e do Ginásio da Cidade
(`resolverTimeDosSaves` e a remontagem do time no `fightTrainerTowerFloor`). Ou seja: **quem
escolheu três golpes lutava a Torre com os dois primeiros**, em silêncio — o terceiro sumia.

- **O número solto nos dois lugares era exatamente o que a constante existe pra evitar.** Ela nasceu
  no cliente porque o 2 estava espalhado por nove pontos; aqui o mesmo erro se repetiu do outro lado
  da linha. Hoje o `MAX_GOLPES` existe nos DOIS arquivos e é a **décima tabela duplicada**.
- **Não é o defeito do print** (os números de dano), e é por isso que ele fica registrado à parte:
  foi encontrado lendo o caminho, não medindo o sintoma.

## Batalha Online

- **Dá pra ligar a busca de dentro da jornada** (`botaoBuscaOnlineHtml`). A busca em si SEMPRE foi
  global — ela roda em qualquer tela e o convite aparece por cima do que estiver aberto (ver
  `agendarBuscaGlobal`); o que faltava era poder LIGAR sem ir até a Batalha Online, e aí a jornada
  ficava pra trás. `startOnlineSearchAqui` é a mesma `entrarNaFilaOnline`, só que sem trocar de tela.
  Fica fora da Torre e das ligas de propósito: ali o jogador já está numa disputa organizada.
- **⚠️ SÃO SETE TELAS desde 14/09/2026, e não três.** O bloco (que leva junto o **aviso da Liga**)
  estava só no `preBattle`, no `battling` e no `battleResult` — e a batalha do **rival**, da
  **Rocket**, da **Elite** e da **Vigília** tem renders PRÓPRIOS: são os mesmos três momentos, em
  outra função. Reportado com print: *"não apareceu a mensagem para se inscrever na liga clássica
  naquela tela, porém ela exibe em outras"*.
  **Entrou junto o FIM DA JORNADA**, que é o lugar mais óbvio de todos: quem chega ali acabou de
  fechar as 8 insígnias, ou seja é exatamente quem a Liga aceita — era a única tela que **produz**
  inscrito sem convidar ninguém.
  **⚠️ O DEFEITO ERA DE OMISSÃO**, o mesmo dos banners de intro do mesmo dia: um conjunto espalhado
  por vários renders é onde a próxima se esconde. Por isso o teste cobra o **CONJUNTO** — as sete que
  TÊM e as quatro que **não podem ter** (Torre, ligas, online), senão "acrescentar em todo lugar"
  passaria. E ele confere que os nomes das duas listas existem no arquivo: renomear um render faria a
  trava passar lendo string vazia.
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
- **O aviso da Liga Clássica** aparece embaixo desse botão, e só pra quem AINDA NÃO ESTÁ NA LIGA —
  o que é mais que "não inscrito neste ciclo": quem está disputando um ciclo já sorteado não
  consegue se inscrever no próximo (a própria tela bloqueia), e avisar seria convidar pra uma porta
  fechada. Quem responde isso é o `isAccountActiveInLeague`.
- **⚠️ ELE É UMA CONTAGEM, NÃO UMA HORA, desde 14/09/2026** (a pedido, palavra por palavra):
  *"🏆 Liga Clássica começa em 38 minutos! Inscreva seu time e concorra ao prêmio!"*. Ele dizia
  *"das 14:00"* — e hora é um número que o jogador precisa subtrair de cabeça pra saber se dá
  tempo; o que ele quer saber é **quanto falta**.
  **A CONTA É FEITA NO DESENHO** (`minutosParaALiga`), não guardada: o `atualizarAvisoDaLiga` tem
  folga de 5 minutos porque custa duas leituras, então um número congelado lá erraria por até 5
  minutos. O que fica guardado continua sendo a **hora** do ciclo.
  **⚠️ E O RELÓGIO É O DO SERVIDOR** (`agoraServidor`): o `scheduledTime` é carimbo dele, e
  comparar com o `Date.now()` do celular desloca a contagem inteira — relógio de celular quase
  nunca bate. O teste **lê o código** pra cobrar isso, porque um caso de comportamento passaria com
  os dois.
  **ARREDONDA, não sobe:** faltando 38min05s o certo é dizer 38, e o `Math.ceil` dizia **39** — ele
  sobe com qualquer sobra de segundos. Com `round`, os últimos ~30 segundos caem em zero e **o
  aviso some**, que é o certo: a cópia em memória pode estar velha, e anunciar uma inscrição que já
  fechou é pior que não anunciar. Nunca sai "em 0 minutos" nem "em −3 minutos".
- **⚠️ E A INSCRIÇÃO ACONTECE NO PRÓPRIO AVISO desde 14/09/2026** (a pedido: *"um botão na mensagem
  de aviso para se inscrever... e automaticamente já abre um modal da mesma tela de Escolher time,
  e então ele escolhe e já inscreve automaticamente, sem precisar entrar na tela de liga"*). O
  convite virava uma viagem: sair da batalha, achar as Ligas, achar a Clássica, escolher o time.
  **⚠️ ELA REUSA O `registerForLeague` da tela da Liga, e isso é a decisão**: ali moram a checagem
  das 8 insígnias, o `ensureRegisteringCycle`, a trava de "já inscrito em outra rodada" e a
  transação que impede inscrição dupla. Uma segunda inscrição escrita no modal divergiria dela no
  primeiro ajuste — e o que ela protege é o **chaveamento**.
  O que muda é só **pra onde se volta**: o terceiro argumento (`ficarNaTela`) segura a troca de
  tela, porque daqui o jogador está no meio de uma batalha e tirá-lo dali seria o oposto do pedido.
  **O MODAL É O MESMO CARD da tela da Liga e da home** (a estrela com a média e a fileira de
  sprites): é por ele que o jogador reconhece um time, e um formato próprio obrigaria a reaprender
  a ler no meio da decisão.
  **A CONFIRMAÇÃO É O PRÓPRIO MODAL** ("Inscrito!", nomeando o time). Sem ela, a única pista de que
  deu certo era o aviso sumir — que é exatamente o que acontece quando ele **expira**.
  **O botão só aparece pra quem TEM time campeão:** o aviso nasce pra quem pode se inscrever, mas o
  `timeElegiveisOnline` (que decide se o bloco inteiro sai) e o `savesCampeoes` não são a mesma
  pergunta, e um botão que abre um modal vazio é pior que botão nenhum.
  **E ele não pisca junto com o aviso** (`animation:none`): o pulso é do container e o botão é
  filho, então ele herdava — e um alvo de toque que pisca é mais difícil de acertar.
  **Medido a 320px:** o botão fica em **197×32px**, o aviso vai de 74 para **114px**, o modal em
  **280px** com dois times, e não há rolagem lateral.
- **⚠️ ELE CRESCEU E GANHOU MOLDURA** ("aumente e deixe mais visível"). Era uma linha solta em
  **.55rem da fonte de PIXEL** — que é de título curto e, nesse tamanho, se lê de longe como
  enfeite. Hoje é a fonte de TEXTO (**.8rem**, o corpo do jogo) dentro de uma caixa com borda
  amarela, com a segunda oração um degrau abaixo em peso pra o olho pegar primeiro o que expira.
  **A fonte de pixel saiu de propósito:** a frase tem duas orações e um número que muda a cada
  minuto, e ela come largura demais pra isso.
  **⚠️ E O NEGRITO DELE É BRANCO, não herdado** (reportado no mesmo dia: *"troque a cor azul de Liga
  Clássica e 20 minutos pela cor branca, pois não está dando para ler"*). A regra global do reset,
  `strong{color:var(--blue-dark)}`, **ganha da cor do container** — cor não se herda quando o próprio
  elemento declara a dele —, então as duas partes em negrito, que são justamente o nome da liga e a
  contagem, saíam em azul escuro sobre o fundo escuro da página. Branco e não amarelo de propósito:
  o amarelo já é a cor do resto da frase, e com os dois iguais o negrito deixaria de marcar o que
  importa. É o mesmo remendo que a `.kt-legenda` já fazia, e o teste **lê o CSS** — cor de texto não
  aparece em asserção de HTML nenhuma.
  **Medido a 320px:** a caixa vai de **273×59px** para **281×74px** (+15px de altura), sem rolagem
  lateral. O pulso continua o mesmo do Bônus Shiny da home — é a mesma ideia, uma janela que expira.
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

## AS MOEDAS DAS CONQUISTAS (16/09/2026)

Pedido assim: *"a cada conquista o treinador ganha moeda, entao quando ele conseguir uma conquista e
nao pegar a moeda, fica aquele circulo vermelho com uma exclamação no meio como se fosse
notificação, indicando para ele ir pegar a recompensa. Faça niveis de conquistas, as conquistas
faceis dao menos dinheiro e as mais dificeis dao mais"*.

- **SÃO QUATRO NÍVEIS**, e a escala é o pedido ao pé da letra:

  | | paga | quantas | o que é |
  |---|---|---|---|
  | 🥉 **Fácil** | 10 | 13 | acontece só de jogar (primeira insígnia, primeira evolução, 3 saves) |
  | 🥈 **Média** | 25 | 15 | uma jornada inteira, ou um marco de coleção de verdade |
  | 🥇 **Difícil** | 60 | 30 | várias jornadas, ou um feito duro numa só |
  | 💎 **Lendária** | 150 | 11 | o topo do jogo (a Pokédex fechada, o monotipo, a jornada impecável) |

  **O bolo das 69 é 🪙 3.955 — 56,5 jornadas completas** (a jornada paga 70).
- **⚠️ O TESTE NÃO TRANCA OS VALORES, ele tranca a ESCALA.** Fixar 10/25/60/150 ali faria o teste
  virar uma cópia da tabela: todo reajuste passaria a exigir editar dois lugares e o teste não diria
  nada sobre a regra. O que ele cobra é `facil < media < dificil < lendaria`, que É o pedido — um
  "difícil" pagando menos que um "fácil" é o único jeito de isto estar errado.

### ⚠️ QUEM PAGA É O SERVIDOR, E ISSO CUSTOU A MAIOR DUPLICAÇÃO DEPOIS DO MOTOR

As regras do Firestore não deixam o cliente escrever `moedas` — é a mesma trava que existe pra o
console não virar shiny à vontade. Só que **o servidor não sabia o que é uma conquista**: a tabela
das 69 e o agregado que as alimenta viviam só no `index.html`.

Então os dois foram portados pro `functions/index.js`. Confiar no que o cliente mandasse seria **uma
linha no console valendo o bolo inteiro**.

- **AS 69 CHECKS FORAM COPIADAS, não redigitadas** — redigitar 69 funções é garantir que uma
  divergisse. O que não veio é o que o servidor não tem: ícone, nome e descrição.
- **⚠️ E O `dex` TEVE QUE ENTRAR NO `SPECIES` DO SERVIDOR**, porque quatro conquistas contam Kanto
  contra Johto e ele não tinha o número. Foi acrescentado um CAMPO à tabela que já era duplicada, e
  não criada uma segunda tabela só pro número da Pokédex.
  **A ordem das duas cópias do `SPECIES` é idêntica (conferido, 0 divergências), mas `dex` NÃO é a
  posição** — a tabela é por linha evolutiva, então o Charmander é o 2º e o dex dele é 4. Derivar
  da posição daria errado em 247 das 250.
- **⚠️ O TESTE COMPARA POR COMPORTAMENTO, e não por texto.** Comparar o texto das duas tabelas não
  provaria nada: elas foram geradas uma da outra, então passariam iguais **mesmo com os AGREGADOS
  divergindo** — que é onde o risco de verdade está, porque o cliente monta o dele do `game` e o
  servidor dos documentos. A trava sorteia **400 contas** (saves, Pokédex, flags) e cobra que os
  dois destravem o MESMO conjunto e que nenhum campo do agregado difira. Conferido que ela acusa:
  zerar o `shinyCount` do servidor derruba 396 dos 400.

### ⚠️ AS CINCO CONQUISTAS DE LIGA DEPENDEM DE UMA MIGRAÇÃO, E ISSO SE RESOLVE SOZINHO

Elas saem das flags `anyChampion`/`anySemifinal`/... gravadas na conta. Conta que **ainda não foi
migrada** (`achievementFlagsMigrated`) tem as cinco como falsas no servidor — e o cliente, que faz o
escaneamento completo, as mostraria como ganhas.

Isso não vira defeito porque **quem migra é a própria tela de Conquistas**, que é de onde o resgate
é pedido: abrir a tela migra, e o clique seguinte já paga. O erro é sempre pro lado de **não pagar
agora**, nunca pro de pagar duas vezes.

### O CÍRCULO VERMELHO

- É o **MESMO `.notif-badge`** do sino, do card de Amigos e do botão das Ligas — um sinal que o
  jogador já sabe ler como "tem coisa aqui". O `.home-menu-icon` já era `position:relative`, então
  ele nasceu ancorado no card certo.
- **Ele NÃO conta quantas faltam**, e é decisão: o número de conquistas pendentes **não é** o número
  de moedas, e um "12" ali seria lido como 12 moedas. Quem diz o valor é a tela de destino.
- **⚠️ E ELE SÓ ACENDE DEPOIS QUE A CONTA CARREGA** (`contaCarregada`), pela mesma razão da porta dos
  modos de campeão: o `achievementsPaid` nasce vazio e os saves nascem em 20 nulos — antes da
  leitura **tudo pareceria por resgatar**, e o círculo apareceria numa conta que já pegou tudo.
  Há trava pra exatamente isso, e ela acusa com a guarda removida.

### O RESGATE

- **É UM BOTÃO SÓ, não um por conquista.** Por conquista seriam N idas ao servidor pra uma ação que
  é uma só — a mesma conta que fez o apagar-em-lote das notificações existir.
- **O SERVIDOR RECALCULA TUDO**: o que vai do cliente é o PEDIDO, não a lista. Ele lê os saves e a
  conta, descobre o que está ganho, desconta o que já foi pago e paga a diferença — o mesmo desenho
  do `claimJourneyCoins`. É isso que faz o número desenhado na tela ser só uma **previsão**.
- **⚠️ OS SAVES SÃO LIDOS FORA DA TRANSAÇÃO, de propósito.** Ler uma coleção dentro dela pra depois
  escrever só no documento da conta não compra nada, e **conquista só CRESCE**: um save que mudou
  entre a leitura e a gravação no máximo adia uma conquista pro próximo resgate. O que a transação
  protege é o par (já pago, saldo), que é onde duas abas se atropelariam.
- **`achievementsPaid` ENTROU NA TRAVA DO `firestore.rules`**, e ela importa pelo lado que NÃO é
  óbvio: escrever pra MAIS ali não paga nada (o servidor só paga o que está ganho de verdade), mas
  **ZERAR a lista pelo console faria o bolo inteiro ficar resgatável de novo**, quantas vezes
  quisessem.
- **O prêmio aparece na linha da conquista TRANCADA também**, e isso é o que faz o nível ser a
  feature: é ele que diz por que vale a pena ir atrás daquela. Escondido até destravar, o número só
  existiria depois de já não decidir mais nada.

### ⚠️ O RETROATIVO É A DECISÃO DESTA FEATURE, E ELE ESTÁ MEDIDO

Conquista já desbloqueada **entra como resgatável** — é a leitura literal do pedido ("quando ele
conseguir uma conquista e não pegar a moeda"), e uma conta que tem 43 delas ganhou as 43.
Isso **contraria o precedente do `claimJourneyCoins`**, que decidiu não pagar retroativo; lá o
motivo era 70 moedas caindo do céu sem o jogador fazer nada, e aqui a feature INTEIRA é "vá pegar o
que você já ganhou".

**O que cada perfil pega no primeiro clique** (perfis construídos — não há dado de produção nesta
sessão —, cada um um ponto real da progressão):

| perfil | conquistas | resgate | em jornadas |
|---|---|---|---|
| começando (1 save, 2 insígnias) | 4/69 | 🪙 **40** | 0,6 |
| uma jornada inteira (8 insígnias + Elite) | 20/69 | 🪙 **505** | 7,2 |
| veterano (3 saves, 2 campeões, liga vencida) | 43/69 | 🪙 **1.560** | **22,3** |
| tudo (as 69) | 69/69 | 🪙 3.955 | 56,5 |

**Os 1.560 do veterano num clique são o número a olhar.** Ele compra 5 Doces Raros, ou enche o teto
de re-sorteio de quatro saves. Se incomodar, a régua é o `NIVEL_DA_CONQUISTA` — **dividir os quatro
valores por 2 divide o retroativo por 2**, e o teste continua verde porque ele cobra a escala, não
os números. Se a intenção for que o passado NÃO pague, é fazer o primeiro resgate de uma conta
carimbar `achievementsPaid` sem creditar — o mesmo ramo que o `claimJourneyCoins` usa.

- **Medido a 320px, no navegador:** a coluna do prêmio mede **43px**, nada quebra em duas linhas,
  nenhum nome trunca, e não há rolagem lateral. O botão de resgatar fica em 52px.
- **⚠️ E O `tools/fake-firestore.js` GANHOU `arrayUnion` por causa disto** — é assim que a lista de
  já-pagas é gravada, e sem ele a callable morria com *"arrayUnion is not a function"*. É a mesma
  família do `increment` dentro de mapa, do `FieldPath.documentId()` e do `getAll` da transação:
  **o fake tem que aprender o que o SDK de verdade faz, senão o teste dá verde e a produção**
  **quebra** (ou, como aqui, o contrário — a produção funcionaria e só o teste não rodava).
  Ele foi escrito pra **só CRESCER**, que é o que o `arrayUnion` é: é a única escrita de lista que
  não pode encolher, e foi por não ser assim que a Pokédex de um jogador perdeu 49 espécies.
- **A trava de PONTA A PONTA roda a callable de verdade** contra o fake: o primeiro resgate paga, o
  **segundo seguido não paga nada** (um duplo-clique viraria moeda de graça), uma conquista nova
  depois paga só a diferença, a lista de pagas só cresce e não repete id, sem login recusa, e conta
  vazia não quebra. Sem ela, o que estava testado eram as PEÇAS — e o risco mora na escrita.
- `tools/test-conquistas.js` tranca 33 pontas: os quatro níveis com dono, a escala crescente, as
  duas tabelas iguais em id/nível/valor, os **dois agregados idênticos em 400 contas sorteadas**, o
  resgate pagando a diferença, id de conquista removida valendo zero, o aviso acendendo e apagando,
  a guarda do `contaCarregada`, e a tela (botão com valor, prêmio nas 69, prêmio na trancada,
  o ✓ depois de pago).

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

## OS GOLPES ESCOLHIDOS CHEGAM NA LIGA E NO ONLINE (16/09/2026)

Reportado assim: *"o sanguessuga e outros ataques de absorver não estão curando nas batalhas das
ligas onlines. Verifique se tudo que tem nas batalhas da jornada está na mecânica da liga online"*.

**Era verdade, e a causa era UMA só:** o time da liga vem de um **CÓDIGO** (`especie:nivel:shiny`),
que não carrega golpe. Sem golpe escolhido o `melhorAtaque` devolve null, o motor cai no de tipo, e
**três mecânicas simplesmente não existiam lá**.

**A AUDITORIA, medida** (300 batalhas 3x3, mesmo elenco e mesmas sementes dos dois lados):

| | jornada | liga (antes) |
|---|---|---|
| confrontos **com golpe escolhido** | 1.081 | **0** |
| **CURA por drenagem** | 225 | **1** |
| **golpe de vários tapas** | 218 | **22** |
| **Rolamento escalado** | 40 | **0** |
| sono, confusão, anulação, fúria, explosão, danças, Remoinho | ✓ | ✓ (iguais) |

**⚠️ O "1" E O "22" SÃO O METRÔNOMO, e é por isso que a trava compara proporção e não "zero contra
alguma coisa":** ele sorteia entre TODOS os golpes de dano do jogo, então era a **única porta** por
onde um drenante ou um multi-tapa entrava numa liga sem golpe escolhido.

**O resto do bloco de especiais já valia**, e isso é por construção: os três caminhos chamam o MESMO
`doExchange`. O que muda entre eles é só **como o time chega**.

### O CONSERTO: OS GOLPES VIAJAM AO LADO DO CÓDIGO, NUNCA DENTRO DELE

Este arquivo já apontava o lugar, na seção do que foi medido e não mexido: *"o conserto tem
precedente pronto: os `slots` já viajam dentro do match e são carimbados depois do `decodeTeamCode`
— os golpes cabem no mesmo lugar, sem tocar na trava anti-falsificação do código de time"*.

- **O código continua `especie:nivel:shiny`** e o `decodeTeamCode` continua recusando um quarto
  campo. Ele é a trava anti-falsificação; o que viaja ao lado dele é o que ele recusaria.
- **⚠️ A CHAVE É `espécie:nível`, NÃO a posição** (`chaveDosGolpes`, nos dois motores). Por posição
  isto quebraria na **Trainers League**, que é o modo que mexe na lista: ela deixa o jogador
  **REORDENAR** o time da rodada (o override) e **ACRESCENTA** o código do Mewtwo emprestado ao
  sorteio. Nos dois casos o índice desanda e cada pokémon luta com o moveset de outro — um defeito
  que não aparece como erro, aparece como **um Snorlax batendo de Raio Solar**.
  Ela é única dentro de um time pelo mesmo motivo que a chave do item equipado é: um save não tem
  duas da mesma espécie. E o **nível entra na chave** porque o Doce Raro sobe nível, e nível novo
  pode ter destravado golpe novo — sem ele, um time repropagado casaria com os golpes de antes.
- **⚠️ E O SLOT CONTINUA SENDO POR POSIÇÃO**, de propósito: ele diz de que SAVE veio aquele pokémon,
  e dois saves podem ter a mesma espécie no mesmo nível — por espécie:nível eles colidiriam.
- **UM CARIMBO SÓ** (`carimbaDoMatch`). O `carimbaSlots` estava **copiado palavra por palavra** no
  `resolveLeagueMatch` e no `resolveTrainersLeagueMatch`, e os golpes seriam a terceira e a quarta
  cópia. Duas já divergiriam no primeiro ajuste; quatro é garantia. O cliente tem a função também,
  porque ele **TAMBÉM resolve partida de liga** — sem ela a mesma partida daria resultado diferente
  conforme quem a resolvesse primeiro.

### ⚠️ O SERVIDOR NÃO CONFIA NO QUE CHEGA

Código de time é dado de cliente, e agora os golpes viajam ao lado dele: **sem validação, uma linha
no console poria Hiper Raio em tudo.** O `golpesValidos` reconstrói o que aquela espécie **naquele
nível** pode ter e fica só com a interseção. Medido, com uma lista forjada de sete golpes fortes:

| | aceita |
|---|---|
| Caterpie Lv.5 | **nada** |
| Machamp Lv.70 | **nada** |
| Blastoise Lv.70 | só o `surf` (ele é surfista) |
| Snorlax Lv.70 | `hyperbeam` (ele aprende) e `surf` |

O que sobra de um time forjado é **o motor de tipo** — ou seja, exatamente o que a liga fazia antes
desta mudança. Errar pro lado de TIRAR o golpe é o certo aqui.

- **⚠️ AS LISTAS DE HM FORAM DUPLICADAS PRO SERVIDOR** (`CORTADORES`, `SURFISTAS`), e elas vieram
  por um motivo só: **HM ninguém aprende por nível**, então o `APRENDIZADO` não os conhece e sem as
  listas o Surf de um Blastoise sumiria na liga. O teste compara as duas cópias com as do cliente.
- **⚠️ A TRAINERS LEAGUE NÃO PRECISA CONFIAR NO CLIENTE, e não confia:** ela é a única em que o
  **servidor já lê os saves** (`trainersLeagueGatherEligibleCodesForUid`, no refresh automático de
  5 min antes de cada rodada). Os golpes dela saem **do save**, server-derived — não há o que forjar
  e não há o que validar. É também a que tem ranking.
- **⚠️ O QUE FICA EM ABERTO, e é decisão registrada:** na Clássica, nas customizadas e no online o
  servidor valida a **espécie**, mas não tem como saber se a conta **possui o HM**. Ou seja, um
  cliente forjado consegue dar Surf a um surfista sem ter feito a Zona de Safári. O ganho é
  limitado (95 de poder, num bicho que quase sempre já aprende coisa mais forte por nível) e a
  barreira da espécie continua de pé. Se um dia importar, o caminho é ler `users/{uid}.hms` — uma
  leitura a mais por time, longe de quem jogou.

### O QUE MUDOU, MEDIDO

**No caminho REAL da liga** (`resolveLeagueMatch`, 300 partidas 3x3, mesmas sementes):

| | antes | depois |
|---|---|---|
| confrontos com golpe escolhido | 0 de 249 | **239 de 239** |
| CURA por drenagem | 0 | **50** |
| golpe de vários tapas | 0 | **292** |

**⚠️ E O PREÇO É GRANDE NO RESULTADO E NULO NO EQUILÍBRIO** (3.000 partidas 6x6 Lv.70, mesmos times
e mesmas sementes): **31,8% das partidas trocam de vencedor**, e a taxa de vitória geral quase não
se move — **49,70% → 48,93%**. Faz sentido, e é a assinatura de uma mudança **simétrica**: os dois
lados ganham os golpes ao mesmo tempo.

**Por espécie o efeito é de ±6 pontos**, e ele diz quem estava sendo mal representado pelo motor de
tipo: **Scizor −6,4**, **Espeon +6,0**, **Lapras +6,0**, **Venusaur +5,7**, **Dragonite −4,2**.

**⚠️ ISSO NÃO É UM AJUSTE DE BALANCEAMENTO — é a liga passar a jogar o MESMO jogo que a jornada.**
Um jogador que passou a jornada inteira escolhendo três golpes por pokémon não via **nada disso** na
competição: era esse o defeito.

- **O BOT DA LIGA GANHOU MOVESET** (`equiparNpc`-style, o que a espécie aprende por nível). Até aqui
  "todo mundo sem golpe" era igual pra todos; a partir desta mudança um bot sem golpe seria o único
  time em desvantagem. Ele não ESCOLHE — leva o que a espécie tem, a regra de todo NPC do jogo.
- **INSCRIÇÃO VELHA CONTINUA VALENDO**: sem o campo, o time luta no motor de tipo, exatamente como
  lutava. O mesmo vale pra ginásio de cidade tomado antes desta data e pra cliente antigo em cache.

### O QUE CONTINUA DIFERENTE, E É DECISÃO

- **O REMOINHO não existe no ONLINE** — e ele **existe nas ligas** (medido: 37 na jornada, 35 na
  liga). A diferença é estrutural: as ligas passam pelo `simulateGymBattle`, que tem o laço da
  batalha; o online resolve **confronto a confronto** pelo `battleResolveMatchup`, que chama o
  `doExchange` direto. E é o único lugar onde ele **não poderia** existir: ali quem escolhe o
  pokémon ativo é o JOGADOR, e um sopro desfaria a escolha que a pessoa acabou de fazer.
- **OS ITENS EQUIPADOS continuam fora** da liga e do online, pelos motivos já registrados na seção
  deles (a liga é resolvida horas depois; no online seria vantagem de um lado num PvP).
- **O TERRENO não existe no online** — lá não há terreno escolhido.

`tools/test-liga-treinadores.js` tranca 30 pontas: a chave por espécie:nível (inclusive com o mapa
fora de ordem, que é o caso da Trainers League), o nível na chave, a validação contra time forjado,
os HMs passando por espécie, as duas listas iguais nos dois motores, **a mesma função de chave nos
dois**, o caminho real da liga antes e depois, o online (`battleInstances` validando na entrada e
`battleHydrate` devolvendo), o slot continuando por posição, o carimbo único nos quatro resolvedores
e o moveset do bot. Conferido que desligar o carimbo acusa 3, a validação 4, a chave divergente 5 e
a reidratação do online 1.

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

### UM `undefined` MATOU AS DUAS LIGAS — E MANDOU 376 NOTIFICAÇÕES (13/09/2026)

Reportado com print: *"está mandando notificação seguidas para o vencedor da trainers league"*.
Eram **285 mensagens idênticas** numa conta e **91** na outra, **uma por minuto**, começando às
15:06 e sem parar. E o estrago real era maior que o incômodo: **a liga de 13/09 nunca terminou**.

São **TRÊS defeitos em fila**, e o que assusta é que a bateria inteira estava VERDE.

- **⚠️ 1) A CAUSA: `chuva: comChuva || undefined` no registro do confronto.** O Firestore **RECUSA**
  `undefined` — e recusa a GRAVAÇÃO INTEIRA, não o campo:
  `Cannot use "undefined" as a Firestore value (found in field matchups.\`0\`.chuva)`.
  **No CLIENTE isso é inofensivo** (o `JSON.stringify` some com a chave), e foi por isso que passou:
  a linha é a MESMA nos dois motores, mas só um dos dois grava aquilo num banco. O log da liga vai
  pro Firestore (`matchLogs`), e desde a Dança da Chuva (11/09) **toda gravação de log de liga
  falhava**. Hoje é `!!comChuva` nos dois — um booleano não tem como virar undefined.
  **Alcance medido em produção:** as duas ligas, desde 11/09. Os dias 11 e 12 não tinham inscrito
  nenhum (`scheduleRounds: []`), então **13/09 foi a primeira partida de verdade depois da chuva** —
  e ela morreu. O ciclo ficou com `status: locked`, `resolved: false` e a subcoleção `matchLogs`
  **vazia**, que foi a prova.
- **⚠️ 2) O DILÚVIO: a notificação era criada ANTES da gravação.** Falhando o `ref.set`, o `catch`
  devolve o ciclo pra `locked`/`drawn` — e o agendador, que roda **de minuto em minuto**, refaz a
  passada inteira: resolve de novo, notifica de novo, falha de novo. 86 voltas em 85 minutos.
  **A regra que ficou: nada é anunciado antes de o estado que o justifica estar salvo.** As duas
  ligas juntam os avisos numa lista (`avisosDePartida` / `pendingMatchNotices`) e só mandam depois
  do `set` — que é o padrão que a Liga Clássica já usava pro campeão, pra colocação e pra sequência.
  Note que o defeito 1 só transformou isto em desastre; **a ordem errada estava lá desde sempre**, e
  qualquer falha futura de gravação faria o mesmo.
- **⚠️ 3) E O AVISO DE PARTIDA DA TRAINERS LEAGUE NUNCA SAÍA QUANDO DAVA CERTO.** A condição
  `if(match.matchups && ...)` — que existe pra pular W.O./bye — era lida **DEPOIS** do
  `storeMatchLogAndStrip`, e é ele quem **zera** o `matchups` ao conseguir gravar o log (é pra isso
  que ele existe). Ou seja: log gravado ⇒ campo nulo ⇒ ninguém avisado. **As únicas notificações de
  partida que essa liga já entregou foram as 376 do incidente**, e elas chegaram porque a gravação
  estava falhando. Hoje a pergunta é feita antes (`houveLuta`).
- **⚠️ E O `await` QUE FALTAVA EXPLICA OS NÚMEROS DESIGUAIS.** `createNotification` era chamado sem
  `await`, "de propósito, pra não atrasar o avanço da liga". Numa Cloud Function isso é uma promessa
  solta: quando a instância é encerrada, o que ainda não foi enviado morre. Por isso o **lado A**
  (chamado primeiro) ficou com **285** e o **lado B** com **91** — o mesmo laço, a mesma quantidade
  de voltas. Hoje os avisos saem fora do laço de resolução e **com `await`**.

**O QUE TRANCA A PRÓXIMA, e é a parte que importa:** `tools/fake-firestore.js` passou a **RECUSAR
`undefined`**, recursivamente, como o Admin SDK de verdade. Ele clonava com
`JSON.parse(JSON.stringify())` — que **descarta** undefined em silêncio —, então o fake aceitava
alegremente um documento que a produção recusa. Era esse o buraco: nenhum teste escrevia um log de
batalha REAL no banco, e o campo estava a três níveis de profundidade (`matchups[0].chuva`), que é
exatamente onde ninguém olha.
`tools/test-liga-treinadores.js` cobra as quatro coisas, e foi conferido que cada defeito religado
derruba o teste: o log de uma batalha de verdade cabendo no Firestore (com a mensagem de erro
idêntica à de produção quando não cabe), o ciclo fechando o dia, **UM** aviso de cada lado no
caminho que dá certo, e **ZERO** aviso depois de três passadas do agendador com a gravação
recusada. Varrido também o motor inteiro: 600 batalhas, 5.313 confrontos, as 250 espécies — nenhum
valor que o Firestore recusaria.

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
  ESPÉCIE, não sobre um bicho.
- **O nome continua "Unown"**, sem a letra. No original é assim, e o glifo já é a identidade.

`tools/test-jornada.js` tranca 37 pontas: a tabela, os sufixos (com a letra A explicitamente vazia),
as URLs nos dois domínios, a letra não vazando pra outra espécie, o `spriteHtml` com instância e com
id, a precedência do shiny explícito, a semente (mesma semente = mesma letra, 400 sementes = 28
formas), a captura levando a letra, o save e a reidratação, a Vigília e o prêmio dela, e os clones.
**Conferido que cada um dos sete defeitos religado derruba o teste** — inclusive o `201-a.png`.

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
