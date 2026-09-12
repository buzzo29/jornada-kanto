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
  Aerojato, Golpe Cruzado, Martelo de Caranguejo, **Corte** (22 espécies, o de peso real),
  Corte de Ar, Folha Navalha e Golpe de Karatê.
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
  Metrônomo são **6 desde 11/09/2026** (Cleffa, Clefairy, Clefable, Mew, Togepi, Togetic).
  Eram 4 (Togepi, Togetic, Cleffa, **Snubbull**), viraram 7 em 10/09 quando a decisão de deixar
  Clefairy/Clefable/Snorlax de fora — "espécies comuns em time de jogador e de líder" — foi
  revertida a pedido, e o Snubbull saiu. **O SNORLAX SAIU EM 11/09**, também a pedido: a lista era
  a alavanca que esta seção já apontava, e ela foi usada.
  Ver a seção **O METRÔNOMO SORTEIA E DEPOIS ESCOLHE**, que é onde a mecânica está descrita.
- **O sono dá UMA TROCA livre, não mata mais** (`SONO_EM_TROCAS = 1`). O alvo apanha sem revidar e
  então acorda; a luta segue normal. Como o Disable e a Recuperação, é `continue` e não
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
  confusão, 7 Fúria do Dragão, 1 Sketch e 13 Dança da Chuva, com sobreposição. O teste varre as
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
- **O nome em PORTUGUÊS vive em `tools/golpes-pt.json`, e são 158.** O arquivo da base traz só o
  nome canônico em inglês — os nomes PT que o jogo já usava (`MOVE_BY_TYPE`, `MOVE_OVERRIDES`)
  são por TIPO e não por golpe, então a passada foi à mão, uma vez. A Gen 3 acrescentou **37**
  (Ás Aéreo, Vento Prateado, Pulso de Água, Quebra-Telha, Cauda de Ferro...). Golpe de dano sem
  nome ali sai no log e nas telas com o **id em inglês**, então o gerador de tabelas é quem tem
  que gritar se faltar.
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
- **NÃO valem nas ligas nem no online**, e é de propósito: lá o time é um **código**
  (`especie:nivel:shiny`), o `decodeTeamCode` recusa um quarto campo e o `sanitizeTeamCode` existe
  justamente pra apagar o que não está no código. Ali a batalha continua exatamente como é hoje, no
  motor de tipo. Mexer nisso é mexer na trava anti-falsificação do código de time.
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
  São os **155 golpes de dano** da tabela. Autodestruição e Explosão não estão nela (nunca
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
- **ELA MORA NA FICHA DA POKÉDEX, não no cartão do golpe** — e essa é a diferença que importa: quem
  escolhe golpe não escolhe passiva. O cartão do golpe Fúria **não diz mais nada** (o `obsDoGolpe`
  dela saiu), e a ficha da espécie a anuncia junto do sono e da anulação, com a chance.
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
  mesma frase é a parede que o `TETO_GOLPES` existe pra evitar.
  **O SELO DELA É CLICÁVEL, e é o ÚNICO selo clicável do jogo** (`seloDeChuvaClicavel`). Tem o mesmo
  tamanho e a mesma cor dos outros — foi o que se pediu —, e o que muda é ser um `<button>`, que
  precisa zerar a borda e o padding de fábrica. Ele abre a MESMA caixa de explicação dos especiais:
  a pergunta que ele levanta ("por que meu Fogo tirou metade?") é a que a caixa já responde.
  O `<button>` é válido ali porque a linha do log é uma `<div>` — a armadilha do `<button>` dentro
  de `<button>`, que já custou dois defeitos neste projeto, não existe neste caminho; se um dia a
  linha do log virar clicável, é este o lugar que quebra.
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
- **O Ginásio da Cidade descarta os golpes na ida pro servidor**: `resolverTimeDosSaves` devolve
  `ataques`, mas o time vira um **código** (`especie:nivel:shiny`) uma linha depois, e a batalha
  decodifica dele. Ou seja, a linha deste arquivo que diz que os golpes valem lá **não é verdade
  hoje**. O conserto tem precedente pronto: os `slots` já viajam **dentro do match** e são
  carimbados depois do `decodeTeamCode` (`carimbaSlots`) — os golpes cabem no mesmo lugar, sem
  tocar na trava anti-falsificação do código.
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
- **UM GOLPE DE VÁRIOS TAPAS É UM GOLPE SÓ PRO TETO** (`TETO_GOLPES`): só o primeiro tapa ocupa
  vaga. Sem isso um Tapa Duplo de 5 sozinho estouraria o teto e jogaria o confronto inteiro na
  reconstrução. E eles **se movem juntos** no reordenamento do moribundo — reordenar entrada a
  entrada partiria o golpe ao meio, com metade antes e metade depois do golpe que o derrubou.
- **ELES SOBREVIVEM À RECONSTRUÇÃO, e isso é o que faz a feature existir.** A reconstrução devolve
  golpes inteiros e não conhece tapa nenhum: medido, sem tratar isso os tapas só apareciam em
  **28,8%** dos confrontos — nos outros a luta passava do teto e o mesmo golpe às vezes contava e às
  vezes não, que é indistinguível de bug pra quem joga. Hoje o `expandirTapas` reparte o golpe
  reconstruído no número de tapas que SAIU DE VERDADE naquele confronto (lido do diário, não é
  sorteio novo) e a visibilidade vai a **100%**. O total não muda, então a soma das linhas continua
  fechando. Golpe pequeno demais pra repartir (menos de 1 de dano por tapa) fica inteiro — passo de
  dano 0 é o que este log evita em toda regra.
- **NO ONLINE E NAS LIGAS ELE NÃO ACONTECE**, e não é exceção nova: lá o time vem de um CÓDIGO
  (`especie:nivel:shiny`) e não carrega golpe escolhido, então `lastMove` é null e o motor cai no
  de tipo. É a mesma regra que já valia pros golpes escolhidos.
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
- **Na RECONSTRUÇÃO a linha não aparece**, e é o limite conhecido: passando do `TETO_GOLPES` ela
  substitui a lista inteira e não conhece desempate nenhum — do mesmo jeito que não conhece cura.

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

## Log de batalha

- O matchup carrega **`golpes`**: o diário do confronto, um registro por golpe na ordem real,
  escrito por `doExchange`. Não é reconstrução — o motor anota enquanto luta. Só apresentação:
  passar ou não o array não muda um ponto de dano (conferido por hash, 14.645 confrontos).
- **O dano gravado é o EFETIVO, não o sorteado.** Golpe de 101 em quem tem 54 de HP entra como 54.
  Com o valor cru o log não fechava: somando as linhas dava mais dano do que o pokémon tinha.
- **Log e animação leem a MESMA lista** (`sequenciaDoConfronto`). Enquanto eram montadas em separado,
  o jogador via 3 golpes na tela e lia 4, 7 linhas no log — reportado três vezes.
- **O TETO É DE 4 GOLPES desde 11/09/2026** (`TETO_GOLPES`, era 3 — a pedido), e ele vale por
  leitura: uma luta comum tem que caber em poucas linhas. Medido, 99,4% dos confrontos passam de 3
  golpes REAIS (mediana 4, 90% até 6, maior 28 em 3.944) — ou seja, o teto não é um detalhe, é ele
  que decide o que a tela mostra quase sempre.
  **O QUE A SUBIDA COMPRA É A VERDADE, e o número é grande:** os confrontos que o jogador lê como
  uma divisão INVENTADA pela reconstrução caem de **36,9% pra 11,9%** (11 mil confrontos de cada
  lado, o mesmo código com a constante trocada). A causa é direta — 4 golpes reais é o caso mais
  comum de todos, e no teto 3 ele caía inteiro na reconstrução.
  **O QUE ELA CUSTA É TEMPO DE TELA:** a animação de uma batalha 6x6 vai de **46,9s pra 49,8s**
  (+2,9s, +6,2%) e os passos por confronto de 2,63 pra 2,93. No log, as lutas de 4 linhas passam de
  4,9% pra **24,6%**.
  **NA DIFICULDADE, NADA — por construção.** `TETO_GOLPES` é apresentação: ele não existe no
  servidor e não entra em conta nenhuma de dano. Conferido por impressão: o mesmo build com 3 e com
  4 dá o MESMO hash de resultado em 900 batalhas semeadas.
  **Ele chegou a sair inteiro por um dia** (03/09/2026), pra o log mostrar o diário: uma troca banal
  de Gloom contra Miltank virou **seis linhas** e foi reportado com print. Voltou no mesmo dia.
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
  de ordem entre uma troca e outra e o mesmo lado bate duas vezes de fato. Medido: **0,5% dos
  confrontos** têm isso no DIÁRIO, e a tela mostra **0,2%** — menos, porque o reordenamento do
  moribundo desfaz parte.
  **É por isso que a trava mudou de forma.** Ela era "ninguém ataca duas vezes seguidas no diário
  real", e isso era verdade **por acidente**: com o teto em 3, todo confronto de 4 golpes caía na
  reconstrução e o diário nunca chegava à tela. Hoje ela é **comparativa** — a apresentação não pode
  CRIAR colagem que o diário não tinha. Exigir zero puniria o motor por dizer a verdade; exigir "não
  criou" pega de volta exatamente o defeito que o teto escondia.
  **E ela não pode ser estatística:** a primeira versão cobrava "a tela mostra MENOS que o diário"
  (23 contra 42 na média, 2,4σ) e falhava sozinha **~1 vez em 100** — o pior tipo de teste que
  existe, o que passa quase sempre. Hoje cobra "não mais", que é verdade por construção.
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
  **Quem contar rota por rota, conte FORMAS.** Ainda ficam abaixo de 10: Dojo Lutador (7), Usina de
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
  mesmo `TETO_GOLPES`.** A luta corre normal até o pokémon chegar a zero, a Faixa o devolve a 1,
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
- **⚠️ O BOTÃO DA MOCHILA ESTÁ ESCONDIDO PRA TODO MUNDO desde 12/09/2026** (a pedido: *"esconda o
  botão na mochila de tm/hm para todos"*). Quem manda é o **`MOSTRAR_TM_HM`**, e ele é uma
  constante e não uma remoção porque o pedido foi "esconda", não "tire".
  **O QUE CONTINUA DE PÉ:** o HM01 é conquistado na jornada do mesmo jeito (a rota do S.S. Anne
  mais o Surge sem derrota), é anunciado na tela de vitória, e continua guardado em
  `users/{uid}.hms` — nada disso passa pelo botão. O `case 'tmhm'` do render fica também: sem ele,
  o dia em que o botão voltar começa com uma tela em branco.
  **Voltar a mostrar é ESSA LINHA.** O teste LÊ a constante em vez de só procurar o botão, então no
  dia em que ela virar `true` ele acompanha sozinho — ninguém precisa lembrar de mexer lá.
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
- **A TELA DE TMs E HMs É SEPARADA DA GRADE**, e isso é decisão: TM e HM **não empilham, não se
  gastam, não se vendem e não se usam dali** — todas as regras da grade são falsas pra eles.
  Misturá-los poria coisas de regras diferentes no mesmo quadradinho, que é o incômodo que o Doce
  Raro já cria sozinho. E ela **escala**: são 301 golpes na base, então a lista de TMs vai crescer —
  a grade de ícones já não dava conta de 11 itens na loja.
  Ela tem **dois estados e nenhum é mudo**: lista o que a CONTA tem, e sem nenhum **diz onde achar**.
  (Havia um terceiro — "abra um save pra ver os dele" — e ele sumiu quando o HM deixou de ser do
  save: a mochila aberta da home mostra os mesmos.)
- **⚠️ O GOLPE `cut` NÃO EXISTE NA TABELA DE GOLPES**, e isso não é esquecimento nem bug: a base é
  aprendizado por **NÍVEL** da Gen 3, e HM ninguém aprende por nível — o gerador nunca o viu. É o
  mesmo motivo do `surf`, que o teste do Sketch já tinha encontrado.
  **Isso é o que confirma o desenho "HM = ITEM, não golpe"**: não há golpe pra apontar. E se um dia
  se quiser o Corte como golpe de batalha, ele terá que ser cadastrado à mão — o gerador não o
  produz.
- **⚠️ O NOME "CORTE" JÁ ESTÁ OCUPADO.** O `slash` (Normal, 70) se chama **Corte** no jogo, é um dos
  oito de crítico alto e 22 espécies o aprendem. Por isso o item é **"HM01 — Corte"** e não "Corte":
  no dia em que os dois aparecerem na mesma tela, o prefixo é o que os separa.

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
