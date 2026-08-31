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
- **Todo modo aplica os mesmos buffs.** Shiny e especialidade valem em TODA batalha (liga, liga dos
  treinadores, ginásio do bairro, torre e online); terreno só existe onde há terreno escolhido
  (liga, liga dos treinadores e ginásio do bairro — na torre e no online não existe terreno).
  Um caminho que esquecia o buff já aconteceu: desafio do lobby criava batalha com `specialties: []`
  porque `joinBattleLobby` não gravava o campo. Medido antes de corrigir: num confronto parelho o
  buff de especialidade cobrindo o time todo vale **~13 pontos percentuais** de vitória (53,7% →
  66,6%), e **~19** num espelho. "+1% em tudo" engana — em batalha parelha decide.
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
  Bellossom, Politoed e Slowking, portanto, **não têm como aparecer por evolução** — e por isso
  entraram direto no pool de rotas (Rotas 36/37 e Lago da Fúria). É uma solução de contorno
  honesta, não a definitiva: a definitiva é uma tela de escolha na hora da evolução, como a do
  Eevee, e aí eles saem das rotas.
- **Armadilha que quase passou**: Espeon e Umbreon estavam na tabela de evoluções de Johto como
  destino do `eevee`. Ao fundir, o Eevee passou a evoluir sozinho pra Umbreon no nível 40 —
  atropelando a tela de escolha dele. Pego pelo `tools/test-johto.js`, que hoje trava isso.
- A conquista "Pokédex Clássica" (149 espécies) virou **"Pokédex de Kanto"**: com 250 espécies,
  "149" não significava mais nada. "Mestre Pokémon" passou a exigir as 250.
- `node tools/test-johto.js` cobre a fusão: as duas cópias iguais (comparando VALOR, não texto —
  os dois arquivos têm comentários próprios e listam em ordens diferentes), 152–251 sem buraco, os
  dois tipos novos completos, e as evoluções de Kanto intactas.

## Log de batalha

- O matchup carrega **`golpes`**: o diário do confronto, um registro por golpe na ordem real,
  escrito por `doExchange`. Não é reconstrução — o motor anota enquanto luta. Só apresentação:
  passar ou não o array não muda um ponto de dano (conferido por hash, 14.645 confrontos).
- **O dano gravado é o EFETIVO, não o sorteado.** Golpe de 101 em quem tem 54 de HP entra como 54.
  Com o valor cru o log não fechava: somando as linhas dava mais dano do que o pokémon tinha.
- **Log e animação leem a MESMA lista** (`sequenciaDoConfronto`, teto de 3 golpes). Enquanto eram
  montadas em separado, o jogador via 3 golpes na tela e lia 4, 7 linhas no log — reportado três
  vezes. A reconstrução de 3 golpes é **determinística** (semente tirada do próprio confronto):
  com `Math.random()`, log e animação sorteavam divisões diferentes e cada redesenho trocava os
  números.
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
  linha que se lê de relance.
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

- **Seis iniciais**: os três de Kanto e os três de Johto, agrupados por região na tela de escolha.
  Qualquer um atravessa qualquer caminho — a escolha de ginásio vem depois, e a cada trecho.
  `RIVAL_STARTER_COUNTER` e `STARTER_EVOLUTIONS` ganharam o triângulo de Johto.
  **Custo medido:** o sorteio de shiny corre POR INICIAL, então dobrar a lista dobra a chance de
  aparecer um shiny na tela — **2,3% → 4,5%** no normal, **9,1% → 17,3%** no difícil. O teto da
  artimanha (6 sorteios presos, 3 slots × 2 modos, sem jogar nada) vai de **13% pra 25%**. Se um
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
- **Todo pokémon tem que ter como ser capturado.** Uma espécie que não está em rota nenhuma e não
  evolui de nada é uma vaga impossível na Pokédex — e a Pokédex completa é o que libera o desafio
  do Mewtwo. Quando Johto entrou, **17 não-lendários ficaram assim** (Pichu, Togepi, Togetic,
  Slowking, Bellossom, Politoed, Skarmory, Unown, Wobbuffet, Yanma, Gligar, Qwilfish, Shuckle,
  Remoraid, Octillery, Smeargle, Igglybuff) e nada acusava. Foram distribuídos pelas rotas onde
  aparecem no jogo original. As três bestas e o Ho-Oh entraram como raros de 5%, o mesmo
  tratamento que as aves lendárias de Kanto já tinham.
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
- **O mapa de Kanto continua sendo de Kanto.** `KANTO_PLACES`/`KANTO_JOURNEY` são indexados pela
  etapa, então numa etapa de Johto ele desenha a cidade de Kanto correspondente. A trilha de
  insígnias já segue o caminho certo (`gymOf(i)`); o mapa é o que falta.

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
  Sobra um teto de 6 sorteios sem jogar (3 slots × 2 modos). Bounded, e quem joga limpo não perde
  nada: a chance por jornada continua a mesma.
  **A conta mudou quando os iniciais passaram de 3 pra 6** (Johto entrou na tela): o sorteio corre
  por inicial, então a chance de ver um shiny foi de **2,3% pra 4,5%** por tentativa no normal
  (9,1% → 17,3% no difícil), e o teto da artimanha de **13% pra 25%**. Se incomodar, o conserto é
  sortear só entre os três da região escolhida — mas hoje a região só é escolhida DEPOIS do inicial.

`tools/test-artimanha.js` cobre as duas.

## Modo difícil (`gameMode: 'hard'`)

- Bolo de vitória pela metade **a partir do 3º ginásio**. Os dois primeiros ficam normais porque
  reduzir desde o início matava 100% das jornadas no Brock (medido).
- Derrota vale 3 desde o 1º ginásio. Custo medido: 14% morrem no Brock, conclusão cai de 29% → 24%.
- 50% dos pokémon dos líderes vêm shiny. **Efeito mecânico pequeno** — é sinalização visual.
- Chance de shiny selvagem 4× (1/32). Vale também para os iniciais.

## Ginásio da Cidade

- O **selo de terreno** nas fileiras de time (`timeComTerrenoHtml`) usa a MESMA regra do
  `applyTerrainBuff` — se as duas divergirem, a tela promete um bônus que a batalha não dá.
  Aparece na tela do ginásio, na escolha de time do desafio e nas duas telas de ordem.
- **Reordenar a defesa é uma função à parte** (`reorderNeighborhoodGymDefense`), e não um modo do
  `setNeighborhoodGymDefense`: aquele resolve reivindicação de ginásio vago, exclusividade do time
  entre ginásios e troca de terreno, e nada disso vale numa permutação.
- Ela permuta o **código guardado**, não o time do save: o save pode ter mudado de ordem ou de
  nível desde que a defesa foi montada, e o líder está reordenando o que ele vê defendendo.

## Torre dos Treinadores

- 10 andares, médias **58, 61, 64, 67, 70, 73, 76, 79, 82, 85** (linear, +3 por andar).
  Escala escolhida pra ter porta de entrada: um campeão da Elite (~67) chega ao andar 5.
- Times de 6 evoluções finais, níveis espalhados ±3 com os dois extremos garantidos.
- Mewtwo e Eevee fora do pool.
- Recompensa: 1 Doce Raro por torre vencida (+1 nível num pokémon). Creditado no servidor.
- **O time da subida é procurado por IDENTIDADE, não por espécie+nível.** A busca antiga pegava o
  primeiro que casasse: quem tinha o mesmo pokémon no mesmo nível em dois saves (um shiny, um
  normal) escolhia o shiny e subia com o normal — perdendo o visual E o buff de 1,20×. O cliente
  manda `monId`/`slot`/`idx`/`shiny` e o servidor vai do mais específico pro mais genérico;
  os dois últimos níveis existem só pra não quebrar cliente antigo em cache.
  `node tools/test-torre.js` cobre os dois lados (escolher o shiny e escolher o normal).

## Batalha Online

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

- **Não redesenhar a tela durante animações.** Cada `render()` recria o HTML e mata a transição
  CSS da barra de HP no meio. Animações atualizam o DOM diretamente. Já causou três bugs.
- Timers que dependem de `render()` param quando o render fica raro. Cronômetros têm laço próprio.
- Barra de HP: usar `renderHpBar` e as classes `hp-bar-fill` + `hpBarClass`. Marcação própria
  parece igual mas não recebe as regras de cor.
- Ícones da home são pixel art em base64 na constante `ICONES`. **Diagonais finas não sobrevivem
  à redução** — usar formas sólidas.
- Testar layout em 320px, não só 390px.

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
