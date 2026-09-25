# AS LIGAS E OS MODOS ONLINE

A **Clássica**, a **Pro**, a **Trainers League**, o **chaveamento**, a **Batalha Online**, a
**Torre**, o **Ginásio da Cidade** e o **painel de admin**. Saiu do `CLAUDE.md` em 25/09/2026, pela
mesma medição que tirou as Ilhas Laranja, a economia e a batalha na tela.

⚠️ **AS DUAS REGRAS QUE MAIS CUSTARAM AQUI:**

1. **O Firestore recusa `undefined` — e recusa a GRAVAÇÃO INTEIRA.** No cliente ele é inofensivo
   (o `JSON.stringify` some com a chave); no servidor o Admin SDK derruba tudo. Foi assim que as
   duas ligas morreram de 11 a 13/09/2026, e o `tools/fake-firestore.js` passou a recusar igual.
2. **O fake tem que doer onde a produção dói.** Ele já foi mais permissivo **oito vezes** (o
   `increment` em mapa, o ponto no `update`, o `getAll` da transação, o `arrayUnion`, o `count()`,
   o `orderBy` encadeado, o índice composto e a exclusão de quem não tem o campo) — e em cada uma
   o teste ficou verde e o jogador achou o defeito.

⚠️ **E O QUE NÃO ESTÁ AQUI:** o motor em `docs/motor-de-batalha.md`, as Ilhas em
`docs/ilhas-laranja.md`, a loja em `docs/economia.md`, o log e a cena em
`docs/batalha-na-tela.md`, e o resto no `CLAUDE.md`.

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

### ⚠️ O DESAFIO DO GINÁSIO QUEBRAVA NA GRAVAÇÃO: ARRAY DENTRO DE ARRAY (17/09/2026)

Reportado assim: *"o desafio do ginasio nao esta funcionando, estou clicando para desafiar e nada
acontece depois de selecionar o time"*. **E o log da function tinha a resposta inteira:**

```
E challengeneighborhoodgym: Unhandled error
Error: 3 INVALID_ARGUMENT: Nested arrays are not allowed
```

**⚠️ O FIRESTORE RECUSA ARRAY DENTRO DE ARRAY, e recusa a GRAVAÇÃO INTEIRA** — é a mesma família do
`undefined` que matou as duas ligas em 13/09. A causa era uma linha nascida em **16/09**, junto com
os golpes chegando na liga:

```js
leaderTeamAtaques: timeDoDesafiante.map(p => p.ataques || null)   // [['surf','tackle'], ...]
```

**Quem tinha golpe escolhido e VENCIA o desafio** batia nisso na hora de assumir a liderança; montar
ou alterar a defesa também. Quem perdia, não — e é por isso que o relato diz "nada acontece" em vez
de "deu erro": o caminho só estoura no fim.

**O CONSERTO É O FORMATO, e ele fica numa função só** (`ataquesParaDoc` / `ataquesDoDoc`): os golpes
de cada pokémon viram uma string separada por vírgula. A LEITURA aceita os dois formatos — documento
no formato antigo não existe (a gravação sempre falhou), mas a regra da casa é que dado velho não
some.

#### ⚠️ E O TESTE PASSAVA 31/31, por DOIS motivos somados

Este é o par que importa, e nenhum dos dois sozinho explicaria:

1. **o `fake-firestore` não recusava array aninhado.** Ele já recusava `undefined` desde 13/09 —
   pela mesma lição, e com o mesmo comentário no arquivo. Faltava a segunda regra.
2. **o fixture não tinha golpe escolhido.** Com o campo vazio, `map(p => p.ataques || null)` dá
   `[null, null, ...]`, que **não é array aninhado** e o Firestore aceita numa boa.

Os dois foram fechados: o fake agora acusa `3 INVALID_ARGUMENT: Nested arrays are not allowed` com o
caminho do campo, e o fixture do `test-ginasio-cidade` leva golpes. Conferido que, com o formato
antigo religado, o teste **explode no primeiro caso**.

**A LIÇÃO É A DE 13/09, de novo, e vale escrevê-la de outro jeito: o fake tem que doer onde a
produção dói.** Toda vez que ele é mais permissivo que o Firestore, a bateria fica verde e o jogador
encontra o defeito.

---

### OS TRÊS HMs APARECEM SEMPRE NA MOCHILA (17/09/2026)

Pedido assim: *"na mochila, no botão de TMs/HMs, adcione os 3 HMs existentes no jogo, porém se o
jogador não tiver, deixar desativado o botão de usar, e escreva o que é necessário fazer para obter
o HM"*.

- **A prateleira lista os três, tendo ou não.** Antes só os conquistados entravam, e quem não tinha
  nenhum via a prateleira vazia — ela não dizia que eles EXISTEM, nem como pegá-los.
- **O que falta vem APAGADO, e não desabilitado**: tocar nele abre o quadro, que é **onde mora o
  caminho**. Um botão morto ali esconderia justamente a informação que o pedido mandou escrever.
  O apagado é o mesmo `opacity:.55` do pokémon descansando no montador — o jogo já ensinou o olho a
  ler esse cinza.
- **O botão "Ensinar" é que fica desabilitado**, que foi o pedido ao pé da letra.
- **O rótulo diz o ESTADO**: *"seu para sempre"* ou *"você ainda não tem"*.

**⚠️ E ISSO REVERTE UMA DECISÃO DE 14/09, que vale registrar como reversão e não como descuido:**

| | |
|---|---|
| **14/09** | *"não precisa dizer como ganhar o HM01"* — a tela não entrega de graça um achado que a jornada devia entregar |
| **17/09** | *"escreva o que é necessário fazer para obter o HM"* |

O de hoje é mais recente e explícito, e vale. O que o de 14/09 protegia deixou de fazer sentido
quando a linha passou a existir **mesmo pra quem não tem o HM**: sem o caminho ela seria uma promessa
muda. O `comoGanhar` só aparece no HM que FALTA — no que você já tem ele seria história.

---

### A PALAVRA "MÁQUINA" SAIU DAS TELAS (17/09/2026)

Pedido: *"não use a palavra máquina para descrever TM ou HM, ninguem entende isso"*. Foram quatro
textos: o rótulo da quantidade, o aviso de uso único do TM e as duas frases do modal de "quem pode
aprender" (*"não aprende essa Máquina"* → *"não aprende esse golpe"*).

**⚠️ E A TRAVA ACUSOU O PRÓPRIO COMENTÁRIO QUE EU TINHA ACABADO DE ESCREVER.** Comentário HTML
(`<!-- -->`) **vai pro DOM**, e o meu explicava a mudança citando a palavra. É a mesma armadilha que
este arquivo já registra duas vezes (o nome de líder na bifurcação, o código velho na trava do
`slotDaConta`). A forma certa dentro de um template é o comentário JS (`${/* … */''}`), que o projeto
já usa em vários lugares — e nem ali ela pode ser escrita por extenso.

A varredura é por TELA RENDERIZADA, não por `indexOf` no arquivo: a regra é sobre o que o jogador lê.

---

### O RESGATE DE CONQUISTA É POR LINHA (17/09/2026)

Pedido: *"tirar aquele botão que pega todas as moedas de uma vez, para cada conquista o usuario tem
que clicar no botão que tem na mesma linha alinhado a direita mostra o tanto de dinheiro que ele vai
ganhar"*.

- **Três estados na coluna da direita, e só um é botão:** a PAGA mostra o ✓, a GANHA é o **botão**
  com o valor, e a TRANCADA mostra o selo do nível sem clique — ele continua ali porque é o que diz
  por que vale a pena ir atrás daquela.
- **⚠️ O `resgatandoConquistas` guarda o ID, não um booleano:** com um botão por linha, um `true`
  desabilitaria as 69 de uma vez enquanto UMA está sendo paga.
- **O botão não usa o `.btn` da casa** — aquele é botão de AÇÃO, com moldura de 3px, e aqui ele
  brigaria com as outras 68 linhas. Mesmo raciocínio dos cartões de golpe e das linhas da ficha.
- **⚠️ NO SERVIDOR O `id` É OPCIONAL, e sem ele a função paga TUDO** — que é como ela nasceu, e é o
  que um cliente antigo em cache continua mandando.
- **⚠️ E QUEM DECIDE CONTINUA SENDO O SERVIDOR:** ele recalcula o que está ganho e **ignora qualquer
  id fora dessa lista**. O que vem do cliente é o PEDIDO, nunca a resposta — a mesma regra do
  `claimJourneyCoins`. Há trava com id inventado, com conquista trancada e com a mesma duas vezes.

**Medido a 320px:** 8 botões numa conta com 8 conquistas, alinhados à direita, sem rolagem lateral.

---

### OS NINHOS TÊM NOME DE LUGAR (17/09/2026)

Pedido: *"coloque os nomes assim: 'Ninho Queimado', 'Ninho Elétrico', 'Ninho Congelado'"*.

Cada ninho passou a ter **dois nomes**, e eles dizem coisas diferentes: o `ninho` é o LUGAR e o
`nome` é quem mora nele. **A tela dos três mostra o do LUGAR** — ele é o mesmo esteja o ninho cheio
ou vazio, então a fileira não muda de rótulo quando uma missão acende; quem identifica a ave é o
sprite. O nome do pokémon fica no modal, que é onde se lê sobre ele, e no anúncio da tela de
resultado (*"O Ninho Queimado da Montanha Sagrada foi ocupado por Moltres!"*).

Medido a 320px: os três cards em **78px**, uniformes, sem rolagem lateral.

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

## O CLIQUE DE INSCREVER NA LIGA CUSTAVA SEIS IDAS AO SERVIDOR (16/09/2026)

Relatado assim: *"pra se inscrever na liga a gente clica no botão Inscrever time e tá demorando um
bom tempo até fazer a ação"*.

**⚠️ E A PRIMEIRA COISA MEDIDA FOI SE A CULPA ERA DO QUE TINHA ACABADO DE SUBIR — não era.** As
moedas das conquistas puseram um `getAchievementAggregate()` em todo desenho da home; medido no
navegador com a conta no PIOR caso que o jogo permite (20 saves cheios, Pokédex inteira):

| | |
|---|---|
| `getAchievementAggregate()` | **0,10ms** |
| `temConquistaAResgatar()` | 0,11ms |
| `renderSaveSelect()` inteiro | **0,35ms** |

Ou seja: **não é CPU, é REDE** — e nenhuma das duas coisas do dia tinha relação com o relato.

**O QUE O CLIQUE FAZIA, contado trocando o `db` por um que registra cada operação e a ordem:**

```
   0ms  TRANSACAO         tx.get  leagues/schedule_classic
 120ms  (commit)
 120ms  get               leagues/schedule_classic      <- de novo, o MESMO doc de 9,5 KB
 180ms  get               .../registrants/u1
 240ms  TRANSACAO         tx.get  .../registrants/u1    <- de novo, o MESMO doc
 360ms  (commit)
```

**SEIS idas EM SEQUÊNCIA**, cada uma esperando a anterior. Três eram desperdício:

1. **O `ensureRegisteringCycle` abria uma TRANSAÇÃO mesmo quando o ciclo já existe**, que é o caso
   comum. Transação custa **duas** idas (ler + confirmar); uma leitura custa **uma**. A transação
   só é necessária pra CRIAR o ciclo — é ela que impede duas abas de criarem dois.
2. **O calendário era lido duas vezes** — uma no `ensureRegisteringCycle` e outra no
   `isAccountActiveInLeague`, de volta.
3. **O documento do inscrito também** — uma no `isAccountActiveInLeague` e outra na transação que
   grava.

**O CONSERTO É UM PREÂMBULO SÓ (`preambuloDaInscricao`), usado pelos DOIS caminhos de inscrição**
(o normal e o de time customizado, que tinham o mesmo trio copiado):

- lê o calendário **uma vez**, e só cai na transação quando o ciclo **falta**;
- passa os ciclos já lidos pro `isAccountActiveInLeague` (`{ cycles }`);
- e diz a ele pra **não conferir o ciclo aberto** (`{ pularInscricao }`), porque a transação da
  gravação lê o mesmo documento e recusa com `DUPLICATE` — **e as duas saídas já davam a MESMA
  mensagem na tela**. Quem só quer SABER (o aviso da jornada) não passa a opção e continua
  conferindo tudo.

**⚠️ LER ANTES É SEGURO AQUI, e foi conferido:** o SDK é o **compat 10.7.1**, onde `get()` vai ao
SERVIDOR quando online (o cache só entra offline). E a corrida que sobra não é nova — o ciclo já
podia travar entre as duas transações de antes.

**O RESULTADO, medido do mesmo jeito: 6 → 3 idas.**

| RTT | antes | depois |
|---|---|---|
| 60ms (medido daqui até `firestore.googleapis.com`) | 360ms | **180ms** |
| 150ms (celular) | 900ms | **450ms** |
| 250ms (celular ruim) | 1.500ms | **750ms** |

- **⚠️ A TRAVA É DE CONTAGEM, NÃO DE TEMPO, e isso é decisão.** Medir milissegundos num teste daria
  um número que muda com a máquina e com o dia; o que decide o tempo aqui é **quantas idas em
  sequência**, porque cada uma espera a anterior. `tools/test-liga-inscricao.js` troca o `db` por um
  que conta, e cobra: no máximo **3** idas, o calendário lido **1×**, o inscrito **1×**, e a
  gravação continuando dentro de uma transação. Conferido que ela acusa (5 idas) com o retrocesso.

**O QUE A VARREDURA OLHOU E NÃO ENCONTROU**, pra não procurar de novo: **nenhum N+1 sequencial** no
cliente — os dois lugares que leem dentro de `map` (`loadLeagueViewData` e o próprio
`isAccountActiveInLeague`) estão em `Promise.all`, ou seja **uma ida** e não N. As funções com mais
`await` são de fundo (`advanceCyclePhases`, `drawCycle`, as migrações), não de clique.

**O QUE FICA EM ABERTO, e é custo e não lentidão:** a tela da Liga faz um **polling de 5s** enquanto
está aberta (~2 leituras por tique, ~1.400/hora por aba). Ele já é só LEITURA — os clientes pararam
de tentar avançar o ciclo — e é guardado por `game.screen`, mas continua sendo a maior torneira de
leitura do jogo com a tela parada. A Trainers League já tem poll adaptativo; a Clássica não.

## OS QUADROS QUE ABREM E FECHAM NAS LIGAS (17/09/2026)

Pedidos assim: *"na liga classica e trainers league, nos quadros de Top 10, Suas ultimas ligas e
Ultimas Ligas, coloque um quadrado azul com um sinal de + alinhado na direita do titulo, e quando o
usuario clicar, abre as linhas que aparecem hoje"*.

**São QUATRO**: os dois Top 10 (a Clássica e a Trainers League) mais os dois históricos da Clássica
— e é por isso que eles dividem **uma** função (`quadroDobravelHtml`). Escritos um a um, o quinto
nasceria com o `+` fora de lugar ou sem fechar: é a lição das três telas de golpe, que viraram uma
cópia só **depois** de já terem divergido no texto.

- **⚠️ O CABEÇALHO INTEIRO É O ALVO DO TOQUE**, e não o quadradinho. É a regra da casa (*"a linha
  toda já é o alvo do toque, e mirar num quadradinho num celular é pedir erro"*), a mesma da ficha
  da Pokédex, da lista de notificações e do card do log de batalha. **O `+` é a AFFORDANCE** — ele
  diz que há o que abrir —, não o alvo.
- **⚠️ E ELE É UMA `<div role="button">`, NUNCA UM `<button>`.** O conteúdo desses quadros **TEM
  botões dentro**: o "▶ Rever" dos históricos, e o nome do treinador do Top 10, que abre o perfil.
  `<button>` dentro de `<button>` é HTML inválido — o navegador fecha o de fora e o clique de dentro
  se perde, com a tela continuando a **PARECER** certa. Essa armadilha já custou dois defeitos neste
  projeto (a lupa do encontro selvagem e a do montador), e o card do log de batalha resolveu-a do
  mesmo jeito. O preço da `div` é o teclado, que entra na mão (`tabindex` + Enter/Espaço).
- **⚠️ E O CONTEÚDO É IRMÃO do cabeçalho, não filho:** assim nem o aninhamento nem o clique de
  dentro dependem de `stopPropagation`.
- **O CONTEÚDO SÓ É MONTADO QUANDO ABERTO**, e isso não é só estética: o Top 10 monta dez linhas com
  o link de perfil de cada uma, e os históricos montam um botão por liga.
- **ELES COMEÇAM FECHADOS**, que é o que o pedido descreve (*"quando clicar, ABRE as linhas que
  aparecem hoje"*). O estado é de **TELA** — não vai pro save, ninguém volta amanhã querendo o Top
  10 aberto — e **zera ao entrar na liga**: o "aberto" de ontem não é uma preferência, é o estado em
  que o jogador largou a tela na vez passada.
- **Medido a 320px, no navegador:** o quadrado tem **28×28px** no azul da casa, encostado na borda
  direita do cabeçalho (folga 0), e a tela da Clássica com os três fechados vai de **2.099 para
  1.027px — −51%**, sem rolagem lateral.
- `tools/test-liga-inscricao.js` tranca 21 pontas: o `+` virando `−`, o conteúdo só quando aberto,
  o cabeçalho não sendo um `<button>` e o conteúdo sendo irmão dele, o teclado, os **quatro ids sem
  repetir**, **nenhum `<h2>` solto sobrando** com esses títulos (um deles fora da função seria um
  quadro que não abre, e só quem abrisse aquela liga descobriria), o zerar nas duas portas, o estado
  fora do save, o "▶ Rever" e o link de perfil continuando inteiros dentro do conteúdo, e — lendo o
  CSS — o quadrado ser quadrado, ser azul, e o título empurrar o `+` pra direita.

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

## A LIGA PRO: O TIME É SORTEADO (23/09/2026)

Pedida assim: *"crie a liga Pro, onde quando o usuário se inscrever, será sorteado 12 pokemons e ele
terá que escolher 6 desses 12 para ir para a liga ... primeiro vai acontecer uma liga de pokemons
entre os levels 55 e 70 ... depois 15-30 ... depois 35-50 ... cada pokemon tem 5% de chance de ser
shiny, e os pokemons nao podem se repetir ... sempre respeitar a evolução de acordo com o level ...
se nao fechar 8 treinadores, continua os que estao na fila até fechar no minimo 8 treinadores, só
quando acontecer um campeonato de uma faixa de level, que o troca a faixa ... a mecanica é toda
igual a Liga Classica, a unica diferença é na hora de se inscrever ... criar ranking e histórico
igual a Liga Classica"*.

### ⚠️ QUASE NADA FOI ESCRITO, E ISSO É O QUE A ARQUITETURA DE LIGA JÁ TINHA COMPRADO

**Toda a máquina de liga já é genérica por `typeId`** — a agenda (`scheduleDocRef`), o ciclo
(`cycleDocRef`), os inscritos, o `drawCycle`, as fases, o `advanceLeague`, o ranking global
(`champions_alltime_<typeId>`), o histórico pessoal e as notificações. A Pro não ganhou UM caminho
novo: ela ganhou **uma tela de inscrição e uma faixa que gira**.

**E as duas regras que pareciam novas já existiam:**

| o pedido | quem já fazia |
|---|---|
| *"se não fechar 8 treinadores, continua os que estão na fila"* | o `REGULAR_LIGA_SIZE` (8): com menos, o `drawCycle` forma **ZERO** ligas e todo mundo cai no `leftover` |
| *"só quando acontecer um campeonato é que troca a faixa"* | é a mesma condição — a faixa anda em `leagues.length > 0` |

**Medido de ponta a ponta** (8 inscritos + 1 forjado, contra o Firestore em memória): 1 liga formada,
os 8 no chaveamento, o forjado **descartado**, a faixa indo de 55-70 pra 15-30. E com **5** inscritos:
**zero ligas**, a faixa **parada** e os 5 no `leftover`.

### ⚠️ O BOLO É SEMEADO POR `uid + cycleId`, E ISSO RESOLVE DUAS COISAS DE UMA VEZ

1. **sair e voltar devolve o MESMO bolo** — a trava anti re-sorteio, a mesma do encontro selvagem
   (sem ela bastaria fechar a aba até vir um bolo bom);
2. **o servidor consegue VALIDAR sem guardar nada**: ele REFAZ o bolo de cada inscrito no
   `drawCycle` e descarta quem não bate.

**⚠️ E O SEGUNDO É OBRIGATÓRIO, não é zelo: a inscrição de liga é ESCRITA DIRETA DO CLIENTE.** Não há
callable pra guardar — a regra do Firestore só confere que o documento é do próprio uid. Na Clássica
isso não é problema porque o time tem que **SER da conta**; aqui ele é sorteado, então sem a
validação **um cliente forjado inscreveria seis Mewtwo**. Medido: as 9 tentativas de forja são
recusadas (seis Mewtwo, o mesmo do bolo 6×, 5 em vez de 6, os 12 inteiros, nível adulterado, shiny
adulterado, o bolo de outro treinador, o de outro ciclo, código lixo).

- **A CHAVE É A TRINCA espécie+nível+shiny**: só a espécie deixaria passar um Charizard Lv.70 num
  bolo que tinha um Lv.56; só o nível deixaria passar um shiny que não foi sorteado.
- **E cada um do bolo só vale UMA vez** — sem isso daria pra inscrever seis cópias do melhor.

#### ⚠️⚠️ O `cycleId` NA SEMENTE MATAVA O LEFTOVER — CONSERTADO EM 24/09/2026

Reportado assim: *"quando acaba o tempo e nao tem player suficiente, por exemplo, era pra uma liga as
8h e só tinha 4 treinadores inscritos, ele ta resetanddo e jogando fora os 4 treinadore ao invés de
manter para a proxima"*. **E era literal: quem caía no `leftover` era DESCARTADO em silêncio** — o que
tornava a liga **impossível**, porque ela precisa de **8** inscritos, eles só acumulam pelo leftover,
e o leftover invalidava todo mundo.

A cadeia é curta, e cada elo estava certo sozinho:

```
o bolo era semeado por uid + cycleId
o leftover copia o inscrito pro ciclo SEGUINTE (preservando o registeredAt)
o drawCycle REFAZ o bolo com o cycleId NOVO -> nao bate com o `code` gravado
a validacao filtra ele fora -- e ela roda ANTES do leftover
```

**⚠️ PROVADO NO FIRESTORE DE PRODUÇÃO, minuto a minuto — não foi deduzido:**

```
06:21  o Red se inscreve no ciclo das 07:00  (bolo semeado por cycleId=1790244000000)
07:00  cron: 1 inscrito, nao forma liga. o code BATE (o bolo e do proprio ciclo)
       -> leftover copia pro ciclo das 08:00, com o mesmo registeredAt e o mesmo code
08:00  cron: o bolo agora e semeado por cycleId=1790247600000 -> o code NAO bate
       -> DESCARTADO. leftover VAZIO.
09:00  ZERO inscritos.
```

Ou seja ele sobrevivia **uma** passada e caía na segunda: **não ia pra liga e não voltava pra fila**.
Sem erro, sem notificação, sem nada na tela. A faixa ficou **travada em 2 por 11 ciclos seguidos**
(das 23h às 10h), porque ela só gira quando uma liga **acontece**.

**⚠️ ELE NASCEU COM A LIGA PRO**, ou seja é meu: a Clássica não tem o problema porque o time dela
**É da conta** e não muda de ciclo pra ciclo.

#### ⚠️ A SEMENTE PASSOU A SER A RODADA DA FAIXA, e não a faixa

```js
function proSementeDoBolo(uid, entry){
  const legado = entry && entry.proSementeLegado;
  return 'pro-' + uid + '-' + (legado != null ? legado : 'r' + proRodadaDoCiclo(entry));
}
```

**⚠️ `uid + faixa` FOI A PRIMEIRA IDEIA E ELA TEM UM FURO: o bolo REPETIRIA a cada volta da
rotação.** Com três faixas, a Bronze de hoje e a Bronze da próxima volta dariam **exatamente os
mesmos 12** — e o jogador decoraria o bolo dele. O `proRodada` é um **contador que só sobe**, então a
faixa se repete e o bolo não.

- **⚠️ ELE ANDA QUANDO A LIGA ACONTECE, na MESMA condição que move a faixa** (`leagues.length > 0`) —
  e é isso que faz o bolo **ficar parado enquanto o jogador espera na fila**, que é a coisa toda: sem
  isso o leftover volta a matar todo mundo. Medido: os 4 esperam duas passadas, 4 mais chegam, e a
  liga se forma **com os 4 originais dentro**.
- **⚠️ E O CICLO É CARIMBADO, nunca lido da agenda na hora** — a mesma decisão do `proFaixa`: lida na
  hora, a rodada mudaria **debaixo de quem já se inscreveu** e o `code` dele deixaria de bater.
  **Os DOIS motores carimbam** (o servidor ao criar o ciclo seguinte e o cliente no
  `ensureRegisteringCycle`): sem o do cliente, um ciclo criado pelo primeiro inscrito nasceria em
  `r0` e o bolo **voltaria pro da primeira rodada**.
- **⚠️ E É `Number(x) || 0`, NUNCA `x | 0`:** o `| 0` trunca em **32 bits**, e um contador que só sobe
  chegaria lá — daí em diante dois ciclos diferentes dariam o **mesmo** bolo. É a mesma armadilha do
  `== null` que o `proFaixa` já registra (o índice 0 é válido).
- **⚠️ E A TELA JÁ PROMETIA ISSO, e a promessa era FALSA:** o picker diz *"os 12 são sorteados de novo
  a cada liga — sair e voltar não muda os seus"*. Antes do conserto eles mudavam **a cada ciclo**, ou
  seja **de hora em hora**. Não houve texto a mudar: o conserto tornou verdadeira a frase que já
  estava lá.

**⚠️ O `proSementeLegado` É A REDE DO DEPLOY, e ele tem UM uso datado:** se na hora do deploy houver
inscrito no ciclo aberto, o `code` dele é do bolo por **cycleId** e ele cai na primeira passada.
Carimbar `proSementeLegado = <cycleId>` naquele ciclo mantém a inscrição dele válida.

**⚠️ E NA HORA DO DEPLOY (24/09/2026, 10:27 SP) HAVIA 1 INSCRITO — e a migração foi AVALIADA e
RECUSADA.** O inscrito era o mesmo **Red**, com um time que bate **0 de 6** com o bolo novo. Os dois
números que decidiram:

| | |
|---|---|
| **a inscrição já estava condenada** | pelo código VELHO ele passaria às 11:00 e seria descartado às **12:00** (o leftover); pelo novo, às 11:00. O deploy adianta a perda em uma hora, **não a causa** |
| **a escrita é no documento que o cron mexe** | o `leagues/schedule_pro` é escrito pelo cron **de minuto em minuto**, e uma escrita minha não-transacional por cima pode desfazer a dele — risco maior que salvar uma inscrição que a liga nem formaria (1 de 8) |

Ou seja: **o campo continua sem uso até hoje**, e ele fica porque o dia em que a semente mudar de
novo ele é a diferença entre migrar e descartar todo mundo que estiver na fila. Se for pra usar, o
caminho seguro é uma **transação** no mesmo documento, nunca um `update` solto.

**⚠️ AS DUAS ALTERNATIVAS FORAM CONSIDERADAS E SÃO PIORES:**

| saída | por que não |
|---|---|
| guardar o `cycleId` de origem no inscrito | **abre forja**: o cliente escolheria um `cycleId` de bolo bom, e é ele quem escreve o documento de inscrição |
| re-sortear o bolo no leftover | **escolheria os 6 pelo jogador** — ele montou o time dele, e o bolo novo não tem os mesmos pokémon |

### O BOLO: 12 FORMAS, NA FAIXA, SEM REPETIR LINHA

- **⚠️ SEM REPETIR LINHA EVOLUTIVA, e não "espécie diferente"**: charmander e charmeleon no nível 40
  são os **dois** Charizard. Pela linha os 12 saem distintos por construção — é a regra que o
  encontro selvagem e os guardiões da Montanha já usam.
- **⚠️ E A FORMA TEM QUE BATER COM O NÍVEL** (`formaNoNivel`), que é o pedido ao pé da letra. **É a
  lição da Vigília** (14/09/2026, relatada como *"está aparecendo Charizard no level 24"*): o
  `especieNoNivel` sozinho só anda **PRA FRENTE**, e quem sorteia da dex inteira não tem piso
  nenhum pra barrar. Lá isso alcançava **28,5%** dos sorteados.
- **⚠️ O MEWTWO PRECISOU SER NOMEADO**: ele **NÃO** está no `LENDARIOS` (a lista dos capturáveis em
  rota) **nem** no `ESPECIES_INTOCAVEIS` (os três que ninguém pega) — a primeira versão o deixava
  passar, e ele decidiria o draft sozinho.
- **O shiny é 5% por pokémon**, medido: **4,92% em 60.000 sorteios** (−0,9σ).
- **As três faixas dão três jogos diferentes**: 132 / 181 / 166 espécies alcançáveis em cada uma.

### ⚠️ A ROTAÇÃO É CARIMBADA NO CICLO, NUNCA LIDA NA HORA

A faixa vive no ciclo (`proFaixa`), e não é consultada quando o jogador abre a tela: lida da agenda
na hora, ela **mudaria debaixo de quem já se inscreveu** — o bolo dele é da faixa antiga e a liga
aconteceria noutra.

- **Os DOIS lados carimbam**: o servidor ao criar o ciclo seguinte e o cliente no
  `ensureRegisteringCycle`. Sem o do cliente, um ciclo criado pelo primeiro inscrito nasceria sempre
  na faixa 0 e a rotação **nunca sairia do lugar**.
- **⚠️ E A INSCRIÇÃO RE-SORTEIA SE O CICLO VIROU** enquanto o jogador escolhia: o `cycleId` entra na
  semente, então inscrever ali mandaria um time que o servidor descarta **em silêncio**.

### A TELA

- **⚠️ O CARD É O DO DRAFT DA SELEÇÃO**, e a grade também: é o MESMO problema (escolher alguns entre
  doze sorteados, olhando o sprite), resolvido lá em 21/09. O `.btn` da casa — que foi a primeira
  tentativa — é `display:block;width:100%`: ele **esticou cada card pra a largura inteira** e os doze
  viraram uma pilha. É a mesma armadilha que o card do parceiro da Pescaria já custou.
- **⚠️ E O `spriteHtml` PRECISA DO `speciesId`**, enquanto o bolo guarda `id`: passando o objeto cru
  o sprite saía **VAZIO em todos os doze**, sem erro nenhum — foi o navegador que pegou.
- **A FAIXA DA RODADA APARECE NAS DUAS TELAS** (a da Liga e o picker), derivada da constante: ela é a
  informação que decide a inscrição, e sem ela o jogador só descobre o nível depois de abrir o
  picker. Um texto fixo mentiria na volta seguinte — a família do *"Revezamento · 900 m"*.
- **Quem recusa é a AÇÃO**: o sétimo escolhido e o índice forjado, com vaga sobrando ou não.

**Medido a 320px, no navegador:** o picker em **305×992px** com 12 cards de **78×127**, os shiny com
estrela e os escolhidos com a faixa "1º/2º/3º"; a tela da Liga em **305×1078px** com os cinco `<h2>`
em uma linha; a lista de ligas com o botão da Pro em **281×94px**. **Nenhuma rola pro lado e nenhum
nome trunca.**

### O RANKING E O HISTÓRICO

A Pro tem o **Top 10** e o **"Suas últimas Ligas"** — os dois quadros que são POR LIGA —, e o
"Rever" dela leva ao chaveamento **dela** (a linha carrega o `leagueTypeId`).

**⚠️ O QUADRO GLOBAL ("🌐 Últimas Ligas") É DA CLÁSSICA, e não é esquecimento:** o
`loadGlobalLeagueHistory` varre o `schedule_classic` e o botão dele **crava** o tipo clássico em
cada linha — ele nunca foi por liga, e a Trainers League também não o tem.

**⚠️ E ELE VAZAVA — um defeito ANTERIOR, que a Pro tornou visível.** O campo é carregado só quando a
Clássica abre e **nunca é limpo**: quem abria a Clássica e depois outra liga via o histórico DELA ali
dentro, com o "Rever" levando ao chaveamento da Clássica. Alcançava as ligas customizadas desde
sempre. Hoje o render só o desenha na Clássica.

### ⚠️ E A TRAVA DO PAINEL NÃO CONHECIA A PRO

O `adminAtivoEmAlgumaLiga` monta a lista com `[CLASSIC]` + os tipos da coleção `leagueTypes` — e a
Pro é um tipo **RESERVADO**, como a Clássica: ela não vive na coleção. Sem ela na lista, **o painel
deixaria inscrever na Clássica alguém que está disputando um chaveamento da Pro**, que é exatamente
o que aquela trava existe pra impedir.

**⚠️ E O TIPO PRECISA ENTRAR NO `listActiveLeagueTypes`, que é a trava mais importante do arquivo de
teste:** o cron itera exatamente aquela lista, e uma liga que ninguém avança fica presa em
`registering` **pra sempre** — inscrições abertas e sorteio que nunca chega.
`botFillEnabled: false` de propósito: o mínimo de 8 **É** a regra da Pro, e encher com bot a
desfaria.

### ⚠️ O UNOWN DA PRO É A EXCEÇÃO NOMEADA DA TRAVA DOS CLONES

A trava de 21/09 cobra que **todo clone que recola o `shiny` recole a letra do Unown** — e ela pegou
o `inscreverNaLigaPro` na primeira bateria. O caso é legítimo: o time da liga viaja como **CÓDIGO**
(`especie:nivel:shiny`), e **código de time não carrega letra** — é a regra que toda liga e o online
já praticam. Por isso o bolo também **não sorteia letra**: sorteando, a tela mostraria um Unown Q que
a partida lutaria como A.

Ela foi **NOMEADA** na trava (com um caso cobrando que ela seja a ÚNICA), em vez de a regra ser
afrouxada — o próximo clone que nascer continua tendo que recolar.

### ⚠️ A SEPARAÇÃO DA CLÁSSICA, MEDIDA NO PIOR CASO

**As duas rodam de hora em hora pelo MESMO relógio** (`computeNextScheduledTime`), então o
**`cycleId` delas COINCIDE** — e o que separa é só o prefixo do documento (`classic__<id>` contra
`pro__<id>`). Por isso a trava usa o MESMO id nas duas: com ids diferentes ela passaria por acidente.

Medido com 8 inscritos em cada, no mesmo ciclo, e o MESMO treinador nas duas:

| | |
|---|---|
| inscritos | **8 / 8**, sem um nome cruzado |
| chaveamento | **8 / 8**, ninguém da outra |
| o time do mesmo treinador | Charizard... na Clássica, o **bolo dele** na Pro |
| o bolo no picker da Clássica | **não vaza** |
| o erro do picker na tela da Liga | **não vaza** |

- **⚠️ O MESMO TREINADOR PODE ESTAR NAS DUAS, e isso é a regra da casa** — o `accountLeagueSlots`
  é indexado por `typeId` e a tela diz *"já está disputando ESSA Liga em outra rodada"*. Vale igual
  entre a Clássica e uma customizada. **O painel de admin é mais restritivo** (a trava dele é da
  CONTA), e é por isso que a Pro precisou entrar na lista dele.
- **⚠️ E "SUAS ÚLTIMAS LIGAS" MOSTRA AS DUAS, DE PROPÓSITO:** ele é por CONTA (lê o
  `leaguePlacements` do documento do usuário), cada linha NOMEIA a liga e o "Rever" leva o
  `leagueTypeId` dela. Filtrar por liga ali esconderia metade do histórico do jogador.
- **O picker da Pro zera bolo, seleção e erro NA PRIMEIRA LINHA** — sem isso, um ciclo que virou
  deixaria os índices escolhidos apontando pro bolo ANTIGO.

**⚠️ E A CONFERÊNCIA DE ACUSAÇÃO ACHOU TRÊS BURACOS NAS PRÓPRIAS TRAVAS:** duas **passavam em
branco** porque o bloco roda contra o `db` do SERVIDOR — um `cycleDocRef` do **CLIENTE** que
perdesse o prefixo do tipo não era alcançado por comportamento nenhum, e as duas ligas passariam a
escrever no mesmo documento sem nada acusar. O que fecha isso é **ler o código** dos dois motores.
As **8 misturas religadas acusam** (2 a 9 falhas cada).

### O QUE ISSO CUSTOU AO MOTOR: NADA

`MOTOR 5481ce57abca / DIARIO a4c6725aa4aa`, idêntico em 900 batalhas semeadas. A Liga Pro é uma tela
de inscrição e uma constante que gira.

**⚠️ E UMA CONSEQUÊNCIA REGISTRADA:** na tela de comparação de treinadores, um título da Pro cai em
**"Ligas especiais"** (o `else out.custom` do `compareTrainers`, que é o balaio das customizadas). O
**total** está certo; o rótulo cobre bem a Pro, e por isso não foi mexido.

`tools/test-liga-pro.js` tranca **116 pontas**: as constantes e a ordem das faixas, o bolo em 600
sorteios nos dois motores, a semente (mesma = mesmo bolo; outro ciclo/treinador = outro; outra faixa
= as MESMAS linhas noutra forma), as 9 forjas recusadas, a faixa carimbada e andando só quando a liga
acontece, o tipo na lista do cron, a tela, a inscrição, o ranking/histórico comparados com a Clássica
lado a lado, e o **PONTA A PONTA** com 8 e com 5 inscritos.
**Conferido que os 35 defeitos religados acusam** (1 a 7 falhas cada).

### AS QUATRO LIÇÕES QUE SAÍRAM DAQUI

1. **⚠️ TDZ PELA QUINTA VEZ NO PROJETO.** A lista de exclusão nasceu como
   `const PRO_FORA_DO_BOLO = ESPECIES_INTOCAVEIS...` na linha 3987, e o `ESPECIES_INTOCAVEIS` mora na
   8549 — `ReferenceError` no carregamento, ou seja **o servidor inteiro morria**. Virou função
   memoizada, que é imune à ordem.
2. **⚠️ UM COMENTÁRIO ESCONDEU UM DEFEITO REAL — e é a SÉTIMA vez desta família.** As seis anteriores
   foram comentários **acusando o que estava certo**; esta foi o contrário: o comentário do
   `drawCycle` citava o nome da função de validação, e a trava lia uma **fatia** que o incluía — com
   a validação removida ela **passou em branco**. Hoje ela lê a LINHA do `filter`, e o comentário não
   reproduz o nome.
3. **⚠️ TRÊS ÂNCORAS DO MEU SCRIPT DE ACUSAÇÃO ESTAVAM ERRADAS**, e "âncora não casou" se lê igual a
   "a trava passou em branco". O script confere que **o arquivo MUDOU** antes de rodar o teste.
4. **⚠️ E DUAS TRAVAS MINHAS NÃO DISTINGUIAM NADA**: a do índice forjado testava com os **seis
   cheios**, onde quem barra é o TETO; e a dos quadros cobrava **igualdade** com a Clássica, o que
   passaria de volta com o vazamento do histórico global. As duas só apareceram na conferência.


### ⚠️ A DESCRIÇÃO ERA A DA CLÁSSICA, O CONTADOR SOMAVA AS DUAS, E OS GOLPES FALTAVAM (23/09/2026)

Pedido assim: *"na liga pro, muda a descrição, esta aparecendo a descrição da Liga Classica.
Atualize para ficar no mesmo modelo da Liga Classica mas explicando como funciona a Liga Pro. O
contador de quantas vezes venceu 'Campeao da Liga Pokemon', pode fazer separado somente para a
Liga Pro. E coloque que após escolher os 6 pokemons, o usuario vai precisar escolher os ataques de
cada pokemon tambem, até aquele level que ele esta, e ai sim a inscrição vai ser feita"*.

#### ⚠️ A DESCRIÇÃO CAÍA NO `else`, E A CAUSA É A PRO SER UM TIPO RESERVADO

O render tinha **dois** ramos: `typeConfig ? (a customizada) : (a CLÁSSICA)`. E a Pro, como a
Clássica, **não vive na coleção `leagueTypes`** — ela não tem `typeConfig`, então caía no `else`
e o jogador lia a descrição da liga errada. Hoje são três.

**⚠️ E TODO NÚMERO DELA É DERIVADO** (`PRO_SORTEADOS`, `PRO_ESCOLHE`, `PRO_FAIXAS`,
`REGULAR_LIGA_SIZE`): um `12` escrito na frase envelheceria no primeiro ajuste, que é o defeito do
*"Revezamento · 900 m"*. **⚠️ E COMPARAR O HTML COM A CONSTANTE NÃO DISTINGUE OS DOIS** — hoje 12 é
12 —, então quem prova a derivação é **ler o código**. É a mesma técnica que a conta da Pokédex
precisou horas antes, onde 250+1 dava 251 e o número fixo passava.

**Ela explica só o que a Pro tem de DIFERENTE**, e é o pedido ao pé da letra (*"no mesmo modelo da
Liga Classica"*): o resto da mecânica é igual, e repeti-lo faria duas telas dizendo a mesma coisa.

#### O CONTADOR: SEPARADO NA TELA, SOMADO NA CONTA

| | |
|---|---|
| a tela da **Pro** | `leagueWinsPro` · *"Campeão da Liga Pro"* |
| a tela da **Clássica** (e das customizadas) | `leagueWinsTotal` · *"Campeão da Liga Pokémon"* |

**⚠️ E A PRO CONTA NOS DOIS CAMPOS — o recorte é só a TELA.** Contando só no dela, as **conquistas
e o histórico deixariam de ver a Pro**; contando só no total, a tela dela mostraria as vitórias da
Clássica junto, que é exatamente o que o pedido tira. Ela sobe por `increment` na mesma escrita.

- **⚠️ OS DOIS MOTORES CONTAM**: o `recordLeagueChampionWin` existe no cliente **e** no servidor (é
  ele que roda quando o navegador de outro jogador resolve a partida). Divergindo, o contador
  ficaria certo em umas contas e errado em outras — e ninguém saberia quais.
- **E o campo entrou no `CAMPOS_DA_CONTA`**: sem isso o `resetGame` o apagaria ao abrir um save.

#### ⚠️ OS GOLPES: A TELA DA JORNADA, REUSADA — E ELA É A SEGUNDA METADE DA INSCRIÇÃO

Antes o botão dos 6 inscrevia direto, e o time entrava com o `ataquesPadrao` (os mais fortes,
escolhidos pelo motor). Hoje ele leva a uma **fila de telas de golpe**, e só a última inscreve.

**⚠️ E A ESCOLHA É A DECISÃO MAIS FORTE DO JOGO:** medido em 09/09/2026, o par de golpes vale
**79 pontos** de taxa de vitória entre o melhor e o pior par. Numa liga em que o time é sorteado,
ela é a **única** coisa que o jogador decide além de quais 6 levar.

- **⚠️ A LISTA É A MESMA DA JORNADA** (`listaDeGolpesHtml`, extraída pra isso): as telas de golpe
  da casa dividem os blocos desde 09/09, e montadas em separado elas **já tinham divergido no
  texto e no tamanho da fonte**. Uma cópia aqui seria a quarta.
- **⚠️ QUEM TEM `MAX_GOLPES` OU MENOS DISPONÍVEIS NÃO VÊ TELA** — escolher 3 entre 3 não é escolha,
  e uma tela de uma resposta só é pior que tela nenhuma. É a MESMA regra da captura na jornada.
- **QUANTAS TELAS ISSO DÁ, MEDIDO** (40 bolos por faixa, dos 6 escolhidos):

  | faixa | telas de 6 |
  |---|---|
  | **55–70** | **5,0** |
  | 15–30 | **0,9** |
  | 35–50 | 3,8 |

  ⚠️ **A faixa 15–30 quase não pergunta**, e é aritmética: ali quase todo mundo ainda tem 3 golpes
  ou menos. A rodada de 55–70 é a que cobra a decisão.
- **⚠️ O MAPA É POR ÍNDICE DO BOLO** (`game.proGolpes`), nunca por espécie: voltar ao picker pra
  trocar UM dos seis **não custa os golpes dos outros**. Por espécie, dois pokémon iguais no bolo
  colidiriam; por posição do time, trocar um deslocaria todos.
- **⚠️ E O CICLO QUE VIRA LIMPA OS GOLPES JUNTO**, pelo mesmo motivo: o bolo passa a ser OUTRO, e
  o índice 3 herdaria os golpes de um bicho que nem está mais na tela.
- **QUEM VALIDA É A AÇÃO**: o `proConfirmarGolpes` revalida contra o `ataquesEscolhiveis` e recusa
  com menos que `MAX_GOLPES` — a mesma regra do `confirmarAtaques` da jornada.
- **⚠️ E A INSCRIÇÃO FILTRA DE NOVO**, com o `ataquesPadrao` só de rede: um golpe que a espécie não
  aprende sumiria no `golpesValidos` do servidor, e o time entraria na liga com **menos golpe do
  que a tela mostrou**.

**⚠️ E A TRAVA DISSO PASSOU EM BRANCO NA PRIMEIRA VERSÃO.** A inscrição fala com o Firestore, então
ela é **dublada** no teste — e a asserção *"são os escolhidos"* media a **cópia da regra que o
próprio teste escreveu**. É a armadilha do *"trava que pergunta à função que ela mede não é
trava"*, e só a conferência de acusação a pegou. Hoje quem prova isso é a leitura do código.

**NO MOTOR, NADA:** `MOTOR 5481ce57abca / DIARIO a4c6725aa4aa`, idêntico em 900 batalhas semeadas.

**Medido a 320px, no navegador:** a tela da Pro em **305×1.503px** (a Clássica em 1.377), a de
golpes em **826px**, cards de golpe em 243px, **todos os `<h2>` em uma linha**, nenhum texto
cortado e **sem rolagem lateral** em nenhuma das três.

`tools/test-liga-pro.js` foi a **157 asserções**, e **os 14 defeitos religados acusam** (1 a 12
falhas cada). ⚠️ **Ele foi a 170 horas depois** -- ver a seção seguinte.


### BRONZE, PRATA E OURO — E A ROTAÇÃO MUDOU DE ORDEM (23/09/2026)

Pedido assim: *"A cada vez que acontece uma Liga Pro, uma faixa de level é selecionada seguindo a
ordem: Liga Pro Bronze: Level 15-30. Liga Pro Prata: Level 35-50. Liga Pro Ouro: Level 55-70"* —
mais a frase do mínimo de 8, o Level maior no card dos 12 e *"crie um quadro indicando qual é a
faixa de level que é a liga atual"*.

#### ⚠️ A ORDEM ERA OUTRA, E REORDENAR A TABELA MEXE EM QUEM JÁ ESTÁ INSCRITO

A `PRO_FAIXAS` era `[[55,70],[15,30],[35,50]]` — a ordem do pedido de quando a liga nasceu. Hoje é
a escada **Bronze → Prata → Ouro**.

**⚠️ E ISSO NÃO É SÓ TROCAR TRÊS PARES DE NÚMEROS: o `proFaixa` do ciclo é um ÍNDICE.** Reordenar
muda a faixa de **todo ciclo já gravado** — e como o bolo é semeado por `uid + cycleId + faixa`, o
time de quem já se inscreveu deixa de bater. O filtro do `drawCycle` roda **ANTES do leftover**,
então ele **descartaria o jogador em silêncio**: ele não vai pra liga e nem volta pra fila.

**Medido no Firestore antes de mexer:** o ciclo aberto (`1790208000000`) tinha `proFaixa: 0` e
**1 inscrito**. Por isso a virada veio com o carimbo reconciliado em produção — o ciclo aberto foi
para o índice que continua sendo 55-70 (o **2** na ordem nova), e o `proFaixaIdx` junto.
**A pedido:** *"pode deixar que essa primeira fique no level que está e siga o ciclo que
combinamos"*. Conferido: o bolo daquele jogador sai **idêntico** antes e depois.

#### ⚠️ O NOME DO TIER SAI DO NÍVEL, NUNCA DO ÍNDICE

`proNomeDaFaixa` ordena as faixas **por nível** e usa a posição nessa ordem: a mais baixa é a
Bronze, a do meio a Prata, a mais alta a Ouro.

Indexado pela posição na **rotação**, reordenar renomearia os três — e quem viu *"Liga Pro Prata:
Level 35-50"* ontem leria *"Ouro: 35-50"* hoje. É a mesma família do rótulo que descreve uma tabela
e envelhece quando ela muda.

- **A tabela de nomes vive SÓ NO CLIENTE**, como o `MOVE_BY_TYPE` e o `TIPO_DO_ESPECIAL`: o
  servidor não tem tela, e o que ele precisa da faixa são os dois números.
- **⚠️ E O RÓTULO TEM UM DONO** (`proRotuloDaFaixa`), lido pelas três telas que o mostram: a
  descrição, o quadro e o picker. Escritos em separado, o quadro diria "Prata" e a descrição diria
  outra coisa no primeiro ajuste — e o nome do tier é justamente o que liga as duas leituras.
- **⚠️ E A LISTA DA DESCRIÇÃO SAI NA ORDEM DA ROTAÇÃO**, não ordenada por nível: a frase diz
  *"seguindo a ordem"*, então é a rotação que ela descreve. Hoje as duas coincidem; no dia em que a
  rotação mudar, é a rotação que a lista tem que mostrar. Há trava que religa a ordem inversa.

#### O QUADRO DA RODADA — E ELE DIZ QUAL VEM DEPOIS

A faixa já estava na tela, mas como uma **linha** dentro do bloco de inscrição: ela sumia
justamente depois de o jogador entrar, que é quem vai lutar nela. Hoje é um quadro próprio, acima
do contador, com três linhas — `A RODADA DE AGORA` · `Liga Pro Ouro` · `Level 55-70` — mais a
**próxima** da rotação (*"Depois dela vem a Liga Pro Bronze: Level 15-30"*), a pedido.

- **⚠️ ELE SAI DA ENTRADA DO CICLO, não do `game.proFaixa`:** aquele campo só é preenchido quando o
  picker abre, e a tela da Liga pode nunca ter passado por lá.
- **⚠️ A PRÓXIMA É UMA PROMESSA CONDICIONAL**, e a frase diz *"depois dela"* e não *"amanhã"*: a
  faixa só anda quando uma liga **acontece**, e com menos de 8 inscritos a fila continua nesta
  mesma. Quem conta a condição é a descrição logo acima.
- **A linha velha saiu**: com as duas, a tela diria a mesma coisa duas vezes na mesma rolagem.
- **⚠️ E A TRAVA DELE CASAVA COM A CLASSE PELA METADE:** `/pro-faixa-box/` casa com
  `pro-faixa-box-QUALQUERCOISA`, e foi assim que o defeito religado **passou em branco** na
  conferência de acusação. Hoje ela procura `class="box pro-faixa-box"` inteiro. É a armadilha do
  padrão largo demais, agora dentro da própria trava.

#### O LEVEL DO CARD DOS 12: .52rem → .58rem, E SÓ NA PRO

Medido a 320px: **8,32px → 9,28px**, com a cor indo do `--muted` para o `--ink`. Ele **não passa do
nome** (que é `.58rem`): maior, a hierarquia do card inverte e o olho lê o número antes da espécie.

**⚠️ E ELE É ESCOPADO NO `.pro-bolo`**, porque o card é o **MESMO** da Seleção da Ilha Kumquat, com
a mesma classe. Sem o escopo, uma tela que ninguém pediu mudaria junto — e lá a faixa de nível não
é a mecânica da liga, enquanto aqui é: os 12 saem todos dentro dela, e o que separa um do outro é
justamente o nível. Há trava cobrando que a Seleção continue em `.52rem`.

#### ⚠️ E A FAIXA NOVA DESENTERROU UMA TRAVA QUE MEDIA O PAINEL

A do fluxo de golpes cobrava *"todos com 3 golpes"* — verdade enquanto a rotação começava no
**Ouro**, e falsa na **Bronze**. Medido em 720 sorteios por faixa, quantos golpes de dano a espécie
aprende **naquele nível**:

| faixa | 3 golpes | 2 | 1 | nenhum |
|---|---|---|---|---|
| **Bronze 15-30** | **43,6%** | 38,8% | 15,6% | 2,1% |
| Prata 35-50 | 89,4% | 6,9% | 2,6% | 1,0% |
| Ouro 55-70 | **94,3%** | 1,8% | 2,9% | 1,0% |

**Isso não é defeito: é o auto-preenchimento funcionando.** Quem tem `MAX_GOLPES` ou menos
disponíveis não vê tela e leva o que dá — a mesma regra da captura na jornada. A trava passou a
cobrar **"cada um leva o que dá, até 3"**, que é a regra; o "3" era o painel.

⚠️ **E ISSO É UMA CONSEQUÊNCIA REAL DA ORDEM NOVA:** a Bronze é a rodada em que a escolha de golpes
quase não é pedida (0,9 tela de 6, contra 5,0 na Ouro), e em que quase metade dos times entra com
menos de três golpes por pokémon. Ela é a mais fraca das três **por construção**, e agora é a
primeira da rotação.

**NO MOTOR, NADA:** `MOTOR 5481ce57abca / DIARIO a4c6725aa4aa`, idêntico em 900 batalhas semeadas —
a faixa muda QUAIS pokémon são sorteados, e o motor de batalha não sabe da liga.

**Medido a 320px, no navegador:** a tela da Pro em **305×1.589px** (era 1.503), o quadro em
**281×117px** com a linha da próxima em 1 linha, os pickers em 996px nas duas faixas, e **nenhuma
rolagem lateral nem texto cortado** em nenhuma das três.

`tools/test-liga-pro.js` foi a **170 asserções**, e **os 11 defeitos religados acusam** — três deles
passavam em branco até as travas cobrarem o TEXTO das frases e a classe inteira do quadro.

### O CAMPEÃO DA LIGA PRO GANHA MOEDA, NÃO BÔNUS SHINY (24/09/2026)

Pedido assim: *"coloque para o vencedor da liga pro, ao inves de ganhar bonus shiny, ganha 100
moedas"*. São **🪙 100** (`MOEDAS_CAMPEAO_PRO`), **1,4 jornada completa** de renda.

#### ⚠️ ELA É PAGA NA HORA, E NÃO É UM CUPOM — e essa é a decisão

O bônus shiny é cupom por uma razão: ele vale **1h A PARTIR da ativação**, então ativar na hora
errada desperdiça o prêmio. **Moeda não expira.** Um cupom dela seria um clique sem razão e, pior,
**um jeito de PERDER o prêmio** — apagar a notificação, que é exatamente o defeito de 10/09/2026
(*"deletei a notificação e o bônus shiny sumiu da mochila"*).

Então a notificação da Pro é só um **ANÚNCIO**: as moedas já estão na conta quando ela chega.

#### ⚠️ MAS A NOTIFICAÇÃO É A MESMA (`league_champion`), E ISSO ABRE SEIS PORTAS

Ela **É o cupom** do bônus shiny na Clássica — a única porta dele —, e **seis leitores** decidem
por ela. Escrito em cada um, a da Pro viraria um **CUPOM FANTASMA**: dava pra ativar 1h de shiny
**além** das 100 moedas.

| onde | o que a porta faz |
|---|---|
| `advanceCyclePhases` (servidor) | paga e escolhe o corpo da mensagem |
| `activateShinyBonus` (servidor) | **recusa** ativar a da Pro — é aqui que a forja para |
| `resgatarPremiosDasNotificacoes` (servidor) | não credita `bonus_shiny` ao apagá-la |
| `notificationPendingReward` (cliente) | não avisa "bônus ainda não ativado" |
| `ctaDaNotificacao` (cliente) | confirma as moedas em vez de oferecer a mochila |
| `cuponsDeBonusShiny` (cliente) | não a lista como fonte de shiny |

Quem responde é **uma função só**, `notifDeCampeaoTemCupom`, duplicada nos dois motores.

- **⚠️ O CRITÉRIO É POSITIVO (`meta.moedas` presente), nunca `leagueTypeId === 'pro'`:** notificação
  gravada **antes** desta data não tem o campo e continua sendo cupom — que é o que ela sempre foi.
  Pelo `leagueTypeId`, o critério seria sobre a LIGA e não sobre o PRÊMIO, e uma liga que mudasse de
  prêmio um dia apagaria o cupom de quem já tinha ganhado.
- **⚠️ E `moedas: 0` CONTA COMO PAGO** (o `== null` pega só `undefined`/`null`) — a armadilha do
  índice 0 que o `proFaixa` já registra, valendo nos dois sentidos.
- **O `activated` e o `moedas` são EXCLUDENTES no meta**: um descreve um cupom e o outro um prêmio
  já pago, e pôr os dois deixaria no documento um campo que não significa nada.

#### ⚠️ O PAGAMENTO SÓ EXISTE NO SERVIDOR — e nem poderia existir no cliente

`moedas` está na **trava de campos do `firestore.rules`**: uma escrita vinda do cliente é recusada.
E isso casou de graça com o que já era verdade — **conferido: o cliente nunca criou a notificação de
campeão** (ele só chama o `recordLeagueChampionWin`), então esta porta já era exclusiva do servidor.

- **⚠️ E O PAGAMENTO VEM ANTES DO ANÚNCIO**, que é a regra que as 376 notificações de 13/09
  custaram: se ele falhar, o campeão fica sem aviso — e o contrário (ler *"ganhou 100 moedas"* sem
  tê-las) é o lado errado pra errar. Há trava sobre a ORDEM, não só sobre a presença.
- **A trava das regras entrou junto**: sem `moedas` naquela lista, o pagamento continuaria
  funcionando **e** o cliente passaria a poder se pagar sozinho.

#### ⚠️ UMA FRAGILIDADE HERDADA, e ela é anterior a isto

**Se o CLIENTE resolver a final, ninguém é notificado nem pago.** O `advanceCyclePhases` do cliente
grava o campeão e chama o `recordLeagueChampionWin`, mas **não cria a notificação** — e na passada
seguinte o cron vê o ciclo `complete` e não roda mais. Ou seja o prêmio (o shiny na Clássica e agora
a moeda na Pro) depende de o **cron** resolver a última partida.

Isso **não foi mexido** — é anterior, não foi reportado e não foi pedido. Fica registrado porque a
moeda herdou a mesma dependência. Se um dia for pra valer, o lugar é o laço de campeões do cliente —
e ali o pagamento continuaria sendo impossível (a trava das regras), então a saída seria uma
callable.

#### NA TELA

| | |
|---|---|
| a descrição da Liga Pro | *"O vencedor ganha **🪙 100 moedas**, creditadas na hora."* |
| a notificação | *"Sua recompensa: 🪙 100 moedas, já creditadas na sua conta."* |
| o CTA dela | **✅ 🪙 100 moedas creditadas na sua conta** + o botão do chaveamento |

- **⚠️ O NÚMERO SAI DA CONSTANTE, nunca escrito na frase** — ele envelheceria no primeiro reajuste,
  que é a família do *"Revezamento · 900 m"*. A constante existe no cliente **só pra a tela lê-la**;
  quem paga é o servidor.
- **O botão da liga FICA** no CTA: o que saiu foi só a oferta da mochila. Com `cycleId` no meta ele é
  o **"Ver o chaveamento"**, e há trava cobrando que ele não se perdeu quando o bloco do prêmio virou
  um `return` antecipado.
- **A Clássica não muda um caractere** — e a trava cobra o PAR: a Pro diz moeda **e** a Clássica
  continua dizendo bônus shiny. Sem a segunda metade, uma mudança que trocasse o prêmio das DUAS
  passaria.

**Medido a 320px, no navegador:** a tela da Pro vai de 1.503 para **1.505px** (a frase nova é mais
curta que a antiga), o CTA em **296×276px**, **zero textos cortados** e **nenhuma rolagem lateral**
nas duas.

**NO MOTOR, NADA:** `MOTOR 2d6a83f24cf1 / DIARIO 72e61601d1fb`, idêntico em 900 batalhas semeadas.

#### ⚠️ E ELE CUSTOU UM TDZ QUE DERRUBAVA O SERVIDOR INTEIRO

Eu exportei a constante (`exports._MOEDAS_CAMPEAO_PRO = MOEDAS_CAMPEAO_PRO`) numa linha **2.500
acima** da declaração dela: `ReferenceError` no carregamento do módulo, ou seja **nenhuma function
sobe**. É a **sexta** vez desta armadilha no projeto, e a segunda em que ela mata o servidor (a
outra foi o `PRO_FORA_DO_BOLO`).

**Declaração de `function` é hoisted; `const` não.** O export da FUNÇÃO podia ficar ali; o da
constante, não — e ele nem era necessário: **o teste lê o valor do FONTE por regex**, que é o padrão
dele (o `P_MIN`). ⚠️ E tinha que ser assim de qualquer jeito: **`const` não vira propriedade global
do sandbox**, então `S.MOEDAS_CAMPEAO_PRO` volta `undefined` — a lição que a Queimada já tinha
custado.

**⚠️ E UMA CONSTANTE DE TESTE LIDA POR DOIS BLOCOS PRECISA FICAR NO ESCOPO DO MÓDULO:** declarada
dentro de um deles, o outro não a vê (`ReferenceError` no meio do arquivo). Ela nasceu ao lado do
`P_MIN`, que está dentro de um bloco, e o bloco do prêmio — 370 linhas abaixo — não a enxergava.

### ⚠️ O PICKER NÃO PEDIA OS GOLPES DE NOVO (24/09/2026)

Reportado assim: *"Algo de estranho ta na parte que escolhe os golpes dos pokemons que serão
inscritos na Liga Pro, porque eu coloquei o raichu e a bellossom no meu time, e nao pediu para eu
escolher os golpes deles. E quando eu cancelar a inscrição, e inscrever um novo time, tem que pedir
os golpes de cada pokemon de novo"*.

**⚠️ AS DUAS METADES DO RELATO SÃO UM DEFEITO SÓ:** o `game.proGolpes` é indexado **por índice do
bolo** (é o que faz voltar ao picker pra trocar UM dos seis não custar os golpes dos outros), e
**reabrir o picker não o limpava**. Então o índice 3 do bolo NOVO herdava os golpes do índice 3 do
bolo ANTIGO — e um pokémon que já tem golhes gravados **não entra na fila**, ou seja ele não é
perguntado.

- **A porta é uma função só** (`proLimparGolpes`), chamada de **dois** lugares: o `abrirBoloDaLigaPro`
  e o ramo do "ciclo virou". Escrita nos dois, o próximo ponto que abrir o picker nasceria sem ela.
- **⚠️ E O `proVoltarDosGolpes` NÃO CHAMA, de propósito:** voltar pra trocar um pokémon não pode
  custar os golpes dos outros cinco — é exatamente o que a indexação por índice compra.

**⚠️ E O RAICHU E A BELLOSSOM TÊM CAUSAS DIFERENTES — o relato juntou dois casos.** Medido antes de
mexer, quantos golpes **escolhíveis** cada um tem no nível do bolo:

| | antes da herança | hoje |
|---|---|---|
| **Raichu** | **exatamente 3** | **5** |
| **Bellossom** | 4 | 4 |

Ou seja: o Raichu **não ser perguntado era a REGRA funcionando** (quem tem `MAX_GOLPES` ou menos
disponíveis não vê tela — escolher 3 entre 3 não é escolha), e ele só passou a ter escolha porque a
**herança do aprendizado da linha** entrou no mesmo dia. A Bellossom tinha 4 e **devia** ter sido
perguntada — essa metade era o `proGolpes` sujo.

`tools/test-liga-pro.js` tranca o caso do relato dirigindo o `abrirBoloDaLigaPro` de VERDADE (com o
preâmbulo dublado), e cobra as três pontas: o mapa dos golpes zerado, a tela pendente zerada e os
marcados zerados. **⚠️ E OS TRÊS PRECISARAM SER SUJADOS ANTES**, senão a trava passa em branco: o
`proConfirmarGolpes` já zera os marcados e o `proVoltarDosGolpes` já zera a tela pendente, então um
fixture "limpo" não distingue os dois lados. Conferido que os 2 defeitos religados acusam.

### A FONTE DO CARD DOS 12 CRESCEU (24/09/2026)

Pedida com print do picker: *"os textos que estao escritos dentro de cada card do pokemon, nome,
level e selo com os tipos, pode aumenta a fonte de todos os textos"*.

| a 320px | Seleção (o card base) | **Liga Pro** |
|---|---|---|
| nome | `.58rem` — 9,28px | **`.72rem` — 11,52px** |
| Level | `.52rem` — 9,28px | **`.70rem` — 11,2px** |
| selo de tipo | `.45rem` — 7,2px | **`.58rem` — 9,28px** |
| card | 78×128px | 78×**155px** |
| o bolo de 12 | 527px | **635px (+20,5%)** |

- **⚠️ E O NOME PASSOU A QUEBRAR EM VEZ DE TRUNCAR, e isso foi MEDIDO antes de escolher:** deixando
  o nome numa linha só, o truncamento **explode** — de **7 nomes de 500** a `.52rem` para **115** a
  `.72rem`. Quebrando em duas linhas, os truncados são **ZERO em qualquer tamanho**, e o preço são
  os 108px do bolo. **Medido no navegador nos dois builds, com a mesma largura útil: 0 truncados.**
- **⚠️ E O `min-height` DE DUAS LINHAS É O QUE MANTÉM A GRADE ALINHADA:** sem ele, um nome curto
  deixa o card mais baixo que o vizinho — e a grade de 3 é justamente onde o olho compara.
- **⚠️ AS TRÊS REGRAS SÃO ESCOPADAS NO `.pro-bolo`**, porque o card é o **MESMO** da Seleção da Ilha
  Kumquat, com a mesma classe. Sem o escopo, uma tela que ninguém pediu mudaria junto.
- **A HIERARQUIA FICA DE PÉ:** o Level não passa do nome. Maior que ele, o número seria lido **antes
  da espécie** — e o card existe pra o jogador reconhecer QUEM ele está escolhendo.

**⚠️ E A TRAVA QUE EXISTIA CRAVAVA `.58rem` E CAIU COM O CÓDIGO CERTO** — a **sexta** vez que essa
família envelhece neste projeto. Ela não foi afrouxada: passou a medir a **REGRA**, com os seis
tamanhos **derivados do CSS** e comparados entre si (os três da Pro maiores que os da Seleção, e o
Level e o selo abaixo do nome).

**⚠️ E ESCREVÊ-LA PEGOU UMA ARMADILHA CONHECIDA: o CSS base usa o atalho `font:` e o da Pro usa
`font-size:`.** Uma regex que procure só `font-size` na regra base **atravessa** a regra e casa com
a da Pro — e aí a trava compara a Pro **com ela mesma**: o nome saía *"72 → 72"*, como se ele não
tivesse aumentado. É o mesmo atalho `font` que o ranking da Corrida já custou.

**No motor, nada:** `MOTOR 2d6a83f24cf1 / DIARIO 72e61601d1fb`, idêntico em 900 batalhas semeadas.
**Conferido que os 7 defeitos religados acusam.**

### ⚠️ A TRAVA DE "JÁ ESTÁ DISPUTANDO" ACABOU (24/09/2026)

Pedida assim: *"quando um jogador esta disputando uma liga e a partida começa, hoje existe uma trava
que enquanto nao acabar o campeonato, ele nao pode se inscrever de novo, tire isso"*.

**⚠️ ERAM DUAS TRAVAS COM NOMES PARECIDOS, E SÓ UMA SAIU.** A que fica é a `DUPLICATE` — a transação
que impede a **mesma conta se inscrever duas vezes no MESMO ciclo aberto**, e ela é o que protege o
chaveamento de ter o jogador em duas vagas. A que saiu é a `ACTIVE_ELSEWHERE`: ela olhava os ciclos
**já sorteados** (`drawn`/`advancing`) e recusava a inscrição no ciclo **seguinte**.

#### ⚠️ ELA CUSTAVA UMA IDA AO SERVIDOR POR CICLO EM ANDAMENTO

O `isAccountActiveInLeague` **varria o calendário**: lia a agenda e, pra **cada** ciclo em
andamento, lia o documento dele inteiro pra procurar o uid dentro do chaveamento. Hoje é uma leitura
só — `registrantDocRef(typeId, cycleId, uid).get()`, o documento da própria inscrição:

| o clique de inscrever, com uma liga rodando | idas ao servidor |
|---|---|
| antes | **4** |
| **hoje** | **3** |

⚠️ **E ISSO SE SOMA AO CONSERTO DE 16/09**, que já tinha levado o clique de 6 pra 4 (o preâmbulo
único). A 200ms de ida e volta daqui até o Firestore — ele está em `nam5`, nos EUA, e os jogadores
no Brasil (ver **PERFORMANCE: A GEOGRAFIA MANDA**) —, são **800ms em vez de 1.000**.

#### ⚠️ O QUE A TELA MOSTRAVA, E POR QUE ELA NÃO PRECISOU DE CAMPO NOVO

O aviso e o botão desabilitado saem do `game.accountLeagueSlots`, que é preenchido pelo
`checkLeagueRegistrationStatus` — e ele olha **o ciclo aberto primeiro**. Dentro do ramo
`!alreadyIn` (que é onde o bloco de inscrição vive), um `accountLeagueSlots` não-nulo **só pode ter
vindo de um ciclo sorteado**: se ele fosse do aberto, o `alreadyIn` seria verdadeiro.

**A condição da tela já isolava o caso**, então não houve estado novo a inventar — o que mudou é o
que ela FAZ com ele:

| | antes | hoje |
|---|---|---|
| o botão | `disabled` | **clicável** |
| o aviso | *"…Espere ela terminar pra poder se inscrever de novo."* | *"… — e pode se inscrever nesta aqui também."* |

**⚠️ E O AVISO FICA, de informativo:** ele nomeia **qual time** está na disputa, e sem ele o jogador
que já tem um chaveamento rodando não teria como saber disso ao montar o próximo.

#### ⚠️ O SERVIDOR NÃO FILTRAVA — conferido antes de mexer

O `drawCycle` monta a liga com **quem está na subcoleção de inscritos**, e ele não lê ciclo nenhum
em andamento. Ou seja **a trava era inteiramente do cliente**, e tirá-la lá bastou.

**⚠️ E O PAINEL DE ADMIN CONTINUA MAIS RESTRITIVO, o que é uma assimetria DELIBERADA e anterior:**
o `adminJaInscritoEmAlgumaLiga` varre **todos os tipos** (a trava dele é da CONTA, não da liga),
enquanto a do jogador sempre foi por TIPO — o `accountLeagueSlots` é um mapa indexado por `typeId`,
e a tela diz *"já está disputando ESSA Liga em outra rodada"*. O que saiu do painel foi só o mesmo
ramo do chaveamento; a varredura por tipo ficou.

**⚠️ E ISSO ABRE UMA PORTA QUE VALE REGISTRAR: a mesma conta pode terminar em DOIS chaveamentos do
mesmo tipo**, um em andamento e o do ciclo seguinte. É o que o pedido pede, e o `DUPLICATE` continua
impedindo o caso que quebra o sorteio (duas vagas na MESMA chave). Se um dia incomodar, a régua é
devolver a checagem — e o custo dela está medido acima.

**Medido a 320px, no navegador**, com um chaveamento em andamento: o botão **não** está desabilitado
(243px), o aviso fica em **243×58px** (4 linhas), ele **nomeia o slot**, **não** manda esperar, e a
tela fica em **305 de 320** — sem rolagem lateral e **zero textos cortados**.

**No motor, nada:** `MOTOR e6cd16d15e0f / DIARIO 1e9b7214c627`, idêntico em 900 batalhas semeadas.

**⚠️ E AS TRAVAS QUE MEDIAM A TRAVA VELHA NÃO FORAM APAGADAS: elas foram VIRADAS DO AVESSO.** A do
aviso da jornada cobrava que quem está num chaveamento **não** visse o convite; hoje ela cobra que
ele **VEJA** — e que o chaveamento **nem seja lido**, que é a metade que prova a economia de idas.
Mais um bloco novo sobre a tela (o botão clicável, o aviso informativo, e quem JÁ está inscrito no
ciclo aberto continuando a ver a outra caixa). Sem elas, alguém devolve a trava e ninguém vê.

### A APOSTA COM O RIVAL (24/09/2026)

Pedida junto do anúncio: *"na jornada, ao perder para o seu rival, voce tem que pagar 5 de moeda
para ele, e se vencer, voce ganha 5"*.

**⚠️ ELA NÃO EXISTIA — o pedido a descrevia como se existisse, e isso foi conferido antes de
anunciar.** Anunciar uma mecânica que o jogo não tem seria pior que não anunciar, então ela foi
implementada.

**⚠️ E ELA É A ÚNICA FONTE DE MOEDA DO JOGO QUE ANDA PROS DOIS LADOS.** Tudo o mais só soma (a
insígnia, a Elite, o campeão da Pro) ou é uma COMPRA que o jogador escolhe fazer (o re-sorteio, a
loja). Aqui a moeda **sai da conta sem ele ter pedido**.

| | |
|---|---|
| o rival aparece em | **3 trechos** (`RIVAL_LEGS = [2,4,6]`), uma batalha cada |
| o teto de uma jornada | **±15** |
| a jornada paga | **70** (8×5 + 10 + 20) |
| **com a aposta** | **55 a 85** — uma amplitude de **30, ou 43% da jornada** |

Pra escala: 15 moedas são **3 re-sorteios** do encontro selvagem, e 30 (a amplitude) são 6.

#### ⚠️ ELA HERDOU A IDEMPOTÊNCIA DE GRAÇA, E ISSO DECIDIU O DESENHO

O `claimJourneyCoins` paga **por DIFERENÇA**: ele recalcula do zero quanto o save já rendeu
(`moedasDevidasDoSave`) e paga o que falta, guardando o total no `coinsPaid`. Então o saldo da
aposta entrou como **mais um termo daquela soma** — e com isso um F5, duas abas ou uma chamada que
morreu na rede não cobram duas vezes, sem uma linha de trava nova.

O cliente só acumula (`game.rivalCoins += ±MOEDAS_RIVAL`); quem paga e quem cobra é o servidor.

- **⚠️ E O TERMO PODE SER NEGATIVO, o que quase o fez sumir em silêncio:** o `claimJourneyCoins`
  fazia `Math.max(0, diferenca)` — uma guarda que existia pra nunca pagar negativo. Com ela, **a
  cobrança seria ENGOLIDA**: o `coinsPaid` andaria e a moeda não sairia. Há trava, e ela acusa.
- **⚠️ E A COBRANÇA É APARADA NO SALDO** (`Math.max(diferenca, -moedasAgora)`): o jogador **nunca
  fica negativo**. A parte impagável da dívida é **esquecida**, não fica pendente — o `coinsPaid` é
  carimbado com o devido de qualquer jeito, senão ela voltaria a ser cobrada na próxima vitória.
- **⚠️ E O CAMPO É NOVO, então TODO save existente lê 0:** ninguém é cobrado retroativamente. É a
  mesma decisão que o `coinsPaid` tomou quando ele nasceu.

#### ⚠️ O ROUND-TRIP DO SAVE TEM QUE SER INTEIRO, E O NEGATIVO ATRAVESSA

O `applySavedState` é explícito **campo a campo** — um campo que sai e não volta se perde num F5, e
isso já aconteceu com o `ilhasJornada` (21/09) e com o `ilhasResultado` (22/09).

**⚠️ E A LEITURA É `Number(data.rivalCoins) || 0`, NUNCA `Math.max(0, ...)`:** com o clamp, uma
dívida **sumiria na primeira reabertura do save** — o jogador perderia a batalha, fecharia o jogo e
voltaria sem dever nada. Há trava pras duas metades (o campo vai, o campo volta, e o negativo
atravessa).

#### ⚠️ O PAGAMENTO É PEDIDO NO PONTO DO RIVAL, e não no ginásio seguinte

O `receberMoedasDaJornada()` roda no fim do ramo do rival. Sem ele ali, a dívida só chegaria ao
servidor na próxima vitória de ginásio — e o jogador veria o saldo da tela discordar do que ele
acabou de fazer.

**E a TELA mostra a cobrança**, que é a outra metade: o `moedasGanhasHtml` só escondia o zero, e um
`n <= 0` ali engoliria justamente o caso novo. Hoje ele diz *"−5 moedas — a aposta com o rival saiu
da sua conta"*; o zero continua mudo.

**As duas frases da batalha carregam o número da constante**, nunca escrito — a família do
*"Revezamento · 900 m"*.

**No motor, nada:** `MOTOR e6cd16d15e0f / DIARIO 1e9b7214c627`, idêntico em 900 batalhas semeadas —
a aposta é um campo de save e uma linha de conta, não uma regra de batalha.

**⚠️ E NA DIFICULDADE ELA NÃO MOVE A JORNADA, por construção: o bot do smoke não gasta moeda.** O
que ela muda é o poder de compra — e a régua está aqui: **43% da renda de uma jornada**, ou seja
quem perde as três batalhas do rival compra **6 re-sorteios a menos** que quem ganha as três.
Se um dia incomodar, o lugar é o `MOEDAS_RIVAL` (nos DOIS motores).

### O ANÚNCIO DA LIGA PRO (24/09/2026)

Pedido junto: *"adicione um modal quando o usuario logar indicando a novidade da Ligo Pro na tela
home, aquele modal que tem igual informando a novidade das Ilhas Laranjas ... coloque um botao
levando para a tela principal da liga pro. Fale que o vencedor ganha 100 moedas"*.

**⚠️ O MECANISMO INTEIRO JÁ EXISTIA, E O ANÚNCIO NOVO FOI UMA LINHA** — que é o que a
`NOVIDADES_VERSAO` foi criada pra comprar, em 21/09: *"com um booleano este seria o único anúncio da
vida do jogo… com a versão, o próximo é uma linha"*. Ela girou de `ilhas-laranja` pra `liga-pro`, e
quem já leu o anterior vê este.

- **⚠️ E ELE NÃO É MAIS DE ADMIN.** O das Ilhas era, porque as Ilhas eram administrativas na época
  (ele anunciaria cinco jogos que ninguém conseguia abrir). A Liga Pro é de todo mundo, então a
  guarda de admin saiu junto com a versão. **O `contaCarregada` FICA**, e a razão é outra: o
  `novidadeVista` vem do documento da conta, e sem esperar a leitura ele é `undefined` no primeiro
  desenho — o anúncio abriria de novo pra quem já leu.
- **O `novidadesIrParaAsIlhas` MORREU** — ele ficou com zero chamadores no instante em que a versão
  girou, e função de apresentação sem chamador é o tipo de coisa que fica anos no arquivo.
- **O botão que leva à Liga Pro MARCA COMO LIDO**, como o das Ilhas: o que marca é ter **LIDO**, não
  o caminho tomado — sem isso, quem clica em "Ver a Liga Pro" reencontra o anúncio na próxima home.

#### ⚠️ O CORTE FOI MEDIDO A 320px, E ELE ACONTECEU DUAS VEZES

A caixa tem **483px de teto** (85vh de 568) e **o que NÃO é lista não cede** — só a lista tem o
`min-height:0`. É a mesma conta que o anúncio das Ilhas já tinha feito em 21/09.

| | a lista mostrava |
|---|---|
| 1ª versão (2 parágrafos, **DUAS listas**, fixos em 284px) | **11px e 6px** — ou seja invisíveis |
| 2ª (uma lista de **4 linhas**) | **2 de 4** (135 de 270px) |
| **hoje (2 linhas)** | **106 de 106px — NÃO rola** |

**⚠️ E A SEGUNDA MEDIÇÃO É A QUE DECIDIU O CORTE: os dois itens que ficavam escondidos eram
justamente OS GOLPES e AS 100 MOEDAS** — e o prêmio é uma das três coisas que o pedido nomeia. Uma
lista que rola por dentro **esconde sem avisar**.

O critério do corte foi o PEDIDO: ficaram **o time sorteado** e **o prêmio do campeão**. Os golpes
viraram meia frase do resumo da primeira (eles são a segunda metade da mesma inscrição), e **as
faixas saíram** — elas têm um **quadro próprio na tela da Liga Pro**, que é pra onde o botão leva, e
lá elas dizem a rodada de AGORA.

| medido a 320px, depois | |
|---|---|
| a caixa | **280×453px** |
| a lista | **106 de 106px** (não rola) |
| o último botão | y=**477 de 568** |
| textos cortados / selos vazios | **0 / 0** |
| rolagem lateral | **nenhuma** (docW 320) |

#### ⚠️ E O SELO DA PRIMEIRA LINHA ERA A BANDEIRA DA CORRIDA

Ela é a **linha de chegada**, e num anúncio de liga se lê como outro modo. **Foi a captura de tela a
320px que pegou** — em asserção de HTML ela passa, porque o selo existe e desenha. Hoje é o selo de
**TIME** da casa, e a trava é **comparativa**: ela extrai o selo do botão *"Seu time"* do jogo e
cobra que a linha use o mesmo. Cravado o nome aqui, ela envelheceria no dia em que a casa trocasse o
dela.

**Todos os números do modal são DERIVADOS** (`PRO_SORTEADOS`, `PRO_ESCOLHE`, `MAX_GOLPES`,
`MOEDAS_CAMPEAO_PRO`, `MOEDAS_RIVAL`), e há trava lendo o **código** pra provar isso — comparar o
HTML com a constante não distingue os dois, porque hoje 12 é 12. É a mesma técnica que a conta da
Pokédex precisou.

**⚠️ E AS TRÊS TRAVAS DAS FAIXAS NÃO FORAM APAGADAS: elas viraram a trava do corte** — a lista cabe
em 2 linhas, as faixas **não** estão no anúncio, e — a metade que faz o corte ser seguro — **elas
continuam na TELA da Liga Pro**. Sem essa segunda metade, alguém as devolve ao anúncio e a lista
volta a esconder o prêmio, **e só quem abrisse numa tela de 568 descobriria**.

**No motor, nada:** `MOTOR e6cd16d15e0f / DIARIO 1e9b7214c627`, idêntico em 900 batalhas semeadas.

**Conferido que os 20 defeitos religados acusam** (2 a 8 falhas cada).

#### ⚠️ E ELE CUSTOU DUAS LIÇÕES DE FERRAMENTA

1. **⚠️ O `node -e` E O HEREDOC COMERAM AS BARRAS DUPLAS, pela QUINTA vez nesta sessão.** Um
   `new RegExp('... (\\d+)')` escrito num heredoc chega no node como `(d+)` — e ele **não dá erro**:
   ele simplesmente não casa, e a medição devolve **zero**. Foi assim que a conta da aposta saiu
   `0 de 0 = NaN%`. **O caminho seguro é o regex LITERAL** (`/const X = (\d+)/`), que não tem o que
   escapar, e a ferramenta de edição de arquivo pra texto com escape.
2. **⚠️ UM `}` A MAIS SOBROU NUM CORTE, E O `node --check` PASSOU.** Chave extra dentro de um
   template literal é **TEXTO**: ela sairia literal na tela, depois do selo. É a mesma família do
   `${…}` que não interpola — **verificação de sintaxe não é verificação de conteúdo**, e o que a
   pegou foi ler o HTML gerado.

### O HISTÓRICO DAS ÚLTIMAS LIGAS PRO (25/09/2026)

Pedido assim: *"crie tambem um quadro na liga pro exibindo o historico das ultimas ligas pro, igual
como ja existe hoje para a liga classica"*.

**⚠️ O QUE FALTAVA ERA O QUADRO GLOBAL, e não o pessoal:** a Pro **já tinha** o Top 10 e o *"Suas
últimas Ligas"* — os dois que são POR LIGA. O que ela não tinha era o **"🌐 Últimas Ligas"** (as
últimas ligas de QUALQUER treinador), que era da Clássica e só dela.

E este arquivo registrava a razão de ele não ser por liga: *"o `loadGlobalLeagueHistory` varre o
`schedule_classic` e o botão dele CRAVA o tipo clássico em cada linha — ele nunca foi por liga"*.
**Era isso e mais nada**: o custo é 1 + até 20 leituras **no calendário de UM tipo**, ou seja a Pro
paga o MESMO que a Clássica já paga, na tela dela — **não é um custo a mais**.

### ⚠️ E ELE VAZAVA — e a correção de hoje fecha isso por CONSTRUÇÃO

O campo era **UM só** (`game.globalLeagueHistory`), carregado apenas quando a Clássica abria e
**nunca limpo** — então quem abria a Clássica e depois outra liga via o histórico DELA ali, com o
"Rever" levando ao chaveamento da Clássica. O defeito é anterior (ele já alcançava as customizadas),
e a guarda ficava no RENDER.

Hoje ele é um **MAPA por `typeId`** e o render lê a chave do tipo CORRENTE — **não existe estado de
outra liga pra aparecer aqui.**

### AS DECISÕES

- **⚠️ O PARÂMETRO `typeId` NÃO TEM PADRÃO.** Com `= CLASSIC_LEAGUE_TYPE` implícito, a próxima liga
  que chamasse a busca traria o histórico da Clássica **em silêncio** — que é literalmente o defeito
  do vazamento. É a mesma decisão do `ehDoJogador` do `corridaInstancia` e do `pescariaInstancia`.
- **⚠️ E O "REVER" SAI DA LIGA CORRENTE, e ele tinha o tipo clássico CRAVADO.** Numa linha da Pro ele
  abriria o chaveamento de uma liga da Clássica — e o **`cycleId` COINCIDE entre as duas** (elas
  rodam de hora em hora pelo MESMO relógio), então ele abriria um chaveamento **de verdade, o
  errado**, sem nada parecendo quebrado.
- **⚠️ A TRAINERS LEAGUE E AS CUSTOMIZADAS CONTINUAM SEM O QUADRO**, e é decisão: o pedido nomeia a
  Pro, e cada tipo que entrar aqui paga 1 + até 20 leituras por abertura da tela dele. Pra
  acrescentar um, é a linha do `refreshLeagueHistoriesInBackground`.
- **O campo NÃO entra no `CAMPOS_DA_CONTA` nem no `serializeGame`:** é cache de tela, relido a cada
  abertura da liga — e trocar de save deve limpá-lo.
- **⚠️ QUEM TEM A ABA ABERTA DE ANTES DO DEPLOY** tem o formato velho (um array) por alguns segundos
  e vê o quadro sumir; a próxima varredura (a abertura da liga ou o tique de 5s) repõe o mapa. Não
  há migração porque o campo não vai pro banco.

**Medido a 320px, no navegador, nas duas telas:** o quadro sai em **296×274px** — **idêntico** nas
duas —, com 3 linhas, a Grande Liga com a estrela, **cada uma mostrando os campeões dela**, o "Rever"
apontando pra liga certa, **nenhum texto cortado e sem rolagem lateral**. A marcação é a MESMA
(conferido por comparação do HTML), então não há layout novo.

**NO MOTOR, NADA:** `MOTOR 64db1d5912f1 / DIARIO 4a442b813ad9`, idêntico — e o instrumento é
sensível (com o `CRIT_BASE` mexido os dois hashes mudam).

**⚠️ E TRÊS TRAVAS MEDIAM A REGRA ANTIGA** (*"o global continua sendo da Clássica"*, *"a Clássica tem
UM quadro a mais"*). Elas não foram apagadas: viraram as da regra nova, e a **metade que importa é
cada liga mostrar O SEU** — com as duas mostrando o mesmo, o vazamento passaria de volta. Por isso o
fixture tem **campeões diferentes** em cada uma.

**⚠️ E ELAS PRECISARAM ABRIR O QUADRO:** ele é **DOBRÁVEL** e o conteúdo só é montado aberto
(17/09/2026) — e foi exatamente assim que a trava antiga passava com o vazamento, **ela só olhava o
título**, que é o mesmo nas duas.

**⚠️ E UM CASO DA CONFERÊNCIA DE ACUSAÇÃO FICOU MUDO:** a leitura dos ciclos (`cycleDocRef`) não é
alcançável por comportamento nenhum — o teste não chama a busca, que fala com o Firestore. A trava
que a pega **fatia a função inteira** e cobra que ela não cite o `CLASSIC_LEAGUE_TYPE` em lugar
nenhum: ela tem DUAS leituras, e uma trava por leitura deixa a próxima passar. Com ela, **7 de 7
defeitos acusam**.

**⚠️ E O FIXTURE DO `test-liga-inscricao` ESTAVA NO FORMATO ANTIGO, e a trava dele acusou o certo:**
*"a Liga Clássica desenha os TRÊS quadros — 2 quadros"*. Um array ali deixa a Clássica sem o quadro,
porque o render lê a chave do tipo. **A trava estava certa; o fixture é que envelheceu.**

### ⚠️ O TIME DE UM CICLO VAZAVA PRO CHAVEAMENTO DE OUTRO (25/09/2026)

Reportado assim: *"um usuário estava na liga com todo o time da Liga Pro Bronze, pokemons entre o
level 15-30. E aí antes da semi final, ele se inscreveu para a liga pro prata... E aí os pokemons
dele foi substituído no meio da competição"*.

**⚠️ REPRODUZIDO NOS DADOS DE PRODUÇÃO — o relato é literal.** O ciclo `pro__1790308800000` (o de
01:00, Bronze), lido do Firestore:

| rodada | o time dele |
|---|---|
| **0 (quartas)** | `furret:17 swinub:18 doduo:27 wobbuffet:28 wartortle:25 quilava:30` — **17 a 30** |
| **1 (semi)** | `nidoking:40 octillery:50 porygon2:44 exeggutor:41 weezing:41 venusaur:45` — **40 a 50** |
| **2 (final)** | o mesmo time PRATA, contra um adversário com 25–29 |

Ele foi campeão — contra gente com o time da faixa certa.

#### ⚠️ A CAUSA É UMA FUNÇÃO QUE EXISTE PRA REORDENAR

O `updateRegisteredTeamCode` (cliente) **varria TODOS os ciclos `drawn`** e reescrevia o `code` de
todo confronto não resolvido em que o uid aparecesse, com o `game.registeredTeam`:

```js
for(const entry of cycles){
  if(entry.status!=='drawn') continue;          // o chaveamento EM ANDAMENTO
  ... if(match.a && match.a.uid===uid){ match.a.code = newCode; ... }
```

Ele existe por uma razão legítima — **o jogador reordena o time na tela e o chaveamento acompanha**
— e ela vale na Clássica, onde o time **É da conta**: reordenar o mesmo time continua sendo o mesmo
time. **Na Liga Pro o time é SORTEADO por ciclo**, e aí:

1. o jogador disputa a Bronze (`drawn`) e se inscreve na Prata (`registering`) — **possível desde
   24/09**, quando a trava de *"já está disputando"* saiu a pedido;
2. o `checkLeagueRegistrationStatus` olha o ciclo **`registering` PRIMEIRO** ⇒ o `registeredTeam`
   vira o time **PRATA**;
3. ele reordena ⇒ o sync aplica o time Prata **no chaveamento da Bronze**;
4. e o `advanceCyclePhases` promove o **objeto** do vencedor (`nextMatch.a = match.winner`) ⇒ **o
   código trocado chega na final sozinho**.

**⚠️ E O CLAUDE.md JÁ TINHA REGISTRADO A PORTA QUE 24/09 ABRIU** (*"a mesma conta pode terminar em
DOIS chaveamentos do mesmo tipo"*) — o que não foi previsto é o time de um **vazar** pro outro.

**⚠️ E O SERVIDOR JÁ FAZIA O CERTO, o que aponta o erro:** o `atualizarInscricoesComTime` (o caminho
do Doce Raro) **só mexe em ciclo `registering`**, com a razão escrita ao lado — *"mudar o nível no
meio de uma disputa seria pior que não atualizar"*. **O cliente fazia o CONTRÁRIO: só mexia em ciclo
`drawn`.**

#### O CONSERTO SÃO DUAS CAMADAS, E ELAS PEGAM CASOS DIFERENTES

| | |
|---|---|
| **1. a CAUSA** | o `registeredTeam` passou a carregar **de qual ciclo veio** (`registeredTeamCycle`), e o sync só mexe NELE |
| **2. a REDE** | e só se o code novo for o **MESMO time em outra ORDEM** (o multiset de `espécie:nível:shiny`) |

- **⚠️ A REDE É EXATA porque a reordenação é o ÚNICO chamador do sync** — e reordenar não muda o
  conjunto. O nível entra na chave de propósito: **o Doce Raro** sobe nível, e subir nível no meio de
  um chaveamento é justamente o que o servidor já recusa. O shiny também (ele vale 1,20× em tudo).
- **⚠️ SEM CARIMBO O SYNC NÃO ESCREVE NADA**, e é o lado certo pra errar: o pior caso é a reordenação
  não valer, e a próxima leitura da tela repõe a ordem gravada.
- **Os dois pontos que escrevem um TIME são os dois que carimbam**, e há trava lendo o código: todos
  os outros pontos escrevem `null`, e o sync sai por `!game.registeredTeam` antes de olhar o carimbo.

#### ⚠️ E A CONFERÊNCIA DE ACUSAÇÃO ACHOU QUE A CAMADA 1 ERA INOBSERVÁVEL

Religando **o defeito de produção inteiro**, o teste **passava em branco** — porque no relato o time
Prata **não é permutação** do Bronze, e a **rede sozinha** já o barrava. Ou seja: o caso do relato
não distingue as duas camadas.

**⚠️ O CASO QUE SÓ A CAUSA PEGA É DA LIGA CLÁSSICA**, e ele é real: lá o time é da conta, então quem
disputa um chaveamento e se inscreve no ciclo seguinte se inscreve com **o MESMO time**. Reordenar a
inscrição nova não pode mexer na ordem de entrada do chaveamento que já está rolando — ele foi
congelado de propósito. O mesmo vale pra quem está em **dois chaveamentos `drawn`**.

Com esse caso no teste, **os 6 defeitos religados acusam**.

**NO MOTOR, NADA:** `MOTOR 128473196c86 / DIARIO 86697ceb8e91`, idêntico — e o instrumento foi
provado sensível.

**⚠️ O QUE ISTO NÃO CONSERTA: a liga das 01:00 já aconteceu.** O campeão dela lutou a semi e a final
com um time de outra faixa, e o resultado está gravado. Desfazer exigiria reescrever o chaveamento e
a colocação de todo mundo — e o registro do que aconteceu vale mais que um placar remendado.

**⚠️ E A ESCRITA NO `leagueCycles` É DO CLIENTE** (`allow write: if cadastrado()`), o que é o modelo
do projeto — é ele quem resolve partida de liga. Ou seja **a trava acima é de comportamento, não de
segurança**: um cliente forjado continua podendo reescrever um chaveamento. Isso é anterior a este
defeito e não foi mexido; fechá-lo exigiria mover a resolução de partida inteira pro servidor.

## O CHAVEAMENTO ACEITA MENOS TIMES QUE VAGAS: O BYE (24/09/2026)

Pedido assim: *"preciso que você altere a lógica de geração do chaveamento eliminatório para suportar
campeonatos com menos times do que a capacidade da fase inicial ... o campeonato começa nas oitavas
de final, portanto a chave possui 16 vagas, mas existem apenas 13 times inscritos. Nesse caso, a
lógica deve criar 3 BYEs"* — com a regra escrita passo a passo (espalhar os BYEs, nunca `BYE x BYE`,
avançar automaticamente quem recebe BYE, manter a ligação entre as rodadas) e a instrução que
organizou o trabalho: *"Antes de alterar o código, analise como o index.html atual gera os
campeonatos e adapte essa solução à estrutura existente, em vez de criar um sistema paralelo
completamente separado"*.

⚠️ **O MOTOR NASCEU SEM MUDAR NADA EM PRODUÇÃO, de propósito:** ele aceita BYE, e o `drawCycle`
continuou formando só grupos exatos de 8 e 16 até a **regra de agrupamento** ser decidida. Ela foi —
é a **(D)**, no fim desta seção.

### ⚠️ ELE COUBE NA ESTRUTURA QUE JÁ EXISTIA — o pedido já era ela, com outros nomes

| o pedido | o jogo |
|---|---|
| `gerarChaveEliminatoria(times, tamanhoDaChave)` | **`buildRounds(players, bracketSize)`** — o 2º argumento é a única coisa nova |
| `time1` / `time2` / `vencedor` / `status` | `a` / `b` / `winner` / `resolved` |
| `embaralharArray` | o **`shuffleWithSeed`**, que já embaralha os inscritos antes |
| `proximaPotenciaDe2` / `calcularPosicoesBye` | criadas como o pedido escreveu |

**⚠️ SEM O 2º ARGUMENTO ELE SAI BYTE A BYTE IGUAL AO DE ANTES** (chave do tamanho exato do grupo,
zero BYEs) — e é isso que fez a mudança caber **sem tocar em nenhum dos dois chamadores de
produção**. Há trava comparando os cinco tamanhos possíveis.
⚠️ **E ELA VALE DEPOIS DA (D) TAMBÉM**, por outro caminho: hoje os chamadores PASSAM tamanho, e o que
garante a não-regressão é **todo múltiplo de 8 formar exatamente os mesmos grupos de antes**.

**13 numa chave de 16, a saída real:**

```
jogo 1: T1  x BYE  -> T1 avança (resolved)     jogo 5: T7  x T8
jogo 2: T2  x T3                                jogo 6: T9  x BYE  -> T9 avança
jogo 3: T4  x BYE  -> T4 avança                 jogo 7: T10 x T11
jogo 4: T5  x T6                                jogo 8: T12 x T13
```

5 partidas + 3 BYEs = 8 nas quartas, com os três já **na posição certa** delas.

### TRÊS DECISÕES QUE FUGIRAM DO QUE FOI PEDIDO, e por quê

- **⚠️ O EMBARALHAMENTO NÃO PODE SER `Math.random`.** O chaveamento é montado no **SERVIDOR** e o
  **CLIENTE também resolve partida de liga** — as duas cópias têm que chegar no MESMO resultado,
  senão a mesma liga termina diferente nos dois. A distribuição dos BYEs é determinística pelo mesmo
  motivo, e há trava comparando os dois motores em 8 tamanhos.
- **⚠️ `proximaPartidaId` / `proximaPosicao` NÃO VIRARAM CAMPO.** A ligação já é **DERIVADA do
  índice**: o confronto `mi` da rodada `r` alimenta o `floor(mi/2)` da rodada `r+1`, na posição `a`
  se `mi` é par e `b` se é ímpar — é o que o `advanceCyclePhases` já fazia. Guardada num campo, ela
  só conseguiria ficar velha.
- **A `faseInicial` configurada é respeitada por construção:** ela **É** o `bracketSize`. Não houve
  um segundo caminho a escrever.

### ⚠️ QUEM RECEBE BYE JÁ NASCE RESOLVIDO, e é isso que o faz não esperar partida

O `advanceCyclePhases` só resolve confronto com os **DOIS** lados
(`!match.resolved && match.a && match.b`), então um BYE **nunca vira batalha**. Ele nasce
`{a, b:null, bye:true, winner:a, resolved:true}` **e já é promovido pra fase seguinte na montagem** —
deixar pro `advanceCyclePhases` promover exigiria um segundo caminho lá dentro que só rodaria na
primeira fase e só às vezes, ou seja o caminho menos testado do código.

- **⚠️ E ELE NÃO GANHA TERRENO:** o `assignMatchTerrain` ficou atrás de `if(!match.bye)`. Terreno
  sorteado pra um confronto que não acontece é dado morto — e o selo do terreno apareceria numa
  partida que ninguém joga.
- **⚠️ E A POTÊNCIA DE 2 TEM PISO 2:** uma chave de 1 não é chave, e com `numRounds === 0` o laço das
  rodadas não roda — a liga nasceria **sem confronto nenhum**, travada, sem nunca definir campeão.

### O QUE SAI NA TELA

A linha do BYE dizia *"aguardando adversário"*, que é o texto de uma vaga que ainda vai ser
preenchida — e aqui ela **nunca** será. Hoje ela diz **"PASSOU DIRETO"** em verde, ao lado do nome.

E a notificação de início não diz mais *"contra a definir"*: quem passou direto é avisado disso, com
a **fase seguinte** e o horário dela.

⚠️ **A FRASE FOI EXTRAÍDA PRA UMA FUNÇÃO** (`avisoDeInicioDeLiga`), e não por estilo: a versão inline
só dava pra testar **lendo o texto do arquivo** — e texto no arquivo **sobrevive a um
`const corpo = false`**, porque o ramo só fica inalcançável. A trava passava em branco com o BYE
ignorado. Hoje são 11 asserções de comportamento.

**Medido a 320px, no navegador**, com 13 numa chave de 16: os 3 BYEs caem nos jogos 1, 3 e 6, a linha
do BYE mede **53px** contra 77 de um confronto normal, o selo em `rgb(31,107,47)` a 11,2px, e
**nenhuma rolagem lateral**.

### ⚠️ O QUE FALTA É A REGRA DE AGRUPAMENTO, E AS TRÊS SAÍDAS FORAM MEDIDAS

Hoje o `drawCycle` forma grupos **exatos** e manda o resto pro `leftover` (o inscrito é copiado pro
ciclo seguinte preservando o `registeredAt`, ou seja a ordem de prioridade).

| inscritos | **(A) hoje** | **(B) uma chave só** | **(D) chaves equilibradas** |
|---|---|---|---|
| 13 | 8 jogam, **5 sobram** | 13/16 (3 byes) | 13/16 (3 byes) |
| 20 | 16 jogam, **4 sobram** | 20/**32** (12 byes) | 10/16 + 10/16 |
| 27 | 16+8, **3 sobram** | 27/**32** (5 byes) | 14/16 + 13/16 |
| 57 | 16+16+16+8, **1 sobra** | 57/**64** (7 byes) | 15/16 + 14/16 ×3 |
| **rodadas no máximo** | **4** | **5 e 6** | **4** |

⚠️ **A (B) — literalmente o que foi pedido — ESTOURA A MÁQUINA DE FASES.** Ela tem **quatro horários
fixos** (`phaseTimes = [qfTime, sfTime, finalTime, phase4Time]`) e o `roundLabelsFor` só conhece
chave de 3 e de 4 rodadas: uma de 32 precisa de 5 e uma de 64 de 6. E ela **piora o caso de 20**, que
hoje forma uma liga cheia de 16 e passaria a ser uma chave de 32 com **12 vagas vazias**.

A **(D)** nunca passa de 4 rodadas, **não deixa ninguém de fora** e mantém o número de campeões igual
ao de hoje. **FOI ELA** (*"Faça a D, chaves equilibradas"*) — ver a seção logo abaixo, que é onde a
regra e o preço dela estão medidos.

### ⚠️ E ELE CUSTOU QUATRO LIÇÕES

1. **⚠️ UM DEFEITO MEU FAZIA O LAÇO GIRAR PRA SEMPRE.** O `while` que procura vaga livre não tinha
   teto de voltas: com a chave cheia ele nunca acha vaga. O teste **TRAVOU em vez de falhar**, e o
   script de acusação leu isso como *"passou em branco"* — ele passou a reconhecer **timeout** como
   acusação. O conserto foi um teto de voltas mais um `break`, e o pior caso virou **um BYE a
   menos**, que a conta absorve.
2. **⚠️ DUAS GUARDAS QUE DIZEM A MESMA COISA NÃO SE TESTAM UMA A UMA.** O `Math.min` e o `break`
   garantem a MESMA regra (nunca mais BYEs que confrontos), então tirar só um **não é observável** —
   e tirar só o `break` é o caso 1. O caso de acusação tira **os dois**.
3. **⚠️ O SCRIPT DE ACUSAÇÃO CONTAVA `FALHA` E O TESTE IMPRIME `FALHOU`** — a **quarta** vez desta
   armadilha aqui. Os defeitos apareciam todos como *"1 falha"* (o sumário `N FALHA(S)`), e **um
   deles estava passando em branco escondido nesse 1**. Um "1 falha" idêntico em treze casos
   diferentes é o sinal.
4. **⚠️ E UMA TRAVA MINHA ASSUMIU UMA OCORRÊNCIA DE `if(!match.resolved && match.a && match.b)`** —
   há **DUAS** em cada motor (a segunda é o *"há trabalho pendente?"*). Hoje ela cobra as duas, nos
   dois arquivos.

**NO MOTOR, NADA:** `MOTOR 2d6a83f24cf1 / DIARIO 72e61601d1fb`, idêntico ao build anterior em 900
batalhas semeadas — e o instrumento é sensível (com o `CRIT_BASE` em 1/8 os dois hashes mudam).
Bateria: **41 de 41**.

`tools/test-chaveamento.js` é novo, com **60 asserções**: a não-regressão sem o 2º argumento (5
tamanhos byte a byte, mais os dois chamadores de produção nos dois arquivos), a potência de 2 com o
piso, o espalhamento medido por **INTERVALO** e não por índice exato, a chave de 13/16 carta por
carta, o caminho até o campeão em 8 casos, os dois motores concordando e sendo determinísticos (sem
`Math.random`), as duas guardas do avanço, o terreno, o aviso de início, a tela e o
`computePlacement`.
**Conferido que os 15 defeitos religados acusam** — um deles só por **timeout**.

### ⚠️ AS CHAVES FICARAM EQUILIBRADAS: NINGUÉM SOBRA (24/09/2026)

Escolhida entre as três saídas da tabela acima: *"Faça a D, chaves equilibradas"*. O `drawCycle`
deixou de formar grupos **EXATOS** e mandar o resto pro `leftover` — hoje **todo mundo que passa do
mínimo entra**, e o que sobrava virou BYE.

**⚠️ O NÚMERO QUE JUSTIFICA A MUDANÇA:** de 8 a 64 inscritos, o agrupamento de antes deixava **196
inscrições de fora — em 49 dos 57 valores de N (86%)**. Hoje deixa **ZERO**.

| inscritos | antes | **hoje** | vagas | byes |
|---|---|---|---|---|
| 13 | 8 jogam, **5 sobram** | **13/16** | 16 | 3 |
| 20 | 16 jogam, **4 sobram** | **12/16 + 8/8** | 24 | 4 |
| 24 | 16+8, ninguém sobra | **16/16 + 8/8** | 24 | **0** |
| 27 | 16+8, **3 sobram** | **16/16 + 11/16** | 32 | 5 |
| 57 | 16+16+16+8, **1 sobra** | **16/16 ×3 + 9/16** | 64 | 7 |

#### ⚠️ A REGRA MINIMIZA BYE — ela NÃO é "chaves do mesmo tamanho", e o caso de 24 é o que separa

A leitura ingênua de *"equilibradas"* é `ceil(N/16)` grupos do mesmo tamanho. **Ela PIORA o caso que
hoje já é perfeito:** 24 inscritos viram **12+12**, ou seja duas chaves de 16 com **OITO** vagas
vazias — quando 16+8 fecha as duas sem um BYE sequer.

A regra é **GULOSA**: enquanto sobrar pra uma chave CHEIA de 16 **e ainda uma chave válida depois
dela**, tira 16; o resto (8 a 23) vira uma chave só, ou — se passar de 16 — uma de (resto−8) mais
uma de 8.

**⚠️ E ISSO PÕE O TOTAL DE VAGAS NO MÍNIMO POSSÍVEL, que é `ceil(N/8)*8`** — conferido em **493 de
493** valores de N, de 8 a 500. Não existe arranjo com menos BYE.

#### ⚠️ A NÃO-REGRESSÃO É "TODO MÚLTIPLO DE 8", e ela é exata

**8, 16, 24, 32, 40, 48, 56… formam exatamente os mesmos grupos de antes, na mesma ordem, com a
MESMA semente por grupo** (`draw-<hora>-g<índice>`, que não mudou) — conferido em **25 de 25**
múltiplos de 8 até 200. Ou seja o ciclo de quem já joga hoje com número redondo sai byte a byte
igual, e a mudança só alcança quem sobrava.

**⚠️ E O `botFillEnabled` DAS LIGAS CUSTOMIZADAS NÃO MUDOU UM CARACTERE, de graça:** ele já enche com
bot até um múltiplo de 8, e sobre um múltiplo de 8 a regra nova é a antiga. **Não foi preciso
decidir nada sobre bot × BYE** — se um dia for, a régua é tirar o `botFillEnabled` e deixar o BYE
fazer o trabalho sem inventar adversário.

#### ⚠️ O MÍNIMO DE 8 CONTINUA SENDO O MÍNIMO — e é ele que a Liga Pro depende

Abaixo de `REGULAR_LIGA_SIZE` **não se forma liga nenhuma** e todo mundo vai pro `leftover`, como
sempre. É a regra que a Liga Pro escreve com todas as letras (*"no mínimo 8 treinadores"*) e a que
faz a **faixa dela não girar** num ciclo que não aconteceu.

**⚠️ E NENHUMA CHAVE NASCE ABAIXO DE 8**, o que cai da própria regra — conferido, a menor chave em
N de 8 a 500 tem **8**. Sem isso uma chave de 1 coroaria campeão **sem uma única partida**.

#### ⚠️ NUNCA PASSA DE 4 RODADAS — e é isso que faz a (D) caber

A máquina de fases tem **quatro horários fixos** (`phaseTimes`) e o `roundLabelsFor` só conhece
chave de 3 e de 4 rodadas. Conferido de N=8 a 500: **4 rodadas no máximo**. Era exatamente isto que
a saída *"uma chave só"* estourava — 32 precisaria de 5 e 64 de 6.

#### ⚠️ O PIOR CASO É N ≡ 1 (mod 8): SETE BYEs NA ÚLTIMA CHAVE

Com 9, 17, 25, 57… a última chave fica com **9 jogadores em 16 vagas** — ou seja **8 dos 9 dela
passam direto** e a primeira fase tem **uma partida real**. É o preço de ninguém ficar de fora, ele
está medido, e fica **FIXADO no teste** pra ser decisão e não surpresa. Não há arranjo melhor: 9 não
se divide em dois grupos de 8.

**⚠️ E A LIGA CLÁSSICA ESTÁ A UM INSCRITO DESSE CASO — medido em produção (24/09/2026):** os ciclos
recentes dela têm **6, 6, 7, 7, 7 e 8** inscritos, e o `leagueTypes/classic` tem
**`botFillEnabled: false`** (ou seja ela **não** é protegida pelo preenchimento com bot, que é o que
faria a regra nova ser idêntica à antiga por cair sempre em múltiplo de 8).

Na faixa em que ela vive hoje **nada muda**, e isso não é sorte — é a regra:

| inscritos | antes | hoje |
|---|---|---|
| **6, 7** | nenhuma liga (o mínimo é 8) | **igual** — o `dividirEmChaves` devolve `[]` abaixo do mínimo |
| **8** | uma Liga de 8 | **igual**, byte a byte |
| **9** | 8 jogam, **1 sobra** | **9/16 com 7 BYEs** — a 1ª fase tem UMA partida |
| 13 | 8 jogam, 5 sobram | 13/16 com 3 BYEs |
| 17 | 16 jogam, 1 sobra | 9/16 + 8/8, 7 BYEs |

Ou seja: **o próximo degrau da Clássica é justamente o pior caso.** Fica dito porque é o primeiro
lugar onde a (D) vai aparecer pra o jogador — e a alternativa, se um dia incomodar, é a chave só
aceitar BYE até metade das vagas (com 9 ela formaria 8/8 e mandaria 1 pro leftover, como antes), o
que é mecânica nova e não foi pedido.

#### ⚠️ O `size` DA LIGA É O TAMANHO DA CHAVE — uma "Grande Liga" pode ter 13

Ele é lido pelo `computePlacement`, pelas rodadas e pelo **título da tela**
(`league.size === GRANDE_LIGA_SIZE ? '🌟 Grande Liga' : '🏆 Liga'`). Uma chave de 16 com 13
jogadores **É** a Grande Liga em tudo que importa: 4 fases e as mesmas colocações. A consequência
fica registrada aqui e trancada no teste.

#### ⚠️ E ELA DESENTERROU UM DEFEITO DE RÓTULO NO `computePlacement`

`eliminatedInSize = round.length * 2` é a **CAPACIDADE** da rodada, não a **OCUPAÇÃO**. Numa chave
de 16 com 13 jogadores, quem cai na primeira fase era anunciado como **"9º–16º Lugar"** — um 14º,
15º e 16º que **não existem**.

- Hoje o teto é `min(capacidade, quantos entraram)`, contado da rodada 0 → **"9º–13º Lugar"**.
- **⚠️ NUMA CHAVE CHEIA OS DOIS NÚMEROS COINCIDEM**, então isto **não muda um caractere** do que já
  está no ar — há trava comparando com o rótulo de antes na chave de 16 e na de 8.
- E o `nextSize` virou `round.length` (quantos **SOBREVIVEM** a rodada), que é o mesmo
  `eliminatedInSize/2` de antes quando a chave está cheia — e o certo quando ela não está.
- **⚠️ COM 9 NUMA CHAVE DE 16 A FAIXA TEM UM LUGAR SÓ:** *"9º–9º Lugar"* se leria como defeito, então
  ali sai **"9º Lugar"**.

#### ⚠️ E DUAS TRAVAS MINHAS PASSARAM EM BRANCO — as duas do CLIENTE

Elas mediam a **PRESENÇA** (o nome da função, o nome da variável) — e presença **sobrevive a `= []`
e a `= 0`**: com o cliente divergindo do servidor, as duas ficaram verdes. Só a conferência de
acusação pegou.

Hoje os **três** trechos duplicados (`dividirEmChaves`, o bloco do agrupamento e o
`computePlacement`) são comparados **BYTE A BYTE** entre os dois arquivos, mais um caso cobrando que
o agrupamento antigo não sobre em nenhum dos dois. Uma divergência ali faz a **MESMA liga terminar
diferente no cliente e no servidor** — sem erro, e só na hora do sorteio.

**NO MOTOR, NADA:** `MOTOR 2d6a83f24cf1 / DIARIO 72e61601d1fb`, idêntico em 900 batalhas semeadas —
e o instrumento é sensível (com o `CRIT_BASE` em 1/8 os dois hashes mudam). Bateria: **41 de 41**.

**Medido a 320px, no navegador**, nas duas telas: N=13 (uma chave de 16, 3 BYEs) em **305×1.732px** e
N=20 (12/16 + 8/8, 4 BYEs) em **305×2.623px** — **nenhuma rolagem lateral**, **zero textos cortados**,
todos os `<h2>` em uma linha (inclusive *"🎽 Sua Liga — 🌟 Grande Liga"*), a linha do BYE em **53px**
contra 77 de um confronto normal.

`tools/test-chaveamento.js` foi a **97 asserções**, e a que importa é a de **PONTA A PONTA**: ela
roda o `drawCycle` de VERDADE contra o Firestore em memória com **13 inscritos** e cobra que a liga
se forme, que os 13 entrem, que o **leftover fique VAZIO**, que os 3 BYEs nasçam resolvidos e já
promovidos na posição certa, e que **nenhum deles ganhe terreno** — mais **7** (continua sem formar,
os 7 pro leftover) e **24** (16+8, zero BYE). Todos os outros casos chamam o `dividirEmChaves` e o
`buildRounds` na mão e **passariam com a chamada órfã**.
**Conferido que os 10 defeitos religados acusam** (1 a 9 falhas cada).

### ⚠️ QUEM PASSOU DIRETO APARECE NA FASE SEGUINTE, NÃO NA DELE (24/09/2026)

Reportado com print de uma chave de 16 com 10 inscritos: *"esse que ja passaram direto nao precisa
exibir o quadro nas oitavas, ja coloca eles direto no quadro das quartas de final"*.

**⚠️ E O PRINT MOSTRAVA DOIS DEFEITOS, não um:** as oitavas com **SEIS linhas "PASSOU DIRETO"** (uma
parede de não-partidas) **e as quartas dizendo "❓ A definir" em TODAS as vagas** — inclusive nas
seis que já tinham dono.

| a 320px, 10 numa chave de 16 | antes | **depois** |
|---|---|---|
| linhas na 1ª fase | 8 | **2** (só as partidas de verdade) |
| "passou direto" | **6** | 0 |
| "A definir" nas quartas | **6** | **0** — os seis nomes aparecem |
| altura da tela | 1.398px | **1.002px** (**−28%**) |
| rolagem lateral | nenhuma | nenhuma |

#### ⚠️ A SEGUNDA METADE É A QUE IMPORTA: O GATING NÃO TINHA O QUE ESCONDER

O `displayName` esconde o nome quando a partida que ALIMENTA aquele slot ainda não foi revelada —
e ele existe por uma razão boa: *"senão dava pra descobrir quem ganhou só vendo quem apareceu na
fase seguinte, mesmo sem assistir a partida"*.

**Só que um BYE nasce `resolved` e NUNCA é assistido**, então ele nunca era revelado até a hora da
fase seguinte chegar. **Num BYE não houve partida: esconder ali não protege nada** — só faz a fase
seguinte dizer "A definir" num lugar que já tem dono.

- **⚠️ E O GATING CONTINUA VALENDO PRA QUEM VEIO DE PARTIDA DE VERDADE.** Sem essa metade o conserto
  seria uma porta aberta, e há caso de teste com a chave CHEIA (zero bye) cobrando que o "A definir"
  continue lá.

#### ⚠️ O FILTRO É UMA FUNÇÃO COM DONO, e não um `m.bye ? ''` em cada render

Os **dois** lugares que desenham rodada (a liga ao vivo e o "Rever" do histórico) leem o mesmo
`linhasDaRodada`. Escrito em cada um, o segundo divergiria no primeiro ajuste — e **o que fica pra
trás é o do histórico, que é onde ninguém olha depois**.

**⚠️ E ELA NASCEU PORQUE A TRAVA NÃO CONSEGUIA MEDIR O FILTRO INLINE.** A primeira versão do teste
reimplementava a decisão no próprio helper (`(filtra && m.bye) ? '' : ...`) — e a conferência de
acusação mostrou que, removendo o filtro do JOGO, **só a trava que lê o código acusava**: as de
comportamento passavam em branco, porque o helper continuava filtrando. É a armadilha do *"trava que
pergunta à função que ela mede não é trava"*, e foi ela que fez o filtro virar função.

#### ⚠️ ELA DEVOLVE `''`, NUNCA FILTRA A LISTA — e isso não é estilo

O `mi` é o **ÍNDICE do confronto na rodada**, e ele vai pro `matchKey` e pro `watchLeagueMatch`.
Com um `.filter()` antes do `.map()`, a partida do slot 3 receberia `mi=0`:

- o jogador **assistiria OUTRA partida**;
- e a chave que o `watchedMatches` marca deixaria de ser a que a fase seguinte procura — **o nome
  ficaria "A definir" pra sempre pra quem assistiu.**

Não dá erro nenhum. Há trava medindo o `matchKey` e o `watchLeagueMatch` das duas partidas reais
(slots **3 e 7**, não 0 e 1).

#### O DADO NÃO MUDA, E A FASE NUNCA FICA VAZIA

- **⚠️ O `rounds['0']` CONTINUA com os registros de BYE** — é deles que sai a promoção (eles nascem
  `resolved` e já carimbam a fase seguinte na montagem). Só a TELA deixou de desenhar.
- **⚠️ E A PRIMEIRA FASE NUNCA FICA SEM PARTIDA, por construção:** as reais são `n − size/2`, o
  `dividirEmChaves` nunca põe menos de 8 numa chave, e 9 numa de 16 já dá 1. **Varrido de N=8 a 500:
  o pior caso é exatamente esse — 1 partida em N=9.** Por isso não existe guarda de "fase vazia":
  ela seria código que nunca roda.

#### ACHADO NO CAMINHO E NÃO MEXIDO

Um confronto com **NENHUM** dos dois lados definido sai como **`? vs (aguardando adversário)`** — um
"?" solto. Medido nas duas versões: **idêntico**, ou seja é anterior a isto e não foi tocado (não foi
pedido). Ele aparece nas fases que ainda não receberam ninguém.

**NO MOTOR, NADA:** isto é apresentação inteira — o `buildRounds`, o `drawCycle` e o
`advanceCyclePhases` não foram tocados.

`tools/test-chaveamento.js` tranca: o caso do print (6 byes, 2 partidas), a fase do BYE com 2 linhas
e zero "passou direto", **a MESMA rodada desenhada CRUA dando o print de volta** (8 linhas, 6 "passou
direto"), os seis nomes na fase seguinte, o gating continuando a esconder quem veio de partida real,
o `matchKey` e o `watchLeagueMatch` com o índice REAL, o `rounds[0]` intacto, a varredura de 8 a 500
(**com um `ok` cobrando que ela leu alguma coisa** — a primeira versão chamava o `dividirEmChaves`
com um argumento só, ele devolvia lista vazia e ela passava medindo NADA), os dois renders lendo a
MESMA função e o filtro morando num lugar só.
**Conferido que os 5 defeitos religados acusam**, e cada um derruba a trava que descreve o que ele
quebrou.

## PERFORMANCE: A GEOGRAFIA MANDA (19/09/2026)

Relatado assim: *"tenho sentido uma boa lentidão na inscrição para as ligas clássicas e trainers
league"* e, depois, *"mesmo para carregar as informações na tela home está mais lento"*.

### ⚠️ O NÚMERO QUE EXPLICA TUDO: `Location: nam5`

```
firebase firestore:databases:get "(default)"  →  Location: nam5
```

O Firestore está na **multi-região dos Estados Unidos**, e os jogadores estão no Brasil. **Medido
daqui**, e este é o número que toda conta de latência deste projeto tem que usar:

| | |
|---|---|
| operação Firestore, conexão reaproveitada | **~200 ms** |
| operação abrindo conexão nova | **~1,0 s** |
| callable us-central1, quente | ~250 ms |
| callable us-central1, primeira | **1,25 s** |

**⚠️ O CLAUDE.md ASSUMIA ~60 ms.** É 3× menos que a realidade, e toda estimativa de latência
feita antes desta data está subestimada na mesma proporção.

E `nam5` é **multi-região**: o *commit* de cada transação ainda paga consenso entre regiões.

- **⚠️ A LOCALIZAÇÃO DE UM FIRESTORE É IMUTÁVEL.** Trocar exige projeto novo e migração de todos
  os dados. Não é uma opção de curto prazo.
- **⚠️ E MOVER AS FUNCTIONS PRA SÃO PAULO SOZINHAS DEIXARIA O JOGO MAIS LENTO.** Elas estão em
  us-central1, ou seja **coladas no banco** -- ali uma operação Firestore custa ~5 ms. Em São Paulo
  elas ficariam a 200 ms de cada leitura que fazem. O que está certo hoje é function perto do
  banco; o que está longe é o **jogador**.
- **A região das functions e o `minInstances` NÃO tocam na inscrição**, porque ela não passa por
  Cloud Function nenhuma: `registerForLeague` é código do CLIENTE escrevendo direto no Firestore.
  As únicas duas functions de liga são schedulers.

### ⚠️ O QUE O JOGADOR SENTIA NÃO ERA A LENTIDÃO -- ERA O SILÊNCIO

O relato decisivo veio depois: *"eu clico no time para inscrever ele na liga e **nada acontece**,
fica na mesma tela de escolher o time e eu clicando, e depois de alguns segundos que vai"*.

**O clique sempre funcionou no primeiro.** O que faltava era a tela dizer isso:

```css
.save-slot-card.clickable{cursor:pointer;}   /* era só isso */
```

O clique põe `disabled` no card -- mas `.save-slot-card` era **a única classe clicável do jogo sem
regra de `:disabled`**. `.btn`, `.lobby-acao`, `.circle-btn`, `.friend-btn`, `.notif-barra-btn` e
`.conquista-premio` todas já tinham a delas. Então o card ficava com o mesmo fundo, a mesma borda,
a mesma sombra e o mesmo `cursor:pointer` -- **visualmente idêntico**. O jogador clicava de novo
(sem efeito, porque já estava disabled) até a tela trocar.

É a mesma lição que este arquivo já registrava pro `.btn.danger:disabled`: **botão desabilitado
precisa parecer desabilitado**.

- **O CARD CLICADO FICA ACESO** (borda amarela, fundo claro, "Inscrevendo…") e **os outros apagam**.
  Feedback positivo, não só ausência: o que o jogador precisa saber é que **o clique dele** pegou.
- **A SOMBRA SAI junto da opacidade**, e não é detalhe: é ela que dá o relevo que se lê como "dá pra
  apertar". Só apagar deixaria um card que continua parecendo botão.
- **⚠️ O ESTADO GUARDA QUAL SLOT, não um booleano** -- com `true` os seis cards ficariam iguais e o
  jogador continuaria sem saber qual pegou. É a mesma razão do `resgatandoConquistas`.
- **⚠️ E A COMPARAÇÃO É `=== slot`, NUNCA UM TERNÁRIO NO SLOT: ele pode ser 0, que é falsy** -- um
  `slot ? ... : ...` trataria o **primeiro time** como "nenhum". Testado com o slot 0.
- Vale nas **duas** telas que inscrevem (o picker da Liga e a inscrição rápida do aviso).

### A HOME: CINCO IDAS EM SÉRIE VIRARAM DUAS

```js
loadSaveSlots().then(loadPermanentUserData).then(syncSpecialties)
  .then(reconcileLeagueWinsFromHistory).then(() => loadMyActiveGymDefenses())
```

Cinco `.then()` encadeados, e **só uma das ligações era dependência de verdade**: o
`loadPermanentUserData` **lê `game.saveSlots`** pra unir a Pokédex dos saves com a permanente da
conta. As outras duas não tocam `saveSlots` (conferido) -- eram sequência por hábito. A ~200 ms
por elo, isso é ~1 s antes de a home mostrar qualquer coisa.

**⚠️ E O `reconcileLeagueWinsFromHistory` SAIU DA HOME.** Ele varre o histórico inteiro --
`LEAGUE_HISTORY_RETENTION = 48` ciclos **por tipo de liga**, mais um `scheduleDocRef.get()`
sequencial por tipo: até ~98 documentos **a cada visita**. E ele é, pelo próprio comentário dele,
uma **rede de segurança pra uma Cloud Function que já faz o trabalho**.
Ele continua rodando **ao abrir a Liga**, que é onde o número que ele conserta aparece -- e o total
na home continua certo, porque vem do documento do usuário pelo `loadPermanentUserData`.

### ⚠️ O `count()` QUE NUNCA EXISTIU

```js
if(typeof coll.count === 'function'){ ... }   // sempre falso
else { const snap = await coll.get(); return snap.size; }   // sempre aqui
```

**Conferido baixando o SDK**: o jogo carrega `firebase-firestore-compat.js` **10.7.1**, e nele
**`Query.prototype.count()` não existe** -- as únicas 10 ocorrências de "count" no arquivo são
internas (IndexedDB, bloom filter do protocolo). A agregação só existe no SDK **modular**
(`getCountFromServer`).

Então o `countRegistrants` **sempre baixava a coleção inteira** -- e quem o chama é o
`loadLeagueViewData`, que roda **a cada 5 segundos** pelo polling.

| com 100 inscritos e 100 jogadores na tela | |
|---|---|
| antes | **~7,4 milhões de leituras/hora** |
| a cota gratuita (50k/dia) durava | **24 segundos** |
| depois (contador denormalizado) | 1 leitura por tique |

- **O contador sobe por `increment` NA MESMA TRANSAÇÃO da inscrição** -- atômico, o Firestore
  resolve sem ler, então duas inscrições simultâneas não se atropelam.
- **⚠️ ISSO PÕE UMA ESCRITA NUM DOCUMENTO COMPARTILHADO que a inscrição não tinha, e o trade-off
  foi medido**: o limite é ~1 escrita/s por documento, e 100 inscrições concentradas em 10 minutos
  dão **0,17/s** -- cinco vezes abaixo. O cron escreve ~1/min no mesmo doc, o que deixa o total em
  ~0,2/s.
- **⚠️ O FALLBACK FICA**: ciclo criado antes desta data não tem o campo, e sem ele a tela mostraria
  "0 inscritos" numa liga cheia.
- **⚠️ SÓ A CLÁSSICA USA ISTO.** Em `trainersLeagueCycles` a regra é `allow write: if false` -- o
  cliente não escreve lá, e tentar seria uma ida ao servidor que **nunca pode dar certo**.
  (É o mesmo motivo pelo qual o `trainersLeagueEnsureCycleDoc` do cliente é uma ida morta.)

#### ⚠️ E O CONTADOR FOI PRO AR ERRADO — 4 inscritos viraram 1 (20/09/2026)

Reportado no dia seguinte ao deploy: *"entrei para ver a liga clássica e estava com 4 treinadores
inscritos, após eu me inscrever, o numero caiu para 1, nao sei se é na minha tela que exibiu errado
ou se deletou os outros"*.

**NINGUÉM FOI APAGADO, e isso foi PROVADO antes de qualquer conserto** — lido do Firestore de
produção pelo MCP do Firebase:

```
INSCRITOS DE VERDADE NA COLEÇÃO: 5
registrantCount no documento:    1
createTime do documento:         2026-09-20T11:10:24Z   <- o instante da 5ª inscrição
```

**⚠️ O `createTime` ENTREGOU A CAUSA: o documento do ciclo NÃO EXISTIA.** Quem o criou foi o
`increment(1)` daquela inscrição — e **`increment` sobre campo que não existe trata o campo como
ZERO**. Os quatro primeiros estavam em **abas abertas de antes do deploy**: o `index.html` vai com
`no-cache`, mas aba aberta continua com o código velho até o F5 — então eles escreveram na
subcoleção sem tocar no contador. O quinto, num carregamento novo, criou o documento em 1.

**⚠️ E A LIÇÃO É MAIOR QUE O CASO: um contador mantido só pelo CLIENTE nunca é confiável**, porque
sempre existe cliente velho em cache. O mesmo vale pro `increment(-1)` do cancelamento, que
desviaria pro outro lado.

**Hoje quem manda no número é o SERVIDOR**: o cron, que já roda de minuto em minuto, reconcilia o
ciclo **ABERTO** (`reconciliarContadorDeInscritos`). Qualquer desvio — de cliente velho, de
documento que nasceu tarde, do que vier — se conserta sozinho em no máximo **60 segundos**.

- **⚠️ ELE CONTA PELA AGREGAÇÃO `.count()` DO SERVIDOR**, não varrendo a coleção: ~1 leitura em vez
  de uma por inscrito. É exatamente o `getCountFromServer` que o SDK **compat** do cliente não tem
  (ver acima) — o **Admin SDK tem desde a v11**, e aqui é ele. Custo: 2 leituras por minuto.
- **⚠️ E ELE LÊ ANTES DE ESCREVER**: escrita custa 3× mais que leitura no Firestore, e sem isso
  seriam 1.440 escritas por dia num documento que quase nunca muda.
- **O cliente continua incrementando**, pro número subir na hora em que você se inscreve. O que
  mudou é ele ter deixado de ser a autoridade.
- **O ciclo que estava aberto foi consertado na mão** (`registrantCount` = 6, os 6 inscritos reais),
  pra o número não ficar errado até o deploy.

**⚠️ E O `fake-firestore` APRENDEU `.count()` POR CAUSA DISTO** — sem ele a função morre com
*"count is not a function"* e a trava fica vermelha por um motivo que não é o do jogo. Ele devolve
`{ data: () => ({ count }) }`, que é a forma do `AggregateQuerySnapshot`: um número cru ali deixaria
passar um código que a produção recusa. É a mesma lição do `increment` dentro de mapa, do
`arrayUnion`, do `FieldPath.documentId()` e do `getAll` da transação.

`tools/test-liga-treinadores.js` **reproduz o relato inteiro**: quatro inscritos e nenhum contador,
o `increment` gravando 1, a coleção com 5, o cron ajustando pra 5, o desvio pra baixo, o não
escrever quando já está certo, e — **lendo o código** — que ele usa a agregação e que o **cron o
chama no ciclo aberto** (os casos chamam a função na mão e passariam com a chamada órfã).

### A GUARDA ANTI-PISCAR DA CLÁSSICA

O `refreshLeagueView` chamava `render()` **incondicional a cada 5 s** -- recriando o HTML inteiro
da tela (Top 10, dois históricos, chaveamento) mesmo sem nada mudar. A Trainers League já tinha a
guarda dela (`trainersLeagueLastRenderSignature`); a Clássica ficou sem.

**⚠️ A ASSINATURA INCLUI O CONTADOR DE INSCRITOS**, e é isso que faz ela funcionar: durante as
inscrições o número é justamente a coisa que muda. Uma assinatura só de id+status deixaria a tela
parada enquanto gente entra. E é a própria assinatura que faz o caso do **próprio jogador** passar
(`amIRegistered` + `registrantCount` mudam), sem precisar de exceção.

### O SCHEDULER LIA A MESMA AGENDA DUAS VEZES

Os logs de produção mostram `advanceLeague` e `advanceTrainersLeague` rodando **de minuto em
minuto com o jogo vazio**, dizendo "Nada a avançar ainda" -- **2.880 execuções/dia**.

O `recoverStuckCycles` lia a agenda de 9,5 KB e o `advanceLeagueOnceForType` lia **o mesmo
documento na linha seguinte**. Hoje o primeiro devolve o que leu.

- **⚠️ O VALOR É CAPTURADO NUMA VARIÁVEL DE FORA da transação**: o Firestore **re-executa** o corpo
  de uma transação em caso de contenção, então um `return` lá dentro poderia entregar o resultado
  de uma tentativa **abortada**. Do lado de fora, o que sobra é a última execução -- a que valeu.
- **Ele devolve `null` quando falha**, nunca um objeto vazio: o chamador precisa distinguir "li e a
  agenda está assim" de "não consegui ler", e no segundo caso lê por conta própria.
- **⚠️ O ACHADO DE QUE ELE "ESCREVE À TOA" ESTAVA ERRADO**: ele só escreve `if(changed)`. O que
  custava era a **leitura repetida**, não a escrita.

### ⚠️ OUTRAS TRÊS MEDIÇÕES QUE CONTRADIZEM O QUE ESTAVA ESCRITO AQUI

1. **O `index.html` NUNCA devolve 304.** Testado com `If-None-Match`, com `If-Modified-Since` e com
   os dois juntos: sempre **200 com 486 KB** (~1,1 s). Este arquivo afirma, na seção de Deploy, que
   *"o custo normal é um 304 vazio"* -- **não é**. Toda abertura do jogo baixa o arquivo inteiro.
   (O `X-Cache` vem `MISS` sempre, e o `Vary` inclui `x-fh-requested-host`.)
2. **Não existe `firestore.indexes.json`, e o projeto tem ZERO índices compostos**
   (`firebase firestore:indexes` devolve listas vazias). É a mesma armadilha que as **regras** já
   tiveram antes de 30/08/2026: o que existe no console não está versionado, e um `deploy` não o
   recria.
3. **As regras estão limpas**: zero `get()`/`exists()` em 169 linhas, ou seja nenhuma leitura extra
   nem latência adicional por operação do cliente.

### ⚠️ O QUE FICOU EM ABERTO, E POR QUÊ

- **A INSCRIÇÃO VIRAR UMA CALLABLE.** Do Brasil, 1 ida a us-central1 custa 250 ms medidos, e lá
  dentro as 4 operações Firestore custam ~5 ms cada: de ~800 ms para ~300 ms. **NÃO foi feito**, e
  a razão é a proporção entre risco e ganho: ela mexe na **trava de inscrição dupla** (hoje uma
  transação client-side), e o sintoma que o jogador relatou já foi resolvido pelo **feedback do
  clique** -- os 800 ms deixaram de incomodar quando a tela passou a responder na hora. O ganho
  virou conforto, não conserto.
- **Os achados de escala que NÃO foram verificados** (a auditoria multi-agente bateu no limite de
  sessão e a fase de verificação adversarial não rodou): o documento do ciclo da Trainers League
  supostamente **estourando 1 MiB** com o objeto do jogador duplicado 15×, e o refresh de times
  elegíveis supostamente fazendo **~320 idas sequenciais** numa execução de cron com timeout de
  60 s. Os dois são graves **se forem verdade** -- e nenhum foi confirmado lendo o código.

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

## A FILA DA LIGA CLÁSSICA NO PAINEL (21/09/2026)

Pedido assim: *"no admin-treinadores, coloque uma sessão para eu ver a fila de inscrição da liga
clássica atual, e conseguir adicionar e remover inscrições de treinadores para a liga clássica
atual"*.

### ⚠️ ISTO SÓ PODE SER CLOUD FUNCTION, e não é escolha de arquitetura

```
firestore.rules:  match /registrants/{registrantId} {
                    allow write: if request.auth != null && registrantId == request.auth.uid.lower();
```

**Cada um escreve só no PRÓPRIO registro de inscrição.** Um admin inscrevendo ou removendo alguém
pelo cliente seria **recusado pela regra** — e afrouxá-la abriria a inscrição de todo mundo pra
qualquer jogador logado, que é exatamente o oposto do que ela protege. O Admin SDK ignora as
regras; é o mesmo caminho do `adminListTrainers`.

São **três** callables: `adminLeagueQueue`, `adminAddLeagueRegistration` e
`adminRemoveLeagueRegistration`.

### ⚠️ O TIME NÃO VEM DO PAINEL — ele é lido do SAVE

O painel manda **`uid` e `slot`, e mais nada**. Aceitar um código de time do cliente seria deixar
inscrever um time que a conta não tem — e é a mesma regra que a Trainers League já segue (*"os
golpes escolhidos saem daqui, do SAVE, e não do cliente... não há o que forjar, e por isso não há o
que validar"*).

A inscrição sai **idêntica à que o jogador faria sozinho**: o `code` sanitizado na origem (o time é
reconstruído do zero, então um save adulterado entra normalizado), os golpes escolhidos no mesmo
mapa `espécie:nível → golpes`, as especialidades e o `elite` da conta.

**E ela passa pelas MESMAS exigências:** 8 insígnias, time montado e **não aposentado**. Sem isso o
painel poria na liga um time que o próprio jogo recusa. Há caso de teste mandando um `code` forjado
junto — ele é ignorado.

### ⚠️ E A TRAVA DE "JÁ ESTÁ EM OUTRA LIGA" VALE IGUAL

É ela que protege o chaveamento: quem está disputando um ciclo já sorteado não pode entrar no
próximo, senão a mesma conta aparece em dois. O jogador tem essa trava (`isAccountActiveInLeague`);
o painel ganhou a versão de servidor dela, e ela **varre os tipos todos** — a trava é da CONTA, não
de um tipo de liga. A mensagem diz **onde** ele está, senão o admin não tem o que fazer com a
recusa.

### ⚠️ A PORTA VIVE NUMA FUNÇÃO SÓ

Ela estava escrita à mão dentro do `adminListTrainers`, e três cópias novas garantiriam que a
quarta callable nascesse sem ela — **numa função administrativa isso não é um defeito de tela, é a
porta aberta**. Hoje é o `exigeAdmin`, e ele cobra `admin === true` **exatamente o booleano**:
`'sim'`, `'true'`, `1` e `{}` não abrem (há caso de teste pros oito valores).

### O CONTADOR É RECONCILIADO, NÃO INCREMENTADO

O `registrantCount` é o número que a **tela do jogo** mostra, e ele já nasceu desalinhado uma vez
(20/09, quando abas velhas inscreviam sem tocá-lo). Aqui a ação é manual e rara, então depois de
cada uma ele é recontado pela agregação `count()` — ~1 leitura, e o número fica certo.

**E a caixa da fila mostra os DOIS lado a lado** quando eles divergem. É o que transforma aquele
defeito em algo que se enxerga de fora, em vez de esperar um relato.

### A TELA: a fila em cima, o botão no SAVE

- **A caixa da fila** traz o ciclo aberto, a hora do sorteio, quantos inscritos (e quantos bots), e
  uma linha por inscrito com **Remover**.
- **O bot não tem Remover**: ele é gerado pelo sorteio, não é uma inscrição de alguém.
- **⚠️ E O BOTÃO DE INSCREVER FICA NO CARD DO TREINADOR**, num save por vez — não num campo de uid.
  Digitar uid é pedir erro, e o painel **já tem** o uid e os saves com as insígnias na mão: o botão
  só aparece no save que a callable aceitaria, e quem já está na fila vê o ESTADO em vez do botão.
  Oferecer a ação onde o servidor vai recusar é pior que não oferecer.
- **⚠️ REMOVER PERGUNTA ANTES:** é a inscrição de outra pessoa, e ela não tem como saber que saiu.
- **⚠️ E AS DUAS AÇÕES RECARREGAM A FILA** em vez de remendar a lista em memória: o que a tela
  mostra passa a ser o que o servidor tem, e não o que ela supôs que aconteceu.

### ⚠️ E A NUMERAÇÃO DO SLOT QUASE SAIU ERRADA

O painel escreve `Slot ${slot + 1}` (o slot 0 é o "Slot 1", como o jogador vê na home), e a fila
nasceu mostrando o número **cru** — a mesma inscrição aparecia como **"save 0" na fila e "Slot 1"
no card**. Hoje as duas leem o mesmo `rotuloDoSlot`; o valor cru só vai pro servidor.

**Medido no navegador** (com o Firebase e as callables dublados, pra ver a tela de verdade): a fila
com 3 inscritos desenha as três linhas, o bot sem botão, os quatro estados do save aparecem certos
(inscrito / inscrito noutro slot / aposentado / elegível), e os dois cliques funcionam **sem um erro
de JS**.

### ⚠️ E UMA TRAVA MINHA CASOU COM ZERO HANDLERS

A varredura do `onclick` usava `[^)]*` — e os argumentos são `'${esc(uidDono)}'`, ou seja eles
**têm parênteses dentro**. Ela achava **ZERO** handlers e passava em branco sobre o defeito que
existe pra pegar (o argumento sem aspas, que é a lição do montador de 20/09: o clique não faz nada
e **não há erro no console**).

Quem denunciou foi o `ok` de *"os handlers existem"* — a rede que este projeto põe em toda
varredura, e a **segunda vez em dois dias** que ela paga (a outra foi a varredura do índice
composto, que também achou zero).

**Os 16 defeitos religados acusam** (2 a 12 falhas cada).

