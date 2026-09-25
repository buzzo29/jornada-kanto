# A ECONOMIA DO JOGO

A **loja**, a **mochila**, os **TMs**, os **HMs**, as **moedas** e o **re-sorteio pago**. Saiu do
`CLAUDE.md` em 25/09/2026, pela mesma medição que tirou as Ilhas Laranja: ele é lido INTEIRO em
toda sessão.

⚠️ **A REGRA QUE MAIS VALE AQUI: quem escreve moeda é o SERVIDOR.** Os campos `moedas`,
`rareCandies`, `inventario`, `equipados`, `rerollsPorSave`, `admin` e `achievementsPaid` estão na
**trava de campos do `firestore.rules`** — cliente escrevendo moeda é shiny à vontade, que é
exatamente a artimanha que a semente do encontro existe pra fechar.

⚠️ **E A SEGUNDA: preço que existe em dois lugares tem que bater.** O cliente precisa dele pra
desabilitar o botão e o servidor é quem cobra; divergindo, a tela promete um preço que a cobrança
não pratica.

⚠️ **E O QUE NÃO ESTÁ AQUI:** o motor de batalha em `docs/motor-de-batalha.md`, as Ilhas Laranja em
`docs/ilhas-laranja.md`, e o resto do jogo no `CLAUDE.md`.

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
#### ⚠️ E O EEVEE PERDIA O ITEM AO EVOLUIR (21/09/2026) — o mesmo defeito, aberto por 18 dias

Achado no caminho de outra coisa (a varredura de candidatos do Resgate), não por relato. Conferido
antes de mexer em qualquer coisa:

```
Charmander equipado → Charizard  : potion   (certo, desde 03/09)
Gloom      equipado → Bellossom  : potion   (certo)
Eevee      equipado → Jolteon    : null     ← o item some
```

- **⚠️ A CAUSA É QUE O EEVEE É A BIFURCAÇÃO QUE NEM NO `EVOLUTION_CHOICES` ESTÁ.** Aquela tabela é
  o que ensina o `raizDaLinha` que Slowbro e Slowking são o mesmo Slowpoke — e o Eevee não está
  nela **de propósito**: a escolha dele tem tela PRÓPRIA (`chooseEeveeEvolution`), por causa do
  relógio do Espeon/Umbreon. Resultado: `raizDaLinha('jolteon')` devolvia **`jolteon`**, e a poção
  ficava presa numa chave que ninguém mais procura.
- **⚠️ A LISTA NÃO FOI PRO `EVOLUTION_CHOICES`, e isso é decisão.** Aquela tabela tem um SEGUNDO
  emprego: ela dirige o `tryEvolve` (a marca `pendingEvoChoice`), a tela genérica de bifurcação e a
  descida do `formaNoNivel`. Pôr o Eevee ali seria mexer em três caminhos que funcionam pra
  consertar um quarto — a classe de defeito que este projeto mais paga. O `raizDaLinha` ganhou a
  lista direto.
- **⚠️ E A LISTA JÁ EXISTIA, PELA METADE.** O `EEVEE_EVOLUTIONS` tinha o nome do conjunto inteiro e
  só as **TRÊS da pedra** — faltavam justamente Espeon e Umbreon, que são as que o nome promete.
  Ela passou a ter as cinco e a servir os dois leitores (o `raizDaLinha` e o `cannotEvolveFurther`),
  em vez de virar uma segunda lista pra divergir da primeira. **Conferido que o**
  **`cannotEvolveFurther` dá a mesma resposta com as cinco** — Espeon e Umbreon já caíam no
  `!EVOLUTIONS[id]` e acertavam por acidente.
- **⚠️ ELA É DECLARADA ANTES DO `raizDaLinha`**: `const` tem zona morta temporal, e este projeto já
  pagou isso duas vezes (as quatro telas de revelação em 09/09 e o aviso de versão em 13/09).
- **O DADO VELHO SE CONSERTA SOZINHO, nos dois sentidos:** quem equipou num Jolteon já evoluído
  gravou `3:jolteon`, e a leitura aceita QUALQUER chave da mesma linha — medido, `3:jolteon` agora
  responde pelo Jolteon **e** pelo Eevee.

**⚠️ E A SEGUNDA CONSEQUÊNCIA É MAIOR QUE A PRIMEIRA — a OFERTA SELVAGEM.** O `linhasDoTime` usa a
mesma raiz, então a linha do Eevee contava como **seis linhas diferentes**. Medido nas 7 rotas que
têm alguém dela (2.800 ofertas):

| | antes | depois |
|---|---|---|
| oferece a linha que o time **já tem** | **810** | **0** |
| **DOIS da mesma linha na MESMA tela** | **40** | **0** |
| ofertas com alguém da linha | 1.217 | 1.213 |

**A Mansão Pokémon tem `eevee` E `flareon` no MESMO pool** — ou seja os dois saíam juntos na tela,
que é o defeito dos dois Kingdra de 01/09/2026 entrando por outra porta. E a última linha é o que
prova que o conserto não escondeu ninguém: a linha do Eevee continua aparecendo igual.

**O PREÇO NA JORNADA: nada. 53,59% contra 55,23%** — **+1,64 ponto, 1,6σ** (10 blocos de 800
jornadas de cada lado, **8.000 de cada**, o MESMO bot contra duas cópias congeladas, desvio tirado
de ENTRE os blocos, **5 de 10 blocos** pra cada lado). Ruído puro, e a direção é a esperada: a
oferta deixou de gastar uma das quatro cartas com uma linha que o jogador já tinha.

**No motor, nada:** `MOTOR 385943f3e1fa / DIARIO 850af0fd1763`, idêntico em 900 batalhas semeadas.

⚠️ **E A TRAVA NASCEU MEDINDO A SI MESMA.** A primeira versão perguntava ao `raizDaLinha` quem era
da linha do Eevee pra contar os repetidos da oferta — com o defeito religado,
`raizDaLinha('flareon')` é `'flareon'` e a conta **nunca passa de 1**: ela passava em branco com o
defeito inteiro de volta. Hoje a linha vai escrita no teste. **Trava que pergunta à função que ela**
**mede não é trava.**

⚠️ **E A FERRAMENTA DE ACUSAÇÃO MENTIU JUNTO:** ela contava `FALHOU` e o `test-jornada.js` imprime
**`FALHA`** — três defeitos religados apareceram como passando em branco quando na verdade dois
deles acusavam. É a mesma família do harness que media o vazio, e o sintoma é o mesmo: **um zero**
**perfeito é mais suspeito que um número feio.**

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

## AS MÁQUINAS DE TÉCNICA (TMs) — 17/09/2026

Pedidas assim: *"implemente os TMs e coloque eles para vender, no mínimo 100 cada, conforme o poder
for maior, mais caro fica, e os TMs devem ser de uso único, usou uma vez, ele some e não da para
usar mais, precisa comprar novamente"*, com os 23 nomeados um a um. Mais dois pedidos junto:
*"muitos desses TMs possuem efeito adicional ... coloque essas informações no card"*, *"os TMs que
dão habilidade passiva, como o TM03 (Water Pulse), o pokemon também deve ganhar a habilidade passiva
enquanto estiver com esse movimento"* e *"na loja, ao clicar no TM, colocar um botão onde vai exibir
uma lista de quais pokemons estão aptos para receber esse movimento"*.

### ⚠️ ELAS SÃO O CONTRÁRIO DOS HMs EM TUDO QUE IMPORTA

É por isso que não deu pra reusar o `HMS` como tabela:

| | HM | TM |
|---|---|---|
| de onde vem | conquista da jornada | **compra na loja** |
| onde mora | na CONTA (`hms`) | no **inventário** (empilha, como a Poção) |
| quantas vezes | infinitas | **UMA** (some ao ensinar) |
| dá pra esquecer | **não, nunca** | sim, é golpe comum |

**A última linha é a que mais separa as duas:** o golpe de HM é a CHAVE de uma rota, e perdê-lo numa
tela de troca a fecharia de novo (é o que o `ehGolpeDeMaquina` existe pra impedir). O de TM é só um
golpe — ele entra na fila de aprendizado como qualquer outro. **Quem pagou 🪙300 numa Hiper Raio e a
trocou por engano perdeu a Máquina**, e é o preço do uso único.

**⚠️ MAS A TELA DE ENSINAR É A MESMA, e isso foi a decisão estrutural.** HM e TM respondem à MESMA
interface (`golpe` + `aprendem`), e quem despacha é o `maquinaPorId` — então a tela de três níveis
(times → pokémon → troca) serve os dois **sem uma linha de exceção**. Onde as duas realmente diferem
(de onde vêm, se gastam) quem responde é o `ehTM`, e são poucos lugares.

### OS GOLPES: 17 JÁ EXISTIAM, 6 NASCERAM

**⚠️ E OS SEIS SÃO DA GEN 3, o que importa em três deles** — lidos do arquivo moderno a tabela sairia
errada:

| | hoje | **Gen 3** |
|---|---|---|
| Tumba de Rochas (TM39) | 60 | **50** |
| Ladrão (TM46) | 60 | **40** |
| Superaquecer (TM50) | 130 | **140** |

Mais Garra do Dragão (Dragon 80), Fachada (Normal 70) e Poder Secreto (Normal 70). O caminho é o
mesmo do resto da base — o `moves.json` do Showdown com a cadeia de mods **8→3**.

- **ELES ENTRAM NO `A_MAO` DO GERADOR**, ao lado do `cut`, do `surf` e do `fly`, e pelo mesmo motivo:
  **TM ninguém aprende por NÍVEL**, e a base só cadastra nível — o gerador nunca os viu. Sem essas
  linhas, regenerar as tabelas APAGA os nove em silêncio.
- **E FICAM FORA DO `GOLPES_IDS`**, que é **indexado** pelo `APRENDIZADO`: inserir um id no meio
  deslocaria os índices e trocaria o moveset das 250 espécies sem ninguém ver.
- **⚠️ E O `POOL_METRONOMO` FOI DE 158 PRA 164**, porque ele é derivado do `GOLPES`. Isso desloca a
  semente do sorteio — é o preço conhecido de o Metrônomo sortear "qualquer poder existente no jogo".
- **⚠️ O TM39 (ROCK TOMB) RESOLVEU UMA PENDÊNCIA DE 13/09/2026**: ele tinha sido pedido junto com os
  outros quatro golpes de estágio e **teve que sair no mesmo dia**, porque o golpe não existia na
  tabela. O TM é o que lhe deu casa.

### ⚠️ A LISTA DE QUEM APRENDE SAIU DA TAG "3M"

O MESMO caminho dos 72 cortadores, dos 65 surfistas e dos 24 voadores — e o método foi conferido
reproduzindo os três sem uma divergência. **Atenção à fonte: as tags `1M` e `2M` dão ZERO nas 250 do
jogo**, porque o arquivo do Showdown é podado e só traz da Gen 3 pra frente.

São **1.901 entradas** (de 7 no Dragon Claw a 240 na Fachada e no Poder Secreto), 20,5 KB por cópia.

**⚠️ E ELA É DUPLICADA NO SERVIDOR, o que não é opcional:** o `golpesValidos` reconstrói o que a
espécie pode ter a partir do `APRENDIZADO` (que é por NÍVEL) mais os HMs. Sem os TMs ali, **quem
ensinasse um perderia o golpe em TODA partida de liga, em silêncio** — foi exatamente o que quase
aconteceu com o `fly`. A tabela do servidor é DERIVADA do `TMS`, então um TM novo já nasce coberto.

### O PREÇO É DERIVADO, NUNCA UM NÚMERO SOLTO

`max(100, poder efetivo × 2)`, arredondado à dezena — de **🪙100** (Semente-Bala, Tumba de Rochas,
Ladrão) a **🪙300** (Hiper Raio), ou seja de **1,4 a 4,3 jornadas** de renda. O mais caro empata com
o Doce Raro.

- **⚠️ ELE USA O PODER EFETIVO, não o cru**, e é a mesma régua que a escolha de golpe usa: a
  **Semente-Bala é poder 10 e bate de 2 a 5 vezes**. Pelo cru ela seria o golpe mais barato do jogo
  por um número que não descreve o que ela tira.
- **A regra vive no cliente E no servidor**, e há trava cobrando que a tabela bata com ela nos 23 —
  um preço solto divergiria no primeiro reajuste, e a tela prometeria o que a cobrança não pratica.
- **⚠️ O SEMENTE-BALA ENTROU NO `MULTI_GOLPE` junto** (2 a 5 tapas, como na Gen 3). Sem isso o poder
  efetivo dele seria 10, o motor nunca o escolheria e o TM09 seria dinheiro fora. **Ele é o primeiro
  da tabela que ninguém aprende por nível** — a Sunflora é a única exceção, e é ela que faz o
  acréscimo mexer no motor.

### ⚠️ QUEM GASTA É O SERVIDOR, E DEPOIS DE GRAVAR O TIME

O `inventario` está na trava de campos do `firestore.rules` — um TM descontado pelo cliente seria
Hiper Raio infinito em todo mundo. A callable é o `usarTM`, **em transação** (sem ela, duas abas
leem o mesmo estoque e as duas passam: um TM ensinado duas vezes pelo preço de um).

**⚠️ E A ORDEM É A DECISÃO: o time é gravado ANTES da cobrança.** Se a chamada se perder (rede, aba
fechada), o jogador **aprendeu o golpe e ficou com a Máquina**. O contrário — pagar e não aprender —
é o lado errado pra errar, e é a mesma regra que o `consumeEquipped` já segue.

### OS EFEITOS: 17 DOS 23 JÁ EXISTIAM NO MOTOR

E isso não é sorte — os 23 pedidos são todos golpes de DANO, e o bloco de status do jogo já cobria
quase tudo. Congelar (2), queimar (2), envenenar (1), paralisar (2), drenar (1), multi-tapa (1),
estágio (4) e confundir (1) **já estavam**. Entraram **três mecânicas novas**:

- **⚠️ O OVERHEAT (TM50) é o primeiro golpe que COBRA um preço de quem usa**: −2 estágios no PRÓPRIO
  Ataque Especial, sempre. É ele que equilibra um golpe de 140 — o segundo uso vale metade do
  primeiro. Ele entrou no `GOLPES_QUE_MUDAM_ESTAGIO` com `chance: 1` e `noProprio: true`.
  **E ELE OBRIGOU O DEGRAU DO ESTÁGIO A ENTRAR NO `effectiveSpAtk` E NO `effectiveAttack`** — até
  aqui só def/spDef/speed liam estágio, porque só esses eram mexidos. Sem o degrau, o motor gravaria
  um estágio que **ninguém lê**, e o defeito não apareceria como erro: apareceria como um golpe que
  anuncia um efeito e não faz nada. Há trava cobrando que os cinco atributos do `moverEstagio`
  estejam todos no `NOME_DO_ATRIBUTO` e todos sejam lidos por uma `effective*`.
- **⚠️ E ELE DESENTERROU UM DEFEITO NO AVISO DO CARTÃO**: o alvo da frase saía do **SINAL do delta**
  (`delta > 0 ⇒ quem usa`), que era verdade **por acidente** — o único +1 era no próprio e os −1
  eram no alvo. O Overheat quebra as duas metades, e o cartão dizia *"Reduz o Ataque Especial DO
  ALVO"*, o contrário do que o golpe faz. Hoje quem responde é o `noProprio`, que a tabela já tinha.

- **⚠️ A FACHADA (TM42) é o primeiro golpe cujo poder depende do ESTADO de quem usa.** Ela vale
  **×2** com queimadura, veneno ou paralisia. Medido: um Snorlax queimado tira **o MESMO dano** com
  ela (1,05×) enquanto o Golpe de Corpo cai pra 0,56× — o ×2 do golpe cancela o ÷2 da queimadura, que
  é exatamente o que a Fachada é no original. **E a escolha muda junto**: limpo o motor escolhe Golpe
  de Corpo (85), queimado escolhe a Fachada.
  **⚠️ E O DOBRO ENTRA NUM LUGAR SÓ.** A primeira versão o pôs no `calcDamage` E na `nota`, e ele saiu
  **4×** — é literalmente a armadilha do poder efetivo de 09/09/2026 (*"o `calcDamage` lê `best.poder`,
  que o `melhorAtaque` já devolve multiplicado"*). Hoje ele vive no `melhorAtaque`, como a escala do
  Rolamento. **Regra da casa: quem mexe em poder mexe lá, e só lá.**
  ⚠️ O que ela também faz no original — ignorar o corte de ataque da queimadura — **ficou de fora**:
  seria um segundo caminho no `effectiveAttack` só pra um golpe, e o ×2 já cobre o efeito prático.

- **⚠️ O PODER SECRETO (TM43) muda de efeito conforme o TERRENO**, 30% por golpe. Aqui o terreno é de
  um TIPO (51 terrenos, 17 tipos), então o mapa é por tipo — e ele **só usa os QUATRO status que
  acontecem POR ATAQUE**, que é onde este golpe vive: **Gelo → congela · Fogo → queima · Veneno →
  envenena · Elétrico → paralisa**.
  **O SONO e a CONFUSÃO ficaram de fora de propósito**: no motor os dois são de **ABERTURA** (sorteados
  uma vez por confronto, antes do primeiro golpe), e aplicá-los no MEIO da troca seria mecânica nova,
  com linha de log, passo de animação e medição próprios. Nos outros 13 terrenos ele é um golpe
  Normal de 70 e mais nada — e isso é honesto: inventar efeito pra preencher a tabela seria pior.
  **⚠️ COM MAIS DE UM TIPO NO TERRENO (46 dos 51 têm), vale o PRIMEIRO que dá efeito, na ordem do
  TERRENO** — assim o Pântano (Veneno/Planta/Fantasma) envenena e o Vulcão (Fogo/Terra) queima, que é
  o que o nome deles promete.
  **⚠️ E A IMUNIDADE DE CADA STATUS VALE**, reusada: o Fogo não queima, o Gelo não congela. Sem isso o
  TM43 seria a porta dos fundos das quatro.

**⚠️ E O TERRENO VEM DA INSTÂNCIA, NUNCA DE ESTADO DE MÓDULO — essa decisão mudou no meio do
caminho.** A primeira versão usou uma variável de módulo (como a chuva) e teria criado uma **QUARTA
porta de vazamento** no servidor, onde a instância é reaproveitada entre invocações: um terreno
sobrando faria o TM43 de outra partida aplicar status aqui. E o vazamento do clima **foi real**.
Marcado pelo `applyTerrainBuff` — a ÚNICA porta por onde um terreno entra numa batalha, nos dois
motores —, o problema deixa de existir: o campo morre com o pokémon. Ele começa com `_` porque o time
do save é serializado inteiro.

- **⚠️ E O SORTEIO SÓ LÊ O RNG QUANDO PODE ACONTECER**: o `tentarPoderSecreto` sai antes do `rng()`
  quando o golpe não é o TM43 ou quando não há terreno. Lido sempre, ele deslocaria a semente de TODA
  batalha que não tem o TM43 em campo — a mesma armadilha do congelamento e do Remoinho. Há trava
  pras duas saídas.
- **A LINHA DO LOG REUSA A DO STATUS QUE ELE APLICOU**: o jogador precisa ler *"ficou queimado"*, não
  *"sofreu o efeito do terreno"*. O `mv` continua sendo o GOLPE, então a frase sai *"X ficou queimado
  com PODER SECRETO!"*, que é verdade nas duas pontas.

### ⚠️ A PASSIVA PELO GOLPE (o TM03)

> **⚠️ ELA VIROU A MECÂNICA em 24/09/2026** — ver **A CONFUSÃO VIROU STATUS POR ATAQUE**. O que este
> bloco pediu como EXCEÇÃO (*"quem CARREGA um golpe que confunde ganha a passiva"*) é o
> comportamento normal hoje: quem confunde é o GOLPE, e a passiva da espécie não existe mais. O
> `golpeQueConfunde` e a tabela `CONFUSAO` saíram junto, e **a trava disto não foi apagada: ela virou
> a trava da regra NOVA**, senão alguém devolve a passiva e o TM03 volta a precisar de caminho
> próprio sem ninguém ver.

*"Os TMs que dão habilidade passiva ... o pokemon também deve ganhar a habilidade passiva enquanto
estiver com esse movimento"*. A confusão do jogo era por ESPÉCIE (`CONFUSAO`, 82 espécies, cada uma
com o NOME do golpe dela); daqui em diante **quem CARREGA um golpe que confunde ganha a passiva**,
mesmo não estando na tabela.

- **⚠️ E VALE PRA QUALQUER GOLPE QUE CONFUNDA, não só pro TM03**: a regra é "o golpe dá a passiva", e
  limitar ao Water Pulse seria a mesma exceção que este projeto passa a vida tirando. Alcança os seis
  golpes de **dano** que confundem (Confusão, Psicoraio, Feixe de Sinal, Soco Dinâmico, Pulso de Água,
  Soco Tonto); os de status (Supersom, Raio Confuso, Bravata, Beijo Doce, Bajulação) não estão na
  tabela de golpes e vinham só pela espécie. **⚠️ E É ESSA METADE QUE ACABOU EM 24/09**: sem a
  passiva, os cinco de status deixaram de confundir — e eles eram **48 dos 54 donos** que a mudança
  levou.
- **O GOLPE CARREGADO VINHA PRIMEIRO**, e a espécie era o fallback: um Blastoise que ensinou o TM03
  passava a confundir com "Pulso de Água"; o Zubat sem golpe continuava confundindo com "Supersom".
  **Hoje o primeiro caso é a regra e o segundo não acontece.**
- **⚠️ E ELA MEXEU EM UMA ESPÉCIE SEM TM NENHUM: o MEWTWO**, que aprende `confusion` por nível e não
  estava no `CONFUSAO`. Ali não rodava — ele é imune ao bloco de especiais —, e **em 24/09 ele passou
  a confundir de verdade**: os status por ataque nunca respeitaram aquela imunidade.

### A LOJA E A LISTA DE APTOS

- **OS 23 ENTRAM NO `ITENS` POR DERIVAÇÃO**, não escritos um a um: o nome é "TM26 — Terremoto", o
  preço sai do `TMS` e a descrição é montada do golpe. Escritos à mão seriam 23 verbetes pra manter
  em dia com a tabela de golpes, e o primeiro reajuste de poder deixaria a loja mentindo.
- **ELES NÃO SÃO `equipável`** (o TM não vai num pokémon pelo `+`, ele ENSINA), e por isso o
  `prateleiraDoItem` precisou de um ramo próprio — sem ele os 23 cairiam em "Especiais", ao lado do
  Doce Raro, e a prateleira que leva o nome deles ficaria vazia.
- **O QUADRO DA LOJA MOSTRA O CARTÃO DO GOLPE**, o MESMO `cartaoDeGolpe` das três telas de golpe e da
  tela de ensinar — e ser o mesmo é o ponto: o jogador compara o Terremoto daqui com os golpes que o
  pokémon já tem LÁ. É ele que carrega os avisos de efeito extra.
- **⚠️ O "QUEM PODE APRENDER" FICA NO RODAPÉ, e não no miolo.** Ele é uma AÇÃO (como o Comprar e o
  Vender), e o **miolo ROLA por dentro**: medido a 320px, com o cartão do golpe ali o botão ficava
  **fora da área visível** — uma ação que o jogador não vê. O rodapé não rola. E ele vem **primeiro**,
  porque é a pergunta que se faz ANTES de comprar.
- **⚠️ A LISTA SEPARA "OS SEUS" DOS OUTROS, e os seus vêm primeiro.** A pergunta que se faz na loja não
  é "quais das 250 aprendem", é **"algum dos MEUS aprende"** — um TM de 🪙300 que nenhum pokémon do
  jogador aprende é dinheiro fora, e sem esta tela ele só descobriria isso DEPOIS de pagar, na tela de
  ensinar, que abre vazia.
- **E ELA VARRE TODOS OS SAVES**, não o time aberto: a Máquina é da CONTA e ensina em qualquer save,
  como o HM. Um "0 dos seus" contado só do save carregado seria mentira pra quem tem o bicho certo em
  outro slot.
- **⚠️ E A ALTURA FIXA DO QUADRO SUBIU DE 375 PARA 438px** — o VALOR mudou, não a regra (a tela
  continua sem dançar entre um item e outro, só ficou maior). Duas coisas do TM cresceram o pior caso:
  o cartão do golpe no miolo (56px) e o terceiro botão no rodapé. Medido a 320px varrendo os 33 itens
  com e sem dinheiro: o maior é o TM13 sem dinheiro (o rodapé ganha a linha do "Faltam").
- **Medido a 320px:** a prateleira tem 23 linhas de 60px (o nome quebra em duas), nenhum nome
  truncado, o modal de aptos em **265×483px** com a grade de 5 por fileira (célula de 39px) rolando
  por dentro, e **nenhuma rolagem lateral**.

### O AVISO NO CARTÃO: 18 DOS 23

*"Coloque essas informações no card"* — e a trava é **derivada**: todo TM com efeito no motor avisa, e
todo TM que avisa tem efeito. Um número escrito ali envelheceria no próximo golpe que ganhasse um.

**⚠️ E AS CHANCES E O MULTIPLICADOR SAEM DAS CONSTANTES**, nunca de um texto fixo: mexer no
balanceamento sem a frase acompanhar é o defeito que a especialidade teve. Os cinco que ficam mudos
(Garra do Dragão, Hiper Raio, Raio Solar, Terremoto, Ladrão) não têm efeito nenhum — são dano puro.

### ⚠️ O QUE FICOU DE FORA, E POR QUÊ

- **O ROUBO DE ITEM DO THIEF (TM46) NÃO FOI IMPLEMENTADO**, e a razão é que ele seria **letra morta**:
  item equipado **não existe** no adversário de jornada (NPC nunca tem item) nem nas ligas e no online
  (lá itens não valem — ver "Onde os itens valem"). Ou seja, não há o que roubar em lugar nenhum. E
  roubar mexeria no **armazém da conta de outro jogador**, que é economia e não batalha.
  Ele entra como golpe de dano puro (**Sombrio 40**), e ainda vale: é o quarto golpe Sombrio da tabela
  e 128 espécies o aprendem. Se um dia os itens valerem no online, é ali que a decisão se reabre.
- **O RECHARGE DO HIPER RAIO e o CHARGE DO RAIO SOLAR** também não: este motor resolve o confronto em
  trocas, não em turnos com estado. O Raio Solar já tem a metade na chuva, que é o que cabe.
- **A CATEGORIA físico/especial continua sendo do TIPO**, como sempre — nenhum TM mudou isso.

### O PREÇO NA JORNADA: NADA

**57,94% contra 57,69%** de conclusão — **−0,25 ponto, 0,3σ**, 8 blocos de 800 jornadas de cada lado
(**6.400 de cada**, desvio tirado de ENTRE os blocos, **5 de 8 blocos** pro lado do TM). Ruído puro,
e **por construção**: o bot nunca compra nem ensina TM, e os NPCs levam o moveset por NÍVEL — então
nenhum deles tem um. O que a medição captura é o deslocamento da semente do Metrônomo e o Semente-Bala
da Sunflora.

**⚠️ O EFEITO REAL DA FEATURE NÃO ESTÁ NESSE NÚMERO**, e é honesto dizer: ele está em quanto um golpe
comprado muda um pokémon, e isso o simulador não joga. A régua que existe é a de 09/09/2026 — **o par
de golpes vale 79 pontos de taxa de vitória entre o melhor e o pior**, e um TM é exatamente uma vaga
desse par comprada com moeda.

**A comparação dos dois motores (300 batalhas, mesma semente) passou intacta**, que é o que garante
que a liga e a animação continuem concordando.

## A MOCHILA VIROU A LOJA (14/09/2026)

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
- **⚠️ E ELE VOLTOU A FICAR AO LADO DO COMPRAR em 17/09/2026** (a pedido: *"deixe o botão de Comprar
  e vender, um ao lado do outro, ao invés de um em cima do outro"*), o que **reverte o empilhamento
  de 13/09**. Os dois são a mesma decisão — *"o que eu faço com este item?"* —, então dividem a linha
  como o Usar e o Excluir da mochila sempre dividiram; a `.item-acoes` sozinha já é uma LINHA, e a
  `.loja-acoes` deixou de mandar direção nenhuma.
  **⚠️ O QUE O EMPILHAMENTO COMPRAVA CONTINUA DE PÉ, e por outro caminho:** o que fazia o Comprar
  dançar de lugar era o Vender **ir e vir** conforme o estoque — e isso acabou no MESMO 13/09, quando
  ele passou a estar sempre na tela. Lado a lado, os dois continuam no mesmo lugar em todo item.
  **⚠️ E O TERCEIRO BOTÃO (o "Quem pode aprender" dos TMs) NÃO entra nessa linha:** ele fica acima,
  em largura cheia. Medido a 320px, três botões na mesma linha dão **76px cada** — "Vender por 100"
  não cabe nisso.
  **Medido a 320px, varrendo os 33 itens com e sem dinheiro:** os dois em **118px cada**, na mesma
  linha, sem texto cortado, e o quadro fixo **caiu de 456 para 438px** (o rodapé encolheu um botão de
  altura, e o valor foi remedido — deixá-lo em 456 seria 18px de ar em todo item, em nome de um pior
  caso que deixou de existir).
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
- **NÃO existe Speed Up**, e não é esquecimento — mas ⚠️ **a RAZÃO que estava escrita aqui venceu**.
  Ela dizia que a velocidade entra na taxa de crítico, e isso deixou de ser verdade em 10/09/2026,
  quando o crítico virou os estágios da Gen 3. **A razão de hoje é outra e é maior:** desde
  20/09/2026 a velocidade decide **quem abre o confronto** e escala com o nível — um item que a
  mexesse mudaria a ORDEM da troca, que é a coisa mais sensível do motor. Não foi pedido.
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

**⚠️ MAS ELE NÃO MORREU -- ele ficou raro, e isso foi remedido em 21/09/2026: ~1 falha em 17
rodadas** (uma numa bateria completa, zero em 16 rodadas isoladas), **e ela é IDÊNTICA no build de
antes e no de depois** de todo o trabalho daquele dia, ou seja não é regressão de ninguém.
A razão é que o `N × menorDano` pressupõe que **o menor não é absurdamente menor que o maior** --
e quando a leva sorteia `menor 6 / maior 75` (12×), o alvo vira 60 e **uma investida forte sozinha
mata o Mew** antes de a leva rodar. Se um dia for pra consertar, o alvo tem que ser maior que a
MAIOR investida já vista naquela rodada, e não só `N ×` a menor.

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
  pelo menos uma vez** numa jornada — medido, 75,6%. Rara o bastante pra ser um achado, comum o
  bastante pra existir.
- **⚠️ E ELA SAI NO MÁXIMO UMA VEZ POR JORNADA desde 17/09/2026**, reportado assim: *"a mata fechada
  que precisa de cut para entrar, está aparecendo mais de uma vez por jornada, ela deve aparecer
  somente 1x por jornada"*. **O motor estava fazendo exatamente o que tinha sido escrito** — o dado
  era rolado em CADA trecho de forma independente —, então ver duas ou três era o desenho, não um
  acidente. Medido antes: **24,5% das jornadas** com mata tinham mais de uma.
- **⚠️ O CONSERTO É PEGAR O PRIMEIRO QUE SAIR (`legDaMataFechada`), e não sortear um trecho novo** —
  e essa é a decisão que importa. O dado de cada trecho (`mataSaiNoTrecho`) continua **byte a byte
  o que era**, então a PRIMEIRA mata de qualquer jornada cai onde sempre caiu: medido, **4.000 de
  4.000** jornadas com a mata no mesmo trecho de antes. Um sorteio novo mudaria a jornada de todo
  mundo que tem save aberto.
  **E a chance de ver a mata ALGUMA vez não se move**, porque ela sempre foi "pelo menos um dos
  cinco dados passou" — 75,6% antes e depois. O que mudou é só o **teto**.
- **A distribuição fica torta de propósito, e é consequência do "primeiro":** medido em 4.000
  jornadas, ela cai no trecho 4 em 1.039, no 5 em 680, no 6 em 546, no 7 em 451 e no 8 em 307. É a
  cauda geométrica de quem para no primeiro sucesso — quanto mais tarde o trecho, menos chance de
  os anteriores terem falhado todos.
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
  ⚠️ **MAS ESSA CORREÇÃO FICOU PELA METADE**, e a outra metade só apareceu em 17/09/2026: ela pôs a
  pausa no ADVANCE e não no RENDER, que é quem TROCA a frase. Ver logo abaixo.
- As duas valem **1 passo** no `passosDaAbertura` e ganham o segundo e meio de leitura pela marca
  `leitura`, como toda frase que não mexe barra. Fora da tabela, valeriam pra SEMPRE — o defeito que a
  anulação teve.
- **⚠️ E O `!` DEIXOU DE DOBRAR.** As duas já vêm pontuadas do pedido, e a concatenação cega do
  `avisoDoConfronto` dava **"!!"** na tela. Hoje o `pontuada()` só acrescenta quando falta.

#### ⚠️ E A PAUSA NÃO ALCANÇAVA A TROCA DA FRASE (17/09/2026)

Reportado assim: *"quando um pokemon está por exemplo queimando ou envenenado, e esse pokemon morre
na batalha, não está esperando 1,5s depois da frase 'Charizard perdeu 20 de dano por estar
envenenado', tá aparecendo e rapidamente muda para 'Weezing venceu'"*.

**⚠️ A PAUSA JÁ ESTAVA LÁ desde 14/09 — e ela estava no lugar errado.** A correção daquele dia pôs o
`pausaDaFaixa` no **`advance`** (quem vira o confronto), e isso é metade da cena. A outra metade é o
**`render()`** do mesmo ramo: na fase `result` a linha de status deixa de ser o
`statusDoConfrontoHtml` e vira o **"X venceu!"**, e quem faz essa troca é ele. Ele rodava 50ms depois
da barra, então **o 1,5s passava inteiro com o "venceu!" já na tela**.

- **⚠️ POR QUE O `chuvafim` NÃO TINHA MOSTRADO ISSO:** aquela frase é a ÚLTIMA do confronto e não
  mata ninguém — o `advance` atrasado bastava pra ela ser lida. Aqui a frase é o golpe **que mata**,
  então o passo dela é o mesmo que vira a fase e troca o texto. **A trava de 14/09 media o `advance`,
  que estava certo**, e por isso ela não pegou.

**MEDIDO NO NAVEGADOR, o mesmo confronto (Charizard envenenado pelo Muk) nas duas versões:**

| | frase do veneno | "Charizard venceu!" | tempo na tela |
|---|---|---|---|
| **antes** | 8.701ms | **8.936ms** | **235ms** |
| **depois** | 8.754ms | 10.454ms | **1.700ms** |

**E A CENA NÃO FICOU MAIS LONGA**, que é o número que fecha a correção: o "Aguardando o resultado"
chega em **11.176ms antes e 11.204ms depois**. O tempo total já era esse — o que mudou é **o que
está na tela durante ele**.

- **⚠️ NÃO É UM CASO DE CANTO: 13,9% dos confrontos terminam num passo de leitura** — medido em
  2.760 confrontos, **301 de veneno, 61 de queimadura e 22 de sono**. São exatamente as três marcas
  que o relato nomeia.
- **São os QUATRO laços**, pela mesma razão de sempre. E o **ramo do MEIO continua sem a pausa**, que
  é o certo: lá a fase continua `animating` e a frase é **redesenhada igual** — ela não some, só é
  repintada.
- **O `+50` original existe pra o render não cair no meio da transição CSS da barra.** Somando a
  pausa ele cai bem depois dela, então o salto visual que ele evita continua evitado.
- **⚠️ O ONLINE É O QUINTO LAÇO E FICOU DE FORA, e é decisão:** ele não tem fase `result` que troque
  a frase (o `render()` dele só acontece no fim do confronto inteiro) e **nunca usou `pausaDaFaixa`**
  — lá tudo encolhe pelo `fator` do `ORCAMENTO_ANIM_ONLINE_MS`, porque há alguém esperando do outro
  lado. Mexer na pausa ali é mexer na janela de escolha do jogador, e isso não foi pedido.

**⚠️ A TRAVA DIRIGE O LAÇO E LÊ OS PRAZOS DOS TIMERS** (o sandbox os anota em `__timers`), em vez de
descrever o código — e o A/B dela é o mesmo passo **com e sem a marca `leitura`**: mesma barra, mesmo
golpe, só a marca mudando. Medido: **1.700ms com a marca, 200ms sem** — a diferença é exatamente a
pausa, e os 200ms são o próprio sintoma do relato. Ela cobra também que **golpe comum que mata NÃO
ganha os 1,5s** (senão toda batalha do jogo ficaria mais lenta por causa desta correção; o 1,2s que
sobra ali é a pausa do NOME DO GOLPE, que é outra coisa) e, lendo o código, que os quatro laços
somem a pausa. Conferido que ela acusa **4 falhas** com o defeito religado.

**CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois dá o **MESMO hash** em 900
batalhas semeadas. Os quatro laços são apresentação inteira.

#### ⚠️ ACHADO NO CAMINHO E NÃO MEXIDO: TRÊS TRAVAS DO `test-especiais` FALHAM ~1 RODADA EM 10

Encontrado enquanto se media a correção acima (17/09/2026), e **elas são ANTERIORES** — o que vale
registrar é isso e como se provou:

| trava | o que ela reporta |
|---|---|
| `e ninguem ataca depois de cair` (bloco da Faixa) | `1 de 12.949 \| arcanine vs poliwrath` |
| `NINGUEM ataca com a barra em zero` (varredura geral) | `1 cadaveres ex: Charmeleon 76->0 x Mankey 155->3` |
| `NENHUM selo num numero < 1/3 do maior daquele atacante` | um `Rolamento ×16` ao lado de um golpe pequeno |

**A PROVA DE QUE NÃO É DO TRABALHO DE HOJE, e ela tem três pernas:**
1. **o diff**: zero mudanças em `sequenciaDoConfronto`, `passosVisiveis`, `marcarCriticos`,
   `fatiaDoGolpe`, `doExchange`, `calcDamageNew` e `simulateGymBattle`;
2. **a impressão do motor**: o mesmo hash em 900 batalhas semeadas, antes e depois;
3. **a base**: rodando o teste de hoje contra o `index.html` do commit anterior, o flake **sai lá
   também** — 1 em 20 rodadas, com a mesma mensagem.
   (Hoje deu 3 em 20; com 1 e 3 eventos as duas taxas não se distinguem, e o `Math.random` do teste
   sorteia confrontos diferentes a cada rodada.)

**⚠️ E ELE NÃO REPRODUZ ISOLADO, que é a pista mais útil pra quem for atrás.** Um medidor à parte,
com a MESMA conta do teste, deu **zero em 80.179 confrontos** sorteados e **zero em 40.000** do par
exato do exemplo (Charmeleon × Mankey, entrando machucado). O que o medidor NÃO reproduz é o
pokémon chegar ao confronto **com status herdado** (`_queimado`/`_envenenado` atravessam confrontos)
— ou seja, a suspeita é a família *"HP que some sem ser golpe do adversário"*, e é bem possível que
o errado seja a **conta do teste** (que reconstrói o HP linha a linha) e não o jogo.

**⚠️ E O PRIMEIRO MEDIDOR DEU UM ZERO FALSO**, pela armadilha que este arquivo já registra: eu
**copiei as listas à mão** e escrevi `'cura'` onde o teste diz `'recover'`. É literalmente a mesma
lição do `danoSemGolpe` ("a lista estava copiada à mão em QUATRO contas"), agora do lado de fora.
Quem for medir isto: **copie as três listas do teste, não as redigite.**

**Não foi mexido porque não foi pedido** — mas elas são o que este arquivo chama de *o pior tipo de
teste, o que passa quase sempre*, e vão sujar toda medição futura do `test-especiais`.

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
- **A clareira mostra a ORDEM dos dez e deixa arrumar a sua.** É uma das **duas** batalhas em que o
  jogador vê a fila do adversário antes de lutar (a outra é a Montanha Sagrada, de 17/09/2026 — este
  item dizia "a única" e envelheceu no dia seguinte) — e isso é a coisa toda: 10 contra 6 sem cura
  entre confrontos se decide na ORDEM, e sem ver a fila a escolha seria no escuro. O 1º dele encara
  o 1º seu.
  **⚠️ As setas são o `moverNaFila`, por ÍNDICE** — e NÃO o `moveOrder` da tela de ordem de batalha,
  que é por id. Este item já disse que eram "as mesmas da tela de ordem", e o comentário no código
  dizia pior: nomeava um `moveTeam` que **nunca existiu**, e foi de lá que as setas da Montanha
  copiaram o nome errado (ver a seção própria). Elas reordenam o `game.team` — que é o que entra na
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
iris"*. **E isso o torna o PRIMEIRO dos três INTOCÁVEIS que se deixa capturar**, porque o prêmio da
vigília é escolher 1 dos 10.

- **É O PAGAMENTO DO MITO.** A vigília EXISTE por causa dele — os selvagens esperam a passagem do
  arco-íris —, então ele aparecer na roda é o único jeito de a lenda se cumprir. Um Ho-Oh apagado,
  impossível de escolher no meio dos dez, precisaria de uma explicação que a tela não tem e se
  leria como defeito.
- **⚠️ O QUE ISSO NÃO MUDA, e é o que mantém tudo de pé: as metas de "capturar tudo" continuam
  EXCLUINDO os três.** Contando o Ho-Oh, **toda conta que já tinha a Pokédex de Johto ou o Mestre
  Pokémon PERDERIA a conquista** até tirar 5% numa mata fechada — e conquista que se perde sozinha
  é pior que conquista nenhuma. Ele é **troféu, não requisito**. Há trava pras duas metas.
  ⚠️ **O LUGIA GANHOU PORTA EM 17/09/2026** (a batalha dos quatro da Montanha Sagrada), e a decisão
  lá foi a MESMA: troféu, não requisito. **O Celebi continua sem porta nenhuma.** Ele continua fora
  das rotas selvagens (`SEM_CAPTURA_SELVAGEM` não foi tocado) — a vigília é a única porta dele.
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

### A MONTANHA SAGRADA: A ROTA DO VOO, E O SANTUÁRIO (17/09/2026)

Pedida assim: *"será uma rota especial que poderá aparecer como terceira opção durante a jornada,
acessível apenas se o treinador tiver um Pokémon no time que saiba Fly, deve aparecer aleatoriamente
a partir do sexto ginásio. Ao chegar, será necessário vencer uma equipe de seis Pokémon voadores
cuja média de nível seja equivalente à do time do treinador... se vencer, terá acesso a uma tela
ilustrada com três ninhos"*.

**⚠️ ELA É A SEGUNDA ROTA DE CHAVE, e a primeira coisa que a Mata Fechada comprou foi isso:** o
cadeado, a carta, a regra de "quem valida é a AÇÃO" e o card desabilitado já existiam. As duas
dividem o MESMO desenho (`comChave`/`abre`), e o que muda é a frase — a mata manda buscar o **HM01**
e a montanha o **HM02**. Escritas em separado, a segunda nasceria com o cadeado de outra cor ou
mandando procurar a Máquina errada, que é pior que não dizer nada.

- **A partir do 6º ginásio** (`MONTANHA_A_PARTIR_DE = 5`) e em **1 de cada 4 trechos**
  (`CHANCE_MONTANHA`, a mesma régua da mata). Medido: **22,5%** por trecho e ela aparece em
  **53,6%** das jornadas.
- **⚠️ ELA NUNCA SAI NO MESMO TRECHO DA MATA, e isso não é estética: seriam QUATRO cartas, e a
  promessa é de uma TERCEIRA.** A mata tem preferência porque ela é do trecho 4 em diante e a
  montanha do 6º — onde as duas competem, a que já estava é a que fica. Medido: **0 colisões** em
  12.000 dados. Há trava só pra isso.
- **⚠️ O SORTEIO É SEMEADO PELO SAVE** (slot + **geração** do slot + trecho), como tudo nesta
  jornada: com `Math.random` bastaria sair do save e voltar até a montanha aparecer. A geração entra
  pelo motivo de sempre — sem ela, apagar e recriar no mesmo slot repetiria a jornada trecho por
  trecho.
- **ELA NÃO TEM POOL**, como a mata: escolhê-la **não leva ao encontro selvagem**. O que há do outro
  lado é a guarda — e é isso que faz dela uma aposta, porque o trecho perde as duas capturas.

#### OS SEIS GUARDIÕES

- **Sorteados entre os 33 voadores** que não são lendários nem intocáveis, **sem repetir LINHA
  evolutiva** (a regra do encontro selvagem) e com a **espécie batendo com o nível** — um Pidgey
  Lv.50 não existe. Foi a lição que a Vigília custou em 14/09 (*"está aparecendo Charizard no level
  24"*), e aqui ela veio de graça porque o `formaNoNivel` já existia.
- **⚠️ A MÉDIA É EXATA, e não "mais ou menos": os desvios `[-3,-2,-1,1,2,3]` somam ZERO.** Foi o
  pedido — *"cuja média de nível seja equivalente à do time do treinador"* —, e a soma zero é o que
  transforma isso numa promessa em vez de uma tendência.
- **A CHEGADA MOSTRA A FILA DOS SEIS e deixa reordenar a sua**, como a clareira da Vigília: são as
  **duas únicas batalhas do jogo** em que o jogador vê a ordem do adversário antes de lutar, e a
  razão é a mesma — 6 contra 6 sem cura entre confrontos se decide na ORDEM. O `botaoDeItemHtml` vem
  junto pelo mesmo motivo de lá.

**MEDIDO — e ela é MUITO mais equilibrada que a Vigília**, porque a média é a do time (não −5) e são
6 contra 6 (não 10):

| time | vence os guardiões |
|---|---|
| Lv.30 | 83,8% |
| Lv.40 | 71,5% |
| Lv.50 | 68,0% |
| Lv.60 | 61,5% |
| Lv.70 | 68,8% |

Na jornada de verdade (400 jornadas com `--voo`): ela sai nos trechos **6, 7 e 8** quase em partes
iguais, e o jogador vence **70,2%**. A Vigília, pra comparar, ia de 97,6% no 4º trecho a **22,0%** no
8º — a diferença é aritmética e está registrada na seção dela.

#### AS TRÊS MISSÕES

**⚠️ O NINHO ACESO É DA CONTA; A MISSÃO É DO SAVE (22/09/2026)** — e essa linha entre as duas coisas
é o cuidado inteiro. Pedido assim: *"os 3 ninhos dos lendários lá só tá valendo pro save, tem que
ser por conta ... se em outro save ele conseguiu abrir um dos ninhos tem que aparecer para todos"*.

Até aqui o `game.montanha` guardava **duas coisas de naturezas diferentes** no mesmo lugar, e é isso
que a mudança separou:

| | onde mora | por quê |
|---|---|---|
| **os NINHOS acesos** | **na CONTA** (`ninhosDaConta`) | é um **prêmio conquistado**, e prêmio é do treinador: foi ele que montou o time de Planta e venceu o Blaine, e refazer isso em toda jornada nova é cobrar duas vezes pela mesma conquista |
| **a SEQUÊNCIA do Zapdos** | **no SAVE** | ela é *"três ginásios SEGUIDOS sem perder"* |

**⚠️ E A SEQUÊNCIA NÃO PODE IR JUNTO, o que é o contrário do que parece.** Na conta, o jogador
venceria um ginásio no save A, um no B e um no C e levaria o Zapdos **sem nunca ter emendado três**
— e, pior, uma **derrota** no save A zeraria a sequência que o save B estava construindo. A missão
deixaria de significar uma sequência. Ou seja: **o que você já GANHOU atravessa as jornadas; o que
você está FAZENDO, não.** Há trava pras duas metades.

*(A decisão anterior era guardar tudo no save, pela razão da sequência — ela valia pra ela e foi
estendida aos ninhos sem a distinção acima. Isto é a correção.)*

- **O REINÍCIO ZERA OS DOIS DONOS**: receber o lendário esvazia os três ninhos **pra todos os
  saves** — é o mesmo pote, que é justamente por que um ninho do save A aparece no save B.
- **⚠️ E ELE ZERA O `ninhos` DO SAVE TAMBÉM**, mesmo já não sendo lido: é o que a DEDUÇÃO varre, e
  deixá-lo cheio faria os três ressuscitarem na conta de quem acabou de gastá-los.
- **A gravação é best-effort**, o molde do `visitarOsNinhos`, do HM e do rival padrão: falhando, a
  batalha não para e o ninho vale nesta sessão. Travar a luta por causa do prêmio seria o prêmio
  atrapalhando o que ele existe pra celebrar.
- **Os dois campos entraram no `CAMPOS_DA_CONTA`** — sem isso o `resetGame` os apagaria ao abrir um
  save, e o jogador perderia um lendário que já tinha conquistado.

**⚠️ A DEDUÇÃO DE QUEM JÁ TINHA, E ELA RODA UMA VEZ SÓ.** No carregamento da conta ela varre os
SAVES e une o que estiver aceso em cada um — sem isso, quem tinha o Moltres num save o perderia no
dia do deploy. É a mesma ideia do `repararEvolucoesAtrasadas` e da rede das letras do Unown: fechar
a torneira não pode apagar o que já estava na bacia.
A marca `ninhosMigrados` **não é economia**: sem ela a varredura **ressuscitaria os ninhos que o
jogador acabou de gastar** — o reinício esvazia a conta, mas o save que os tinha continua no
`saveSlots` até o próximo autosave. E ela é gravada **mesmo sem achar nada**, senão a varredura
voltaria a rodar pra sempre em quem nunca acendeu um ninho.

**⚠️ E ELA PRECISA DOS SAVES NA MÃO:** o `loadPermanentUserData` roda **depois** do `loadSaveSlots`
(ele já depende disso pra unir a Pokédex), então `game.saveSlots` está preenchido ali.

**⚠️ E O `visitouOsNinhos` TINHA O MESMO DEFEITO DO `novidadeVista`, desde sempre:** ele era lido
como `!!d.visitouOsNinhos`, e a gravação dele é **best-effort (sem await)**. Quem visitasse os
ninhos e voltasse pra home antes de a gravação propagar tinha a marca **ZERADA** pela releitura —
e as missões paravam de contar em silêncio. Hoje é `|| game.visitouOsNinhos`: **esta marca só
CRESCE**, a regra do `arrayUnion` da Pokédex.

| ninho | o que pede |
|---|---|
| 🔥 **Moltres** | vencer o **Blaine** com **3 de Planta** no time |
| ⚡ **Zapdos** | **3 ginásios seguidos** sem perder pra um líder |
| ❄️ **Articuno** | o **MESMO** pokémon de Gelo derrubando **3 seguidos** numa única batalha |

- **TIPO DUPLO CONTA nas duas que olham tipo** (foi o pedido), e sai de graça: o `ehDoTipo` pergunta
  se o tipo ESTÁ na lista, não se ele é o único. O Venusaur (Planta/Veneno) e a Jynx (Gelo/Psíquico)
  entram.
- **⚠️ OS TRÊS GANCHOS LEEM O RESULTADO E NÃO MEXEM NO MOTOR**, e isso foi desenho: a impressão dele
  é a coisa mais cara de manter neste projeto, e **nenhuma das três precisa de um número que o
  `matchups` não traga**. Conferido por impressão: o mesmo build antes e depois dá o **MESMO hash**
  em 900 batalhas semeadas.
- **⚠️ A PORTA É ÚNICA (`conferirNinhos`) E ELA MORA NO `finishBattle`** — o caminho da batalha de
  GINÁSIO da jornada, e só ele. **É assim que o *"derrotas em outros eventos não quebram a
  sequência"* do Zapdos sai de graça**: a Elite, a Rocket, a Torre e o Ginásio da Cidade não passam
  por ali.
- **⚠️ E ELA RODA NA VITÓRIA E NA DERROTA: é a DERROTA que zera a sequência do Zapdos.** Dentro do
  `if(result.win)` ela cresceria pra sempre, e o ninho acenderia pra quem perdeu quatro vezes. Há
  trava sobre a POSIÇÃO no arquivo, porque um caso de comportamento passaria com a chamada no lugar
  errado.
- **⚠️ E SÓ NA JORNADA (`ehJornada()`)**: o `aceitarConvite` pode cair neste `finishBattle` vindo do
  Ginásio da Cidade — é a **MESMA tela `battling`** —, e ali não há líder nenhum. É exatamente a
  guarda que o **sketch** já precisou, pelo mesmo caminho.
- **A ARTICUNO É A ÚNICA QUE PODE ACENDER NUMA DERROTA**, e é por isso que o anúncio fica FORA do
  bloco de vitória: o pokémon de Gelo derruba três e o time perde a batalha depois.
  Ela **vale na terceira vitória mesmo que ele desmaie em seguida** (o pedido ao pé da letra), e
  **zera quando o pokémon MUDA** — três vitórias de três pokémon de Gelo diferentes não contam.

**O NINHO QUE ACENDE VIRA LINHA NA TELA DE RESULTADO** (`ninhosAcesosHtml`), ao lado do prêmio de
moedas e do HM. Sem ele, uma missão que levou a jornada inteira acenderia **em silêncio** — e o
jogador só descobriria na próxima vez que a Montanha aparecesse, que pode ser nunca. É o mesmo erro
da especialidade que valia 1% e não tinha selo. Ele sai da MARCA (`ninhosAcesosAgora`), e não de "o
ninho está aceso": lido do estado, ele anunciaria o mesmo ninho em toda vitória dali pra frente —
a regra do `ganhouHmAgora`.

**⚠️ E O MODAL SÓ MOSTRA PROGRESSO NO ZAPDOS**: a missão dele é a única que ACUMULA entre batalhas.
As outras duas são um sim-ou-não de uma luta só, e um "0 de 1" ali diria menos que nada.

#### ⚠️ O GARGALO É O MOLTRES, E ELE É DE ESCOLHA — NÃO DE SORTE

Medido em 400 jornadas com o bot (que **não planeja**: ele sorteia a região a cada etapa e monta o
time por tipo/BST):

| ninho | acende em |
|---|---|
| ⚡ Zapdos | **347 de 400 (87%)** |
| ❄️ Articuno | 8 de 400 (2%) |
| 🔥 Moltres | **1 de 400 (0,25%)** |
| **os três juntos** | **0 de 400** |

**E forçar Kanto não move o Moltres** (1 de 400 também), o que localiza a causa: não é encontrar o
Blaine, é **ter 3 de Planta no time naquela hora**. Ou seja, a batalha dos quatro é rara **por
escolha de time**, não por azar — que é exatamente o que um troféu deve pedir.
**E ela é alcançável de propósito:** conferido nos pools, há Planta pra capturar nos trechos
**1, 2, 4 e 5** (5, 3, 1 e 3 espécies), então quem quer o Moltres tem onde pegar.
Se um dia isso for duro demais, a régua é o **3** da missão dele.

#### A BATALHA DOS QUATRO

**Zapdos, Articuno, Moltres e Lugia, todos no Lv.65, numa equipe só** — foi o pedido. É **4 contra
6**, e ela pede um time maduro:

| time | vence os quatro |
|---|---|
| Lv.55 | **0,0%** |
| Lv.60 | 3,2% |
| **Lv.65** | **56,6%** |
| Lv.70 | 88,6% |
| Lv.80 | 99,4% |

O degrau entre 60 e 65 é o desenho: abaixo do nível deles ela é praticamente impossível, no mesmo
nível é uma luta de verdade.

**⚠️ O LUGIA É INTOCÁVEL, e esta é a SEGUNDA porta pela qual um deles se deixa capturar** — depois
do Ho-Oh da Vigília (16/09/2026). **A decisão é a MESMA de lá, e ela é a que mantém tudo de pé: ele
é TROFÉU, não requisito.** As metas de "capturar tudo" (a **Pokédex de Johto** e o **Mestre
Pokémon**) continuam EXCLUINDO os três — contando o Lugia, toda conta que já tem essas conquistas
**PERDERIA** a conquista até subir a montanha, e conquista que se perde sozinha é pior que conquista
nenhuma. Há trava pras duas metas.

**O QUE CADA PRÊMIO VALE** (1x1 contra um painel de 8, Lv.65):

| | vitória |
|---|---|
| **Lugia** | **73,8%** |
| Articuno | 62,1% |
| Moltres | 49,8% |
| Zapdos | 48,3% |
| *(um guardião comum: Fearow)* | *25,2%* |
| *(Pidgeot)* | *14,6%* |

- **⚠️ AS TRÊS MISSÕES REINICIAM QUANDO O LENDÁRIO É RECEBIDO, e não quando a batalha é vencida.**
  Quem vence e fecha a aba antes de escolher não pode perder as três missões que levaram a jornada
  inteira pra acender. Há caso de teste pra exatamente isso.
- **O PRÊMIO ENTRA COMO UM SELVAGEM CAPTURADO** — mesmo nível, e passando pela MESMA tela de escolha
  de golpes. **Com o time cheio ele entra assim mesmo e o time fica com 7**: quem resolve é a tela
  do Prof. Carvalho, *"pelo fluxo já existente"* que o pedido nomeia. É o caminho da Vigília,
  inteiro, e os DOIS prêmios (o guardião e o lendário) usam a mesma entrega — sem um segundo caminho
  pra manter.
- **COM OS TRÊS ACESOS A BATALHA SUBSTITUI O PRÊMIO**, e não se soma a ele: o pedido diz que a
  escolha entre os seis voadores é pra quem *"ainda não tenha liberado os três ninhos"*.
- **PERDER A BATALHA DOS QUATRO VOLTA PROS NINHOS**, com eles ainda acesos — a luta pode ser tentada
  de novo. *"Sair sem recompensa"* é perder a LUTA, não as três missões.

#### O PREÇO NA JORNADA: NADA

**58,19% sem a montanha contra 58,88% com** — **+0,69 ponto, 1,0σ** (8 blocos de 800 jornadas de
cada lado, **6.400 de cada**, o MESMO bot contra a MESMA cópia congelada, desvio tirado de ENTRE os
blocos, **5 de 8 blocos** pro lado da montanha). Ruído puro.
Faz sentido: o jogador troca um encontro selvagem (duas capturas) por uma aposta de **70%** que
rende **uma** — e é uma captura melhor. As duas coisas quase se cancelam.
**E pra quem NÃO tem o HM02 o preço é zero por construção**: sem ninguém que voe, o card fica
trancado e a rota nunca é escolhida.

- **⚠️ O `MAX_POKEMON_LEVEL` NÃO EXISTIA** — este arquivo o citava ("Teto de nível: 99"), mas o nome
  tinha caducado e o 99 vivia escrito à mão no único lugar que precisava dele. Ele nasceu de verdade
  aqui (`NIVEL_MAXIMO`), porque a média do time com o desvio +3 pode encostar nele num save de Doce
  Raro.
- **⚠️ E O SMOKE PRECISOU DE `--voo`**, pelo mesmo motivo do `--corte`: o bot nunca ensina nada,
  então sem a flag o card fica trancado e a rota **nunca é escolhida** — a montanha seria invisível
  na medição. É a mesma armadilha que já custou um A/B inteiro medindo zero.
- **⚠️ E O `continueAfterSpecial` NÃO TEM O RESULTADO**: ele anula o `specialBattleResult` três
  linhas depois de começar, então quem perguntar por `win` lá embaixo pergunta a um null. O valor é
  lido no topo, junto do `context`. O smoke pegou isso em 6 de 40 jornadas.

**Medido a 320px, no navegador:** a chegada fica em **2.052px** (as duas filas de seis), os ninhos em
**1.389px** com os três cards em **77×67px** — do MESMO tamanho vazio ou cheio, que é o que a altura
fixa do `.ninho-cima` compra —, a tela do prêmio dos quatro em **804px** e o modal de um ninho em
**265×370px** (cabe numa tela de 568 sem rolar). **Nenhuma rola pro lado.**
O banner herda a regra de contraste da Vigília: **texto branco sobre gradiente escuro**, com o pior
pedaço medido em **7,70:1** — o tom claro foi escurecido de `#5a6675` (que dava 5,85:1, passando no
AA mas abaixo do alvo da casa) pra `#4a5460`.

`tools/test-jornada.js` tranca 60 pontas: o sorteio (nunca antes do 6º, a taxa, a semente, a
geração, **nunca junto com a mata**), a chave (o desenho, a AÇÃO, a frase nomeando o HM02 e a mata
continuando no HM01), os guardiões (seis, todos voadores, sem lendário, sem linha repetida, a média
exata, a espécie batendo com o nível, semeados), as três missões uma a uma com os casos que uma
leitura ingênua erraria, a porta única não acendendo duas vezes, os dois prêmios, o time cheio
caindo no Prof. Carvalho, o reinício **ao receber**, as telas, o save e — lendo o código — o
`ehJornada()` e a posição do gancho. Conferido que ele acusa com cada um dos **sete** defeitos
religados.

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

## APOSENTAR O TIME: O PROF. CARVALHO (17/09/2026)

Pedido assim: *"quando um save já não tem mais o que fazer após vencer as 8 insígnias, por exemplo,
ele já venceu a elite 4, ou perdeu para a elite 4, deve aparecer a opção de aposentar o time, quando
clicar nele, os pokémons vão para o professor carvalho e não vai mais ser possível utilizar esse
time em ligas onlines e batalhas onlines, porém podem ser utilizados na torre dos treinadores e no
ginásio da cidade"*.

- **⚠️ APOSENTAR APAGA O SAVE desde 18/09/2026** (a pedido: *"após aposentar um time, o save deve
ser deletado automaticamente, então quando o usuário clicar para se aposentar, ele deve saber
disso e clicar em confirmar"*). **Isso REVERTE a decisão de 17/09**, que mantinha o save de
propósito — o texto dela era *"o time NÃO é apagado, e é isso que faz o pedido fechar"*, porque
esvaziando o save ele sumiria da Torre e do Ginásio da Cidade.

**⚠️ MAS O TIME CONTINUA JOGÁVEL NA TORRE E NO GINÁSIO DA CIDADE** — pedido no mesmo dia, horas
depois: *"os pokemons que são aposentados, podem sim ser utilizados na torre de treinadores e
ginasio da cidade, só nao pode mais participar de ligas e batalhas online"*.

**⚠️ EU TINHA LIDO O DELETE COMO "SAI DOS DOIS MODOS", E ERA A LEITURA ERRADA.** As duas coisas
parecem uma só e não são: o que morre é a **JORNADA**, não o time. Com o save apagado eles somem
das listas que varrem `users/{uid}/saves` — então o **arquivo da conta virou a origem de onde os
dois modos montam**.

- **⚠️ O ARQUIVO ENTRA NO `disponiveis` do `resolverTimeDosSaves`**, ao lado dos saves vivos. É a
  função única por onde a Torre e o Ginásio da Cidade montam time (as três chamadas: defesa,
  desafio e subida da torre), e **nenhuma liga passa por ela** — conferido. Ou seja, o aposentado
  vale exatamente onde o pedido manda e em lugar nenhum além.
- **⚠️ O SLOT DELES É SINTÉTICO (`ap:<slot de origem>`), e isso não é estética:** o jogador pode ter
  começado uma jornada NOVA naquele slot, e o casamento do servidor é por **slot+idx+espécie** —
  com o slot cru, o pedido casaria com o pokémon errado. É o defeito de 01/09/2026 por outra porta.
  Medido: um save vivo no slot 3 e dois aposentados do mesmo slot convivem com **8 identidades
  distintas**.
- **⚠️ MAS A ORIGEM VIAJA JUNTO (`slotOrigem`), porque o ITEM EQUIPADO é por SAVE.** A chave dele é
  `slot:raiz-da-linha`, e o `equipados` é da CONTA — ele sobrevive ao save morrer. Sem a origem, um
  Venusaur aposentado do slot 11 perderia o item que carregava. A **chave da espera do ginásio**
  (save+espécie) sai do mesmo lugar, pelo mesmo motivo.
- **⚠️ E ELES NÃO PASSAM PELO FILTRO DAS 8 INSÍGNIAS**, de propósito: só se aposenta quem já
  terminou a jornada, então a condição foi cumprida quando o time entrou no arquivo — e o save que
  a provava não existe mais pra ser consultado.
- **A PORTA DOS MODOS CONTA O ARQUIVO** (`quantosParaTorreOuGinasio`): quem aposentou tudo tem
  `savesComOitoInsignias` **vazio** e um arquivo cheio, e sem essa soma a porta fecharia justamente
  pra quem o pedido quer deixar entrar. **As ligas e o online continuam lendo o `savesCampeoes`** —
  é ali que a aposentadoria morde, e é o ponto inteiro dela.
- **NA TELA eles aparecem como um time chamado "Prof. Carvalho"**, ao lado dos times de save. O
  montador já agrupa por origem, então não houve tela nova.

**E eles continuam virando um registro na Pokédex** (a tela do Prof. Carvalho) — o que mudou é que
o registro deixou de ser a *única* coisa que sobra deles.

#### ⚠️ E O SLOT SINTÉTICO QUEBROU O CLIQUE EM SILÊNCIO

O montador monta o `onclick` assim: `${nomeDoToggle}(${p.slot},${p.idx})`. O slot **sempre foi um
número**, então ele ia **sem aspas** — e com `ap:3` o atributo vira `towerTogglePick(ap:3,0)`, que
é **sintaxe inválida**. O clique não fazia **nada**, e **não havia erro no console**.

**⚠️ É A MESMA FAMÍLIA DO `JSON.stringify` que matou o botão da notificação da liga em 17/09**: um
valor que não é o tipo esperado quebrando o `onclick` por dentro, com a tela continuando a
**PARECER** certa. E ela passa em **qualquer** asserção de estado — foi o navegador que pegou.

- Hoje o slot vai **entre aspas**, pelo `escJs`, como todo o resto do arquivo.
- **E o `alternarEscolhaDeTime` compara por `String()`**: o slot de um save é NÚMERO e o de um
  aposentado é TEXTO, e o `onclick` manda os dois como texto — com `===` cru, escolher um
  aposentado não fazia nada.
- A trava lê o **HTML gerado** e cobra que **todo** `onclick` do montador mande o slot entre aspas
  — não só o do aposentado, senão o próximo tipo de origem nasce com o mesmo defeito.

**⚠️ E ELE DERRUBOU UM EXTRATOR DE TESTE, que é a lição de sempre:** a trava do montador procurava
`towerTogglePick\(\d+,\d+\)` pra contar identidades, e com as aspas ela passou a casar com
**ZERO** — acusando *"0 de 0"*, que é o pior falso positivo possível: ela deixou de medir qualquer
coisa e continuou vermelha por outro motivo.

#### ⚠️ E AS DUAS CHAVES QUASE DIVERGIRAM — e elas querem dizer coisas diferentes

O pokémon devolvido pelo resolver carrega **dois** identificadores de origem, e a tentação é fazer
os dois iguais:

| campo | qual slot | por quê |
|---|---|---|
| **`slotDaConta`** (o ITEM equipado) | a **ORIGEM** (`3`) | o `equipados` da conta guarda `slot:raiz-da-linha` e **sobrevive ao save morrer** — com o sintético, o aposentado perderia o item que carregava |
| **`chave`** (a ESPERA de 10 min do ginásio) | o **SINTÉTICO** (`ap:3`) | ela é do POKÉMON: com a origem, um Venusaur aposentado do slot 3 dividiria a espera com um Venusaur de uma jornada **NOVA** naquele mesmo slot — são dois bichos diferentes |

**⚠️ E A CHAVE TEM QUE BATER COM A DO CLIENTE**, que a monta do `p.slot` (já o sintético). O
CLAUDE.md já avisava: *"se as duas divergirem, a tela libera quem o desafio recusa — ou apaga quem
podia lutar"*. Eu tinha posto a origem nas duas e a divergência nasceu ali; hoje há trava lendo o
código dos dois lados.

**⚠️ E A TRAVA NASCEU MEDINDO O VAZIO:** ela fatiava **5.000 caracteres** do resolver e o `chave:`
está no **6.579** — as duas asserções falhavam com o código **certo**. É a mesma armadilha da fatia
vazia do `tentarGolpeEspecial`, e o conserto é o mesmo: fatiar **até o fim da função** e ter um
`ok` cobrando que a fatia tem tamanho.

- **O TIME VAI PRO ARQUIVO DA CONTA** (`users/{uid}.aposentados`), em **resumo**: espécie, nível,
  shiny, golpes e a letra do Unown, mais o slot e a data. O pokémon inteiro tem dezenas de campos
  de estado de batalha (`_queimado`, `_furia`, HP do momento) que não dizem nada num arquivo.
- **⚠️ A ORDEM É A REGRA: o arquivo e a Pokédex são gravados ANTES de o save morrer.** Se a
  gravação falhar, o save **fica** e o jogador é avisado — perder a jornada E não guardar o time
  seria o pior dos dois mundos. É o mesmo lado pra que o `usarTM` erra.
- **AS DUAS GRAVAÇÕES SÃO `arrayUnion`**, que é a única escrita de lista que não pode **encolher**
  — a lição que custou 49 espécies da Pokédex de um jogador.
- **O ginásio é vagado antes**, como no delete comum: doc de ginásio é escrita exclusiva do
  servidor, e um save apagado não pode deixar um ginásio com líder fantasma.
- **SAVE JÁ APOSENTADO ANTES DESTA DATA continua existindo** com a marca `aposentado`, e o
  `saveAposentado` continua respondendo por ele — ninguém perde o que já tinha.

- **⚠️ E ISSO PARTIU `savesCampeoes()` EM DUAS PERGUNTAS.** Ela era a porta única dos três modos, e
  agora duas listas discordam **num caso só** — a conta que só tem time aposentado:

  | | quem lê |
  |---|---|
  | **`quantosParaTorreOuGinasio()`** — os saves com 8 insígnias **+ o arquivo da conta** | Torre, Ginásio da Cidade |
  | **`savesCampeoes()`** — os saves com 8 insígnias, MENOS os aposentados | Ligas, Batalha Online |

  ⚠️ **A primeira ganhou o arquivo em 18/09/2026**, quando aposentar passou a apagar o save: sem
  ele ela devolveria zero pra quem aposentou tudo, e os dois modos fechariam a porta.

  O nome ficou em `savesCampeoes` porque ele é o que o resto do código já chamava: renomear os 9
  chamadores só pra trocar a palavra deixaria a mudança maior do que ela é.
- **A PORTA GANHOU UM PARÂMETRO** (`exigeTimeCampeao(incluirAposentados)`), e **só o Ginásio da
  Cidade passa `true`**. Há trava contando as três chamadas E cobrando qual delas tem o `true` — sem
  a segunda metade, "acrescentar em todo lugar" passaria.
- **⚠️ A TORRE NÃO PRECISOU DE NADA, e isso foi conferido, não suposto:** o `towerEligiblePokemon`
  tem **laço próprio** com `if(badges < 8) continue` e nunca leu a lista. Ela enxerga o aposentado
  de graça — e a trava existe pra o dia em que alguém unificar as duas e fechar a Torre sem querer.
- **⚠️ E O SERVIDOR PRECISOU DE UMA LINHA, num lugar só: a TRAINERS LEAGUE.** Ela é a única liga em
  que o SERVIDOR monta a lista sozinho, **lendo os saves** (`trainersLeagueGatherEligibleCodesForUid`,
  no refresh de 5 min antes de cada rodada) — nas outras o time vem de uma inscrição que o jogador
  fez. Sem a guarda ali, o time aposentado **voltaria pro sorteio de rodada por conta própria**, que
  é exatamente o que a aposentadoria promete que não acontece.
  O `resolverTimeDosSaves` (Torre + Ginásio da Cidade) **não** exclui, e há trava cobrando as duas
  coisas.
- **⚠️ E O QUE FICA EM ABERTO, registrado pra ser decisão e não descuido:** na Clássica, nas
  customizadas e no online a inscrição vem do CLIENTE, então um cliente forjado conseguiria
  inscrever um time aposentado. O risco é baixíssimo — é o próprio jogador se devolvendo o que ele
  mesmo abriu mão — e fechar isso custaria uma leitura de save por inscrição. Se um dia importar, o
  lugar é o `registerForLeague`.
- **É UM CAMINHO SÓ DE IDA, e por isso ele PERGUNTA antes.** Não há tela pra desfazer, de propósito:
  se desse pra voltar, ela não seria uma decisão — seria um interruptor. O modal nomeia o time,
  diz onde ele **continua** valendo e avisa que não tem volta.
- **A GRAVAÇÃO É NA HORA** (`await saveCurrentGame()`), não pelo autosave: ele é debounced em 800ms
  e só roda nas telas seguras, e uma decisão definitiva não pode depender disso.
- **⚠️ O BOTÃO SÓ APARECE COM A JORNADA RESOLVIDA**: as 8 insígnias **E** a Elite vencida ou perdida
  (`eliteStatus === 'champion' || 'defeated'`). Com a Elite **em andamento** ele some — aposentar no
  meio do rush jogaria fora uma tentativa que ainda está de pé.
- **A TELA DE FIM DE JORNADA É A ÚNICA PORTA.** Não há atalho na home nem na tela de time: uma
  decisão sem volta se toma no lugar em que ela faz sentido, não num botão que se esbarra sem
  querer. Depois de aposentado, a caixa troca de texto e conta onde o time ainda vale.
- **SAVE ANTIGO NASCE ATIVO**: sem o campo, `aposentado` é false — como sempre foi.
- **Medido a 320px, no navegador:** a caixa da oferta mede **257px**, a do estado aposentado
  **205px** (a página vai de 1.971 pra 1.920px) e o modal **265×473px**, que cabe numa tela de 568
  sem rolar. Sem rolagem lateral em nenhum dos três.
- `tools/test-inventario.js` tranca as duas listas, a porta discordando só no caso do aposentado, a
  Torre e o montador do desafio enxergando o time, o botão nos quatro estados de `eliteStatus`, a
  pergunta antes da ação, o campo atravessando o save (e o save antigo nascendo ativo), o modal no
  `render()` e as duas guardas do servidor. Conferido que ele acusa **4 falhas** com a lista velha
  de volta, **3** com o Ginásio usando a lista restrita e **1** sem a guarda da Trainers League.

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

