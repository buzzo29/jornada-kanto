# AS ILHAS LARANJA

Os **cinco minigames** do arquipélago, o **mapa**, a **travessia** a partir da jornada e os
**rankings** deles. Saiu do `CLAUDE.md` em 25/09/2026, por medição: ele tinha chegado a **1.360 KB
— ~544 mil tokens** e é lido INTEIRO em toda sessão, então sobrava menos da metade da janela pro
trabalho e a sessão passava a comprimir no meio.

⚠️ **A REGRA QUE VALE AQUI É A MESMA DO RESTO DO PROJETO:** comentar o **porquê**, nunca o quê; e
**nunca mudar balanceamento sem apresentar o impacto medido**. Os cinco jogos são chamadores do
motor de batalha — mexer neles não muda a jornada, mas **a impressão do motor tem que continuar
idêntica**, e é ela que prova isso.

⚠️ **E O QUE NÃO ESTÁ AQUI:** o motor de batalha mora em `docs/motor-de-batalha.md`, e o resto do
jogo no `CLAUDE.md`.

## CORRIDA POKÉMON — o primeiro teste, modo ADMIN (18/09/2026)

Pedida com o `corrida-pokemon.html` da raiz como referência visual e funcional: uma corrida vista
de cima, só contra NPC, com uma barra de ritmo. **Nada de multiplayer nesta etapa.**

### ⚠️ O QUE FOI MEDIDO ANTES DE ESCREVER — e duas medidas mudaram o desenho

| pergunta | resposta medida |
|---|---|
| o `effectiveSpeed` do jogo escala com o **nível**? | **NÃO.** Jolteon Lv.5 e Lv.99 devolvem **130 igual** — no motor só o HP escala (`calcMaxHp`), e a velocidade é usada crua pra decidir quem bate primeiro e pro crítico |
| dá pra usar os sprites PMD nas **250** espécies? | **SIM: 250 de 250** respondem 200 no `SpriteCollab`, pelo MESMO CDN que o jogo já usa. 6 a 11 KB por folha |
| o campo `admin` chega no cliente? | **Não chegava** — só o servidor o lia (`adminListTrainers`) |

A primeira obrigou a **criar** a escala de nível; a segunda liberou o modo pro bicharedo inteiro,
em vez das seis espécies que o protótipo embute em base64.

### O ACESSO

- **`game.ehAdmin = d.admin === true`** — exatamente o booleano. `'sim'`, `'true'` e `1` **não**
  autorizam, e há trava nomeando os quatro casos.
- **⚠️ LER É SEGURO PORQUE ESCREVER NÃO É:** o `admin` está na **trava de campos** do
  `firestore.rules`, ao lado de `moedas` e `rareCandies` — o dono do documento não consegue
  escrevê-lo, só o console do Firebase. Sem essa trava, uma linha no console abriria o modo.
- **⚠️ ENQUANTO A CONTA CARREGA O BOTÃO FICA OCULTO**, e isso é o **contrário** da porta dos modos
  de campeão, que erra pro lado de DEIXAR ENTRAR. Aqui o lado seguro é o outro: mostrar um botão
  administrativo a quem não é admin, mesmo por meio segundo, é pior que escondê-lo de quem é.
- **A visibilidade não é a trava:** o `abrirCorrida` refaz a pergunta. Quem chamar pelo console não
  entra.
- **⚠️ NÃO HÁ OPERAÇÃO DE BACKEND NOVA**, e isso é o desenho: a corrida é **inteiramente offline** —
  nenhuma Cloud Function, nenhuma escrita no Firestore, nada no save. Não há, portanto, uma terceira
  checagem de permissão a fazer; o dia em que houver ranking ou recompensa, ela nasce junto.

### O SPEED — o que é REUSO e o que é CRIAÇÃO

```
speedDaCorrida(p) = floor( effectiveSpeed(p) × 2 × nível / 100 ) + 5
velocidade (m/s)  = 8 + 4 × √(Speed ÷ 100)
```

- **O `effectiveSpeed` é a função do motor de batalha**, e chamá-la é o que dá **shiny (1,20×) e
  especialidade (1,05×)** de graça. Os outros degraus dela (terreno, fúria, paralisia, estágio) são
  **no-op por construção**: a instância da corrida vem do `createInstance` e nasce LIMPA. É reuso de
  verdade — um buff novo no motor entra aqui junto, e não há como aplicar duas vezes.
- **⚠️ A ESCALA DE NÍVEL É CRIAÇÃO, não reuso**, porque o jogo não tem uma. É a fórmula oficial da
  Gen 1/2/3 sem IV nem EV: no Lv.50 ela devolve ~base (a escala do protótipo, onde Jolteon 130 corre
  a 12,6 m/s) e no Lv.99, ~2× base.
- **⚠️ E A ESPECIALIDADE QUASE NÃO ENTROU.** O comentário do código chegou a dizer que ela entrava
  "sozinha, porque o `withSpecialty` lê o `game.specialties`" — **e isso é falso**: ele lê a FLAG
  `p.specialtyBuffed`, e quem a põe é o `applySpecialtyBuff`. A trava pegou (um Jolteon de
  especialista em Elétrico dava o mesmo 135 de quem não é). É o defeito que a raide do Mew teve por
  semanas, e por isso o jogo tem uma trava cobrando essa chamada perto de cada batalha.
- **⚠️ E O NPC NÃO HERDA A ESPECIALIDADE:** ela é conquista da CONTA, e o adversário não tem conta.
  O `corridaInstancia(p, ehDoJogador)` **não tem padrão** de propósito — com `true` implícito, a
  próxima chamada esquecida daria o buff ao adversário em silêncio.
- **⚠️ E O `map` NÃO PODE RECEBER A FUNÇÃO DIRETO:** ele passa `(item, ÍNDICE, array)`, e o índice
  viraria o `ehDoJogador` — o PRIMEIRO do revezamento (índice 0, falso) perderia o buff e os outros
  dois o ganhariam. É a armadilha do `map(parseInt)`.

**A faixa que isso produz**, medida: de **8,9 m/s** (Shuckle Lv.5) a **~15 m/s** (Jolteon Lv.99
shiny) — razão de 1,7×, e os 300 m levam de 20 a 34 s. O `8 +` da fórmula é o que impede um Shuckle
de ficar parado na pista.

### A FÍSICA — o quadro é FATIADO, e é isso que faz os limites serem exatos

O avanço é `velocidade × tempo`, e o quadro é cortado no **vencimento do efeito** e em **cada troca
de trecho**. Medido: a mesma corrida em passos de 1/60, 1/10 e 1/5 dá o **mesmo tempo de chegada**.

- **⚠️ A TROCA É REGISTRADA com a distância e o instante EXATOS**, e isso não é enfeite: medida de
  FORA, no fim do quadro, ela sai em **300,07 m** — porque o próximo já correu o resto do quadro,
  que é exatamente o que o pedido manda fazer. Sem o registro não há como provar que o limite foi
  respeitado, e foi assim que a primeira medição **pareceu um defeito que não existia**.
- Medido com um quadro de 5 s (o limite cai bem no meio): a troca acontece em 300 exatos e os 2 s
  que sobram correm com o Speed do **segundo**, não do primeiro.
- **A classificação é pelo INSTANTE de chegada**, nunca pela ordem de processamento — há caso de
  teste com o array propositalmente na ordem inversa do resultado.

### A BARRA — ela vai e VOLTA

A posição é um **triângulo**: de 0 a 1 e de volta a 0, invertendo nas laterais. É essa conta que faz
a detecção valer **nos dois sentidos sem um `if` de direção** — a faixa é uma região da BARRA, não
um intervalo de tempo. Medido: o maior passo entre amostras vizinhas é o próprio passo, nunca ~1.

- **⚠️ AS BORDAS EXATAS QUASE FICARAM DE FORA, por float:** `Math.abs(0.348 − 0.5)` dá
  **0,15200000000000002** contra uma meia-faixa de **0,152** — o início exato do verde caía FORA
  dela, e o mesmo no amarelo (0,452 virava "bom" em vez de "perfeito"). O `CORRIDA_EPS` de 1e-9 não
  é folga: é a borda pertencendo à faixa.
- **As faixas do CSS saem das CONSTANTES**, inline — um número escrito na folha de estilo divergiria
  da detecção no primeiro ajuste, e a barra prometeria uma região que o motor não pontua. É a mesma
  lição do selo de terreno prometendo um bônus que a batalha não dá.
- **⚠️ SÓ CLIQUE E TOQUE:** o atalho de Espaço do protótipo saiu. E **`type="button"` sozinho não
  basta** — um `<button>` focado dispara `click` com Espaço **e com Enter** por padrão do
  navegador, então a guarda de `keydown` é o que fecha a porta dos fundos. Conferido no navegador:
  os dois são prevenidos e o clique/toque continua funcionando.
- **Uma tentativa por travessia**, e a trava é o ÍNDICE da travessia — ela se solta sozinha quando o
  marcador atinge a lateral, o que dá as duas tentativas por ciclo (uma na ida, uma na volta).

### OS SPRITES — PMD, do mesmo CDN que o jogo já usa

- **`PMDCollab/SpriteCollab`**, pelo `cdn.jsdelivr.net` com fallback no `raw.githubusercontent.com`
  — exatamente o par que o `handleSpriteLoadError` já usa pros sprites da PokeAPI. A pasta é o
  **dex com quatro dígitos**.
- O `AnimData.xml` dá `FrameWidth`, `FrameHeight` e as `Durations` — os mesmos campos que o
  protótipo embute, e **conferido que batem** (Charizard 40×48, durações 8/10/8/10).
- **A quinta linha** da folha é o norte (de costas), índice 4 — como no protótipo.
- **⚠️ A CAIXA DE CADA QUADRO É CALCULADA EM RUNTIME**, uma vez por espécie, varrendo os pixels não
  transparentes. O protótipo traz `boxes` embutido, e manter uma tabela dessas pras 250 seria mais
  um dado pra envelhecer. É ela que centraliza o bicho na raia e ancora os pés.
- **⚠️ E NUNCA SE SUBSTITUI UM SPRITE POR OUTRO:** se uma espécie falhar, **a largada é bloqueada** e
  a tela diz **qual** faltou, pelo nome. O pedido é explícito nisso.
- A cadência do Walk acompanha a velocidade (o 2,2 e o /12 do protótipo) e **não decide distância
  nenhuma** — há trava cobrando que `quadroT` não apareça na conta de `dist`.

### ⚠️ O ESTADO É UM `const` QUE NUNCA É REATRIBUÍDO

Ele é **mutado** (`corridaZerar` troca os campos e a referência continua a mesma). Isso não é
estilo: o sandbox dos testes copia o valor na criação, então reatribuir `corrida` deixaria as
funções internas olhando pro objeto velho — **as travas mediriam o nada**, e foi exatamente o que
aconteceu na primeira rodada (a física "não terminava" e o número de corredores era sempre 2).
O jogo ganha junto: some o `if(!corrida)` que teria que abrir toda função.

**E ele vive FORA do `game`:** nada da corrida vai pro save nem pro Firestore, e os pokémon entram
como CÓPIAS. Medido: o time do save fica **byte a byte idêntico** depois de uma corrida inteira.

### O QUE FOI MEDIDO NO NAVEGADOR

| | |
|---|---|
| as **seis** combinações (2/3/4 × individual/revezamento) | todas terminam, distância exata, trocas nos múltiplos de 300 |
| a lista de corredores | ordenada pelo **Speed da corrida** — o mesmo número que decide a pista |
| os NPCs | forma final pelo `finalEvolutionOf`, sem repetir linha na equipe, nível do trecho |
| a pausa da aba | **31 s** oculta = **zero** metros, e sem salto na volta |
| a 320px | setup 657px, picker 872px, corrida 699px — **sem rolagem lateral** em nenhuma |
| no **iPhone 16e** (390×844) | a corrida **cabe inteira sem rolar** (844px exatos), botão 328×52 |

### AS CINCO DE 18/09/2026 — dois defeitos e três mecânicas

#### ⚠️ O MODAL DA CONTAGEM NÃO SAÍA DA TELA -- e o conserto errou o alvo na primeira vez

Reportado: *"após a largada, tem um modal no meio da tela que não sai, tá ficando escrito 1 e
embaixo Vai!"*. O overlay era **montado condicionalmente** (`fase === 'contagem' ? ... : ''`), e a
fase vira `'correndo'` **DENTRO do laço** — que não chama `render()`, pela regra da casa (redesenhar
durante a animação recria o canvas e mata a transição). Resultado: o HTML ficava lá, congelado no
último número.

Hoje ele **existe sempre** e o **pintor** o esconde pelo `hidden`, como o resto do HUD. Nada de
`render()`.

**⚠️ E ISSO NÃO BASTOU: foi reportado DE NOVO.** O atributo `hidden` é `display:none` pela folha do
**NAVEGADOR**, que tem a menor prioridade que existe -- e o `.corrida-overlay` é `display:flex`.
**Qualquer `display` do autor anula o `hidden`.** Faltava `.corrida-overlay[hidden]{display:none}`.

**⚠️ E A TRAVA TINHA PASSADO NAS DUAS VEZES**, porque ela conferia que o atributo estava no HTML --
e estava. O que faltava era conferir se ele **fazia efeito**, e isso só se lê no CSS. É a terceira
vez neste dia que a marcação está certa e quem erra é a folha de estilo (as outras duas foram o
sprite que não encolhia e o nome que sumia no card da Máquina). Hoje a trava lê o CSS.

#### ⚠️ A PISTA É PROPORCIONAL — e o defeito voltou por TRÊS pontas antes de fechar

Reportado: *"no fim da corrida o pokémon que está atrás fica correndo no mesmo lugar por um tempo"*.

| ponta | por que o último parava |
|---|---|
| **1ª — o `log1p` com teto de 80px** | quem ficava >100 m atrás **saturava no teto** e não se mexia mais, enquanto o cenário rolava pelo líder |
| **2ª — o vão maior que a tela** | com `CORRIDA_VAO_PISTA` de 150 e o líder em 247, o fim do pelotão caía em 397 num quadro de 356 — e batia no limite |
| **3ª — a escala de ENCAIXE EXATO** | `vao / dispersão` põe o último **sempre** a exatamente um vão do líder: ganhe ou perca terreno, a escala se ajusta e ele **não sai do pixel** |

A terceira é a sutil, e só a trava pegou (`347 → 347`). A saída da vez foi **escala em DEGRAUS**
(`CORRIDA_ESCALAS`): dentro de um degrau tudo é linear — dez metros ganhos são dez metros × escala
de pixels, pra todo mundo. O preço é um salto na troca de degrau, que é o que um zoom faz.

**⚠️ ISTO É HISTÓRIA: os degraus duraram algumas horas** e viraram a 4ª ponta do mesmo defeito — a
troca de degrau move todo mundo de uma vez, e é ISSO que o jogador leu como o adversário "indo e
voltando". Hoje não há escala que se ajuste: ver **A CÂMERA SEGUE O JOGADOR**, logo abaixo.

#### ⚠️ A CÂMERA SEGUE O JOGADOR — cinco versões, e as quatro primeiras faziam a MESMA pergunta

Dois relatos em sequência, e o segundo é o que virou a mecânica de hoje:

> *"eu cheguei bem na frente do meu adversário, porém na tela ficou meu adversário indo e
> voltando ... não dá para criar uma pista contínua e respeitar o lugar de cada pokémon nessa
> pista conforme a metragem que ele está?"*

> *"a pista está parecendo muito curta para ter 300 m. Logo quando larga já está aparecendo a
> linha de chegada e o pokémon corre mas parece que não corre muito ... parece que os pokémons
> estão correndo muito mas a distância aparenta ser muito pequena"*

**⚠️ AS QUATRO PRIMEIRAS VERSÕES TENTAVAM MOSTRAR O PELOTÃO INTEIRO**, e essa era a pergunta
errada: pra caber todo mundo, a escala tem que ser minúscula — e aí a prova inteira cabe numa
tela e ninguém parece sair do lugar.

| versão | o que quebrava |
|---|---|
| `log1p` com teto de 80px | quem ficava >100 m atrás **saturava** e parava de se mexer |
| `vao / dispersão` (encaixe exato) | o **último** fica sempre a um vão do líder — congelado no pixel |
| **degraus** | dentro do degrau é linear, mas a **troca** move todo mundo de uma vez: na tela isso se lê como o adversário **"indo e voltando"** |
| **escala fixa pequena** (0,83 px/m) | os 300 m cabiam em **0,6 de uma tela**: a chegada visível na largada |

**A resposta é a de qualquer jogo de corrida: não se mostra a prova toda, mostra-se o pedaço em
volta de quem você controla.** A escala foi de 0,83 para **8 px/m** e a câmera passou a seguir o
jogador.

| | antes (0,83 px/m) | **hoje (8 px/m)** |
|---|---|---|
| pista visível na tela | 470 m | **49 m** (11 atrás, 38 à frente) |
| os 300 m de um trecho | 0,6 tela | **6,2 telas** |
| a 12 m/s, atravessar a tela | 39 s | **4,1 s** |
| o chão rolando a 9,8 m/s | 16 px/s | **78 px/s** |

**⚠️ A CÂMERA É O JOGADOR, NUNCA O LÍDER**, e essa é a diferença que importa: presa ao líder,
quem estivesse perdendo escorregaria pra fora da própria tela. O jogador cai sempre em
`CORRIDA_Y_EU` **por construção** — a diferença dele pra ele mesmo é zero — e o mundo é que rola.

- **⚠️ E O CHÃO DEIXOU DE TER MULTIPLICADOR.** Ele era `lider * escala * 2`: pelo **líder** porque
  nada mais se mexia, e o **dobro** pra "dar sensação de velocidade" quando a escala era minúscula.
  Com 8 px/m a sensação vem da própria corrida, e o dobro faria o chão correr mais que os pés.
- **⚠️ A LARGADA VIROU UMA METRAGEM (o zero), como tudo o mais.** Ela era um y FIXO na tela e só
  existia ANTES de largar; hoje ela vive na pista, fica pra trás e some sozinha — medido, **0,8 s
  depois da partida**. A chegada segue a mesma regra e só aparece nos **últimos 3,7 s**.

**⚠️ E QUEM SAI DA TELA VIRA UM MARCADOR NA BORDA** (`▲ 64m` / `▼ 60m`) — o pedido autoriza com
todas as letras (*"não é necessário ficar os dois pokémons exibindo na tela, somente caso eles
realmente estejam próximos na metragem"*). Sem o marcador o adversário simplesmente sumiria, e o
jogador não saberia se está ganhando sem ler o placar — que é o que a pista existe pra contar
sozinha.

**QUANTO ISSO ACONTECE, medido em 12 corridas de cada tipo:**

| | duração | adversários NA TELA | maior diferença vista |
|---|---|---|---|
| individual 1x1 | 24 s | **84%** | 64 m |
| individual, 4 | 24 s | 86% | 65 m |
| revezamento 1x1 | 95 s | **26%** | 290 m |
| revezamento, 4 | 95 s | 23% | 308 m |

**⚠️ ESTA TABELA É DE 18/09, com o revezamento de TRÊS (900m).** Em 20/09 ele virou o time inteiro
(1.800m, ~249s) -- a conclusão fica IGUAL e o efeito cresce: com o dobro da prova, a dispersão cresce
junto e o adversário passa ainda menos tempo na tela.

**A individual passa quase toda na tela; o revezamento, um quarto.** É aritmética e não defeito:
a prova é 3× mais longa e a dispersão chega a **300 m**, ou seja seis telas de distância. Mostrar
os dois ali exigiria de volta a escala minúscula que causou o relato.
**Se um dia incomodar**, a régua é o `CORRIDA_PX_POR_M` — e a conta está aqui: cada px/m a menos
mostra ~6 m a mais de pista e deixa a corrida ~12% mais lenta na tela.

#### ⚠️ O NPC ERA RUIM PELO BICHO, NÃO PELA PILOTAGEM (18/09/2026)

Reportado: *"deixe o NPC melhor, ele está bem ruinzinho"*.

**⚠️ A PRIMEIRA MEDIÇÃO DESCARTOU A SUSPEITA ÓBVIA.** No **espelho** — Jolteon contra Jolteon, só
a pilotagem decidindo — o NPC ganha do jogador "bom" em **72%** das corridas. Ele pilota bem.

**O QUE ESTAVA ERRADO ERA O SORTEIO DA ESPÉCIE**, que era uniforme entre as 134 evoluções finais:

| | |
|---|---|
| finais que alcançam um Jolteon (Sp 135) | **4 de 134 (3%)** |
| finais com menos de 60% do Speed dele | **68 de 134 (51%)** |
| mediana do bestiário | Sp **80**, contra 135 do Jolteon |
| e isso nos 300 m | **2,5 s** de desvantagem antes de a corrida começar |

O jogador escolhe o **mais rápido do time dele**; o NPC recebia a mediana. Hoje ele é **pareado
pelo Speed** (`npcParaOSpeed`): medido, o Speed dele vai de **88% para 98%** do Speed do jogador.

- **⚠️ ISSO NÃO É O BOOST QUE O PEDIDO ORIGINAL PROÍBE** (*"não aumentar artificialmente a
  velocidade do NPC para acompanhar ou ultrapassar o jogador"*): ele continua correndo com o Speed
  **REAL** da espécie dele. O que mudou é a **escalação** — exatamente o que a Torre faz com o
  nível e a Montanha Sagrada faz com a média do time. Há trava cobrando que a velocidade dos dois
  seja idêntica com a mesma espécie.
- **⚠️ É "as N MAIS PRÓXIMAS" (14), e não uma janela de ±x%:** janela pode ficar **VAZIA** — um
  Shuckle de Speed 10 não tem vizinho a ±15% — e aí precisaria de um fallback que, por definição,
  só roda nos casos raros, ou seja o caminho menos testado do código. Por proximidade nunca falta.
- **⚠️ O ALVO SAI DA ESPÉCIE NO Lv.50, não do nível do jogador:** o `speedDaCorrida` multiplica
  pelo nível, então comparar um Lv.5 com a lista no Lv.50 daria **sempre os mais lentos**. O nível
  já é pareado à parte pelo `nivelDoNpc`.
- **⚠️ E O PAREAMENTO É POR TRECHO no revezamento**, não por equipe: senão o jogador guardaria o
  lento pro trecho em que o NPC fosse rápido, e o pareamento viraria uma conta que dá pra burlar.
- **O Shuckle (Sp 10) é o outlier que sobra**: o vizinho mais próximo dele tem Sp 35, ou seja
  **345%** do dele. É inevitável e é justo — quem escolhe o Shuckle escolheu um pokémon que não corre.

**⚠️ A PILOTAGEM NÃO FOI MEXIDA, e essa é a decisão medida desta seção.** Com o Speed pareado, o
perfil de hoje (20/52/14, e 14% de não tentar) já entrega **perfeito 100% / humano 51% / bom 40%**.
Subir um degrau derruba o jogador "bom" no chão:

| perfil do NPC | jogador perfeito | humano | bom |
|---|---|---|---|
| **hoje 20/52/14** | 100% | **51%** | **40%** |
| 25/57/13 | 100% | 46% | **11%** |
| 30/55/10 | 100% | 31% | 4% |
| 45/48/05 | 100% | 8% | 0% |

**O pareamento já fez o trabalho — mexer nos dois deixaria o NPC forte demais**, e a tentação era
justamente mexer nos dois. Há trava fixando o perfil, pra a próxima mudança ali ser deliberada.

#### A FAIXA VERDE CAIU PELA METADE (18/09/2026)

Pedido: *"diminua os quadrados verdes de bom em 50%"*. De **30,4% para 15,2%**, com o `ini` andando
junto (0,348 → **0,424**) pra ela continuar **CENTRADA** — só encolher o `tam` deslocaria a faixa
pra a esquerda do centro. É a mesma correção que a amarela precisou horas antes.

| | janela na barra | janela em TEMPO |
|---|---|---|
| verde, antes | 30,4% | **438 ms** |
| **verde, hoje** | **15,2%** | **219 ms** |
| amarela (não mudou) | 4,8% | 69 ms |

A faixa em que se **erra** foi de 69,6% para **84,8%** da barra.

- **⚠️ O EPSILON CONTINUA SENDO NECESSÁRIO, e agora nas DUAS faixas:** `Math.abs(0.424 - 0.5)` dá
  **0,07600000000000001** contra uma meia-faixa de 0,076, e a amarela tem o mesmo problema. Os
  números do exemplo no código mudaram; o problema não.
- **As faixas do CSS saem da TABELA** (inline), então o desenho acompanhou sozinho.

#### ⚠️ O EFEITO COMBINADO É MUITO MAIOR QUE A SOMA — e a faixa é a régua, não o NPC

Os dois pedidos do mesmo dia **puxam pro mesmo lado**, e medi-los juntos foi o que mostrou o
tamanho disso. O jogador aqui é modelado pela **MIRA** (ele aponta pro centro com um desvio
típico) e não por "acerta bom X% das vezes" — senão o A/B pressuporia o resultado da mudança de
faixa em vez de medi-lo. 320 corridas por célula, oito espécies:

| mira do jogador | antes | só a FAIXA | só o NPC | **os DOIS** |
|---|---|---|---|---|
| ±5% (muito boa) | 93% | — | — | **98%** |
| ±10% | 78% | 60% | 81% | **46%** |
| ±15% | 72% | **29%** | 73% | **8%** |
| ±25% | 37% | 12% | 7% | **0%** |

**⚠️ A FAIXA É A RÉGUA DOMINANTE, e isso é contra-intuitivo:** o **NPC pareado sozinho quase não
move** quem tem mira boa (72% → 73% a ±15%) — ele só morde quem já jogava mal (37% → 7% a ±25%).
Quem derruba o jogador mediano é a **faixa**: com ela grande, o jogador acertava "bom" quase
sempre e o ×1,25 compensava qualquer adversário; pela metade ele passa a errar (×0,80), e aí o
adversário pareado cobra.

**Se ficar duro demais, o lugar de mexer é a VERDE** (`CORRIDA_FAIXA.verde`, lembrando de mover o
`ini` junto), e não o NPC — devolver a faixa a 30,4% com o NPC pareado leva a mira ±15% de 8% de
volta a **73%**. A segunda régua é o `CORRIDA_NPC_VIZINHOS`: mais vizinhos = pareamento mais frouxo.

#### ⚠️ A LINHA DE CHEGADA FICA NA METADE DE CIMA (18/09/2026)

Pedido: *"coloque para a linha de chegada ficar acima da metade do quadrado da tela que exibe a
corrida, hoje ela está ficando bem abaixo"*. E estava: com a câmera seguindo o jogador até o fim,
a linha **descia** de 0 até `CORRIDA_Y_EU` (300 de 390) e ele a cruzava lá embaixo, com 300px de
nada acima.

**A CÂMERA TRAVA NA RETA FINAL.** Nos últimos **25,5 m** ela para, a linha fica parada em
`CORRIDA_Y_CHEGADA` (**96 de 390 — 25% da altura**) e é o **JOGADOR que sobe** em direção a ela.
É o que um jogo de corrida faz na reta final: a câmera abre e você vê a linha se aproximar.

- **⚠️ O TAMANHO DA RETA FINAL NÃO É UM NÚMERO ESCOLHIDO** — ele **cai das duas alturas**
  (`(CORRIDA_Y_EU − CORRIDA_Y_CHEGADA) / CORRIDA_PX_POR_M`). Escrito à mão, ele divergiria no
  primeiro ajuste de altura e a linha pararia num lugar que não é o declarado.
- **Medido: ela fica na metade de cima 100% do tempo em que aparece**, varrendo a prova inteira de
  meio em meio metro — e ela aparece por ~3,2 s.
- **Ao cruzar, o jogador para EM CIMA da linha** (os dois em y=96), o que é exatamente o certo.
- **No revezamento a trava é só na CHEGADA**, nunca nas trocas dos múltiplos de 300 — a marca da
  troca continua rolando com a câmera.

**⚠️ E O FIXTURE DAS TRAVAS DA PISTA TEVE QUE SAIR DA RETA FINAL.** Ele usava `dist = 300` e
`400` num total de **300** — ou seja, sempre **dentro** da faixa travada, onde a câmera não segue
o jogador de propósito. Três travas passaram a acusar o que estava certo. É a mesma família dos
fixtures que este arquivo já registra (o painel forte demais, o `preservePlayerHp` que cura o time
B): **o cenário tem que cair na faixa em que a regra medida vale**.

#### O PÓDIO GANHOU MEDALHAS DESENHADAS (18/09/2026)

Pedido: *"aumente as fontes do resultado final, pode colocar o 1, 2, 3 e 4 lugar bem grandes junto
com os nomes, e coloque uma imagem de medalha de ouro, prata e bronze (crie, não use emoji
prontos)"*.

**⚠️ AS TRÊS MEDALHAS SÃO A MESMA SILHUETA EM TRÊS METAIS**, e isso é decisão: o que as agrupa
como "medalha" é a FORMA (a fita em V mais o disco com a estrela), e o que as separa é a COR.
Desenhos diferentes fariam procurar três coisas onde há uma escada. Há trava comparando a
silhueta das três e cobrando que as cores sejam diferentes.

Elas saem do **mesmo `gerar-selos.js`** de todo o resto, então herdam o contorno de 2px, o
sombreado direcional e o `<symbol>` do SVG único. E duas coisas foram aprendidas desenhando:

- **⚠️ A FITA PRECISOU DE 6px POR TIRA.** Com 4px o contorno comia 2 de cada lado e sobravam 2 de
  cor: as duas tiras liam como **dois riscos pretos**. É a regra que este arquivo já registra —
  *num selo pequeno, detalhe menor que ~3px da grade não é detalhe, é sujeira*.
- **⚠️ A ESTRELA É PRETA, e não no tom escuro do metal.** A primeira versão tinha uma borda
  interna de relevo JUNTO com a estrela, as duas no tom escuro — e elas viravam uma mancha. Tirada
  a borda, a estrela no tom escuro **ainda sumia**: o escuro do ouro (`#c98b16`) contra o médio
  (`#f2c744`) tem pouco contraste. Comparados preto e branco no ASCII, só o **preto** lê nos três
  metais — o branco some na prata. Ele é a cor do próprio contorno, então a estrela sai como um
  relevo fundo, que é o que uma medalha tem.
- **NÃO HÁ NÚMERO DENTRO DO DISCO**: num disco de ~15px o dígito sobra com 7px e o contorno come
  metade. Quem diz a colocação é o "1º" gigante ao lado — a medalha é o reforço, não a informação.

**⚠️ E O TROFÉU DO TÍTULO VIROU DESENHO JUNTO** — ele era o último emoji desta tela, e o pedido
proíbe emoji pronto. Há trava cobrando que nenhum emoji de medalha ou troféu sobre no HTML.

**A LINHA VIROU UMA GRADE DE QUATRO COLUNAS**, e não um flex livre: com flex, a largura da medalha
e a do número mudam de linha pra linha e os **NOMES deixam de alinhar** — que é justamente onde o
olho compara. Medido no Chrome a 320px:

| | antes | **hoje** |
|---|---|---|
| a colocação ("1º") | ~13px | **24px** |
| o nome do pokémon | ~13px | **16px** |
| o tempo | ~13px | 16,8px |
| a medalha | — | **30px** |
| altura da linha | ~30px | 48px |
| nomes cortados | — | **nenhum** |
| rolagem lateral | não | **não** |

- **DA QUARTA COLOCAÇÃO EM DIANTE NÃO HÁ MEDALHA, e a célula fica VAZIA** em vez de sumir: sem o
  vazão, o "4º" encostaria no nome e as linhas deixariam de alinhar em coluna.
- **A linha do jogador é destacada** — ela é a que ele procura primeiro. O realce sai do
  `--yellow` da casa com alpha, e **não de uma variável inventada**: a primeira versão usava
  `var(--yellow-soft, ...)`, que não existe na paleta — a mesma classe do `--cream` fantasma que
  já deixou uma aba transparente e ilegível.
- **⚠️ E A TRAVA DE LETRA MORTA DOS SELOS PRECISOU APRENDER A TABELA.** Ela procurava
  `selo('nome')` literal e **acusou as três medalhas**, que estão em uso — elas são escolhidas
  por `MEDALHA_DO_POSTO[pos]`, como o `icone` dos itens já fazia. Hoje ela aceita o nome citado
  como VALOR, cortando antes o próprio bloco `DESENHOS` — sem o corte, todo selo contaria a si
  mesmo pela chave da tabela e a trava daria verde pra qualquer coisa.

#### ⚠️ O REVEZAMENTO PASSOU A TER A EQUIPE INTEIRA NA PISTA (18/09/2026)

Reportado: *"quando acontecer o revezamento, hoje quando chega na liga de revezar, só está
trocando a sprite, deixe fazendo mais sentido, coloque o pokémon que é o próximo, esperando na
linha de troca, e quando o outro pokémon chegar, o outro fica parado e continua com o próximo"*.

E era isso mesmo: a troca era `c.trecho++` e o sprite mudava de um quadro pro outro. **Não havia
entrega de bastão nenhuma na tela.**

**A METRAGEM DE CADA MEMBRO CAI DA REGRA DO REVEZAMENTO, sem estado novo:**

| quem | onde | |
|---|---|---|
| já correu (`k < trecho`) | `(k + 1) × CORRIDA_METROS` | parou na marca em que **entregou** |
| corre (`k === trecho`) | `c.dist` | |
| espera (`k > trecho`) | `k × CORRIDA_METROS` | parado na marca em que **recebe** |

**⚠️ E É DERIVADO, nunca gravado:** gravado, ele só conseguiria ficar velho — e a posição de
quem espera é uma **constante da prova**, não um estado.

- **⚠️ OS PARADOS SÃO DESLOCADOS NA RAIA, e no instante da troca isso é obrigatório:** ali quem
  entrega e quem recebe estão na **MESMA metragem**, então sem o desvio eles desenhariam um em
  cima do outro. Quem já correu vai pra um lado, quem espera pro outro.
- **⚠️ ELES SÃO DESENHADOS FORA DA GUARDA DO MARCADOR DE BORDA**, e isso não é detalhe: eles têm
  metragem PRÓPRIA, então um deles pode estar na tela com o corredor fora dela (e vice-versa).
  Amarrados à mesma guarda, o pokémon que espera na marca sumiria justamente quando o corredor
  está longe dela — que é quase sempre.
- **QUEM ESTÁ PARADO CONGELA NO QUADRO 0**: usando o `quadroT` do corredor, os três membros
  animariam em **sincronia** e quem espera pareceria correr no lugar.
- **E SAI EM 72% de opacidade** — não é o `.caiu` do resto do jogo (35%): aqui ele precisa
  continuar **reconhecível**, porque o jogador quer ver QUAL pokémon está esperando.
- **A seta, o nome e o "TROCA!" são só de quem CORRE**: três "VOCÊ" empilhados na mesma raia só
  confundem — quem está parado é cenário.
- **⚠️ QUEM ENTREGOU SÓ FICA VISÍVEL POR ~11 m**, que é toda a visão pra trás da câmera (ela vê 38
  m pra frente). É o certo — ele ficou pra trás —, e foi a trava que apontou isso: o fixture com
  `dist = 620` põe a marca dos 600 em y=460, **fora da tela de 390**.

**⚠️ A TRAVA PRECISOU LER O DESENHO REAL, e a primeira versão não lia.** Ela conferia uma conta
`onde(trecho, dist, k)` escrita **dentro do próprio teste** — ou seja, uma CÓPIA da regra: ela
daria verde mesmo se o jogo parasse de desenhar a equipe. Hoje o canvas é um dublê que anota cada
`drawImage`, e o `pmdCache` recebe folhas falsas pra o desenho sair pelo caminho REAL — sem
sprite ele cai no marcador neutro, que é outro ramo. É a mesma lição das travas que "mediam a
duração em vez da regra".

**CONFERIDO:** as duas impressões (MOTOR e DIARIO) continuam idênticas — nada disto é motor.

#### NO FIM, SÓ A CLASSIFICAÇÃO

Pedido com print: *"pode sumir com esses 3 primeiros quadros ao fim da corrida e deixar somente o
quadro escrito 2 lugar com os tempos"*.

**⚠️ E ELES NÃO ESTAVAM SÓ SOBRANDO — estavam mostrando DADO ERRADO.** No print, o placar mostrava
`0 / 300 m` e o canvas estava **em branco**: quem os mantinha vivos era o pintor do laço, que já
tinha parado. Sumir com eles conserta as duas coisas de uma vez.

A fonte da classificação subiu de **.66 pra .82rem** (a caixa deixou de dividir espaço com a pista,
então pode ser lida de longe), e o tempo ganhou `tabular-nums` — sem isso os dígitos têm larguras
diferentes e a coluna da direita dança de linha pra linha, que é justamente onde o olho compara.

#### QUEM NÃO TENTA PERDE VELOCIDADE

Pedido: a cada **3 travessias sem uma tentativa**, −5% de velocidade.

- **Ele é diferente de todo o resto:** não tem duração (vale até o fim da prova), **ACUMULA** (seis
  travessias paradas são dois cortes) e **multiplica por fora** do impulso — um perfeito ainda
  ajuda quem está desleixado, só que sobre uma base menor. Somar os dois faria um perfeito "curar"
  a inatividade, e o pedido é o contrário.
- **Tentar zera o contador, mesmo ERRANDO:** o que se pune é não tentar, e o erro já tem a
  penalidade dele.
- **Tem piso** (`CORRIDA_DESLEIXO_MIN`): sem ele, ficar parado pararia o pokémon e a corrida não
  terminaria nunca.
- **⚠️ O NPC TAMBÉM PERDE**, e isso é simetria: a "oportunidade não usada" dele (o resto das
  probabilidades do `CORRIDA_NPC`) **É** não tentar. Sem isso a penalidade valeria só pro jogador.

**⚠️ E ELE OBRIGOU A FÍSICA A SER FATIADA NAS VIRADAS DE TRAVESSIA.** O corte muda a velocidade no
meio do quadro — exatamente como a troca de trecho muda —, e mudança de velocidade no meio de um
quadro **tem que ser fatiada**, senão o resultado passa a depender da taxa de quadros. A trava
pegou: sem fatiar, a mesma corrida dava **25,999 s a 1/60 e 26,027 s a 1/5**.

**⚠️ E A PRIMEIRA VERSÃO DO FATIAMENTO TRAVOU O JOGO.** Ela procurava "a próxima virada" dentro de
um `while`, e quando o tempo caía um ulp antes de uma (`1.4399999999999999`) o `Math.floor`
devolvia a virada **anterior**: o passo saía em ~1e-16, o tempo não avançava e o laço rodava até o
teto de voltas — **em todo quadro**. Hoje as viradas são calculadas **de uma vez**, a partir do
intervalo, então o número de fatias é conhecido antes de começar e não existe laço que não termina.

#### AS FAIXAS TAMBÉM SE MOVEM

Pedido: as faixas verde e amarela passeiam, **em velocidade diferente da agulha** (*"para não
ficarem juntas"*), e **quanto maior o nível, mais devagar**.

O centro delas oscila num **SENO**; a agulha é um **TRIÂNGULO** — formas diferentes, além de
períodos diferentes. É a primeira coisa no jogo em que o nível dá uma vantagem que não é atributo.

**⚠️ E A PRIMEIRA VERSÃO SINCRONIZAVA EM OITO NÍVEIS, com o comentário afirmando o contrário.** Eu
dei o período em SEGUNDOS (3,7 → 9,3 s) e escrevi que a faixa evitava os múltiplos de 1,44 — **era
falso**, e a trava listou os níveis: 12, 37, 38, 62, 87 e 88 caíam em cima de 4,32 s, 5,76 s e
8,64 s. Com razão inteira, a configuração barra+faixa **se repete exatamente** a cada N travessias
e o jogador decora o padrão.

**A razão do erro vale guardar: qualquer faixa CONTÍNUA que varie mais de 1 unidade de razão cruza
um inteiro**, não importa onde comece. Hoje o período é uma **razão da travessia** num intervalo
que não contém inteiro — **2,15× a 2,90×**, ou seja 3,10 s no Lv.1 e 4,18 s no Lv.99. O preço é a
variação ser menor (35%): é o máximo possível sem cruzar o inteiro.

**⚠️ E DUAS MEDIDAS MUDARAM NO MESMO DIA, a pedido:** a faixa **amarela caiu pela metade** (9,6% →
**4,8%**, com o `ini` andando junto pra ela continuar CENTRADA — só encolher o `tam` deslocaria o
perfeito pra a esquerda), e as faixas ficaram **mais rápidas**: a razão desceu de 2,15–2,90 pra
**1,15–1,90**, ou seja o período foi de 3,10–4,18 s pra **1,66 s no Lv.1 e 2,74 s no Lv.99**.
Com isso a faixa passou a ser **mais rápida que o ciclo da agulha** (2,88 s), o que antes não era.
O intervalo novo continua entre os inteiros 1 e 2, então a regra de não sincronizar segue valendo.

**⚠️ E TRÊS TRAVAS ENVELHECERAM JUNTO:** elas tinham 0,452 e 0,548 escritos à mão, e passaram a
acusar o que estava certo. Hoje as bordas saem da TABELA — a mesma lição do "59 espécies" da ficha
da Pokédex, que também era um número fixo descrevendo uma tabela que cresceu.

**As faixas são movidas pelo DOM**, como a agulha, e **pela MESMA função que a detecção usa** —
desenhadas por uma conta própria, a barra prometeria uma região e o motor pontuaria outra.

#### A LISTA É PAGINADA

Pedido: *"igual nas outras listas que já existem dessa maneira, como na torre de treinadores e
ginásio da cidade"*. Ela reusa o **`MONT_POR_PAGINA`**, o **`montadorPaginaValida`** e o mesmo
estado `game.montadorPagina` — uma paginação própria divergiria na primeira mexida.

⚠️ O que **não** deu pra reusar é o `montadorDeTimeHtml` inteiro: ele ordena por nível/nome/time e
aqui a ordem é pelo **Speed da corrida**. As peças de paginação são as mesmas; a lista é outra.
⚠️ E **abrir o picker zera a página**, como o `abrirMontador` faz: o estado é compartilhado com a
Torre e o Ginásio, e uma página 3 sobrando de lá abriria esta lista no meio.

### AS SETE DA CORRIDA (20/09/2026) -- a leva do revezamento na tela

Sete pedidos numa leva, com print de um revezamento em curso. Dois eram defeito de verdade, um é
balanceamento medido, e os outros quatro são tela.

#### ⚠️ OS QUADRADOS AMARELOS NÃO SEGUIAM O CORREDOR

Reportado: *"aqueles quadrados amarelos deveriam trocar conforme troca o pokemon que esta correndo,
porem nao esta, ele sempre fica amarelo no primeiro"*.

**⚠️ É A MESMA FAMÍLIA DO MODAL DA CONTAGEM, que já tinha sido reportado e consertado em 18/09:**
os chips eram montados **por condição no `render()`**, e o laço do jogo **não chama `render()`** —
de propósito, porque ele recriaria o canvas e o botão de impulso 60 vezes por segundo. A classe
`ativo` ficava congelada no primeiro chip a prova inteira.

- **HOJE O PINTOR TROCA A CLASSE**, e **a conta vive numa função só** (`corridaClasseDoTrecho`),
  lida pelo render (que dá o valor inicial) e pelo pintor (que a move). Escritas em separado, as
  duas divergiriam no primeiro ajuste — e o sintoma seria o chip certo no primeiro desenho e o
  errado dali em diante.
- **E SÓ QUANDO A CLASSE MUDA**: um `className = x` cego forçaria recálculo de estilo em 6
  elementos por quadro, 60 vezes por segundo. É a mesma guarda de igualdade que o texto do HUD usa.

#### ⚠️ E O QUE CABE NUM CHIP DE 37px NÃO É TEXTO — duas medições até acertar

Reportado junto: *"o nome dos pokemons esta cortando, como exibiu quebrado ali o Victreebel"*.

**A conta é dura: a 320px são SEIS chips em 243px de fileira — 37px cada, 33 de conteúdo.**

| o que eu pus | o que a medição disse |
|---|---|
| o **nome** (como era) | "Victreebel" não cabe em fonte nenhuma legível — era o print |
| a **faixa de metros** ("150–300") | **CORTADA em 5 dos 6** chips |
| **o sprite + a posição ("1º")** | **zero cortados**, chip de 37×43px |

**⚠️ A SEGUNDA TENTATIVA PASSOU NO TESTE E FALHOU NO NAVEGADOR**, e é a lição: a trava cobrava
`html.indexOf('>0–150<') >= 0` — **o texto estava lá, e estava cortado**. Texto que não cabe passa
em qualquer asserção de HTML.

- **O SPRITE IDENTIFICA MELHOR QUE UM NOME TRUNCADO**, e o `1º` é o que a tela **já fala em todo
  lugar** (o HUD diz "trecho 3/6", a lista de ordem diz "1º").
- **O nome E a faixa inteira ficam no `title`** — nada se perdeu, mudou de lugar.
- **⚠️ E O CSS DO SPRITE PRECISA DE TRÊS SELETORES** (`.corrida-trecho .corrida-trecho-spr
  .sprite-img`): com dois, a regra `.sprite-sm .sprite-img` da casa — declarada **depois** no
  arquivo — ganharia o empate de especificidade e o sprite não encolheria. É a mesma armadilha que
  a lista da rota já custou.

#### ⚠️ A CLASSIFICAÇÃO ERA DE POKÉMON, E TINHA QUE SER DE TREINADORES

Pedido: *"no final que aparece a colocação de cada treinador, esta aparecendo o nome do pokemon,
tem que aparecer o nome do treinador e qual era o time do revezamento, ou se a corrida era
individual, entao mostrar o nome do treinador e embaixo o pokemon que ele correu"*.

Ela mostrava o `nomeDoCorredor`, que é **o bicho que estava correndo NA HORA DA CHEGADA** — num
revezamento isso é um dos seis, escolhido por acaso, e não diz de quem era a equipe.

| | em cima | embaixo |
|---|---|---|
| **revezamento** | o treinador | ~~o nome do time~~ |
| **individual** | o treinador | ~~o pokémon~~ |

**⚠️ A COLUNA DA DIREITA DUROU ALGUMAS HORAS: o rótulo de TEXTO virou a FILEIRA DE SPRITES no
mesmo dia** -- ver **AS QUATRO DA CORRIDA**, logo abaixo. O que continua valendo desta seção é a
coluna da ESQUERDA (o treinador em cima) e a medida do "Rival N".

- **O nome sai do `nomeDoTreinador()`**, o mesmo que a Pescaria usa — e quem não nomeou a conta cai
  no "Você" da casa.
- **⚠️ O ADVERSÁRIO É "Rival N", E ISSO FOI MEDIDO:** a 320px a coluna do nome tem **83px**, e
  "Adversário 1" **quebrava em duas linhas** — a linha ia de 48 pra 63px e as linhas deixavam de
  alinhar em coluna, que é justamente onde o olho compara. Com "Rival N" as quatro ficam em 48px.
  Pelo mesmo motivo "Equipe rival · 6 pokémon" virou "Equipe rival" — e ele ainda dizia uma coisa
  que TODO revezamento tem. (⚠️ Os dois são HISTÓRIA: o rótulo inteiro saiu horas depois.)
- **A linha do JOGADOR ainda pode ir a duas linhas**, e é aceito: ali o que quebra é o **nome do
  save**, que é dele.

#### O "Speed 98" SAIU, E A VELOCIDADE TOTAL ENTROU

São o mesmo pedido visto dos dois lados: *"na lista para eu escolher a ordem da equipe tem um
escrito 'speed 98' em azul que nao ta legal, pode tirar"* e *"coloque a velocidade total do time na
tela onde escolhe o time"*.

**⚠️ O NÚMERO NÃO SUMIU — ELE MUDOU DE TELA, e a tela nova é onde ele decide.** Na lista de ORDEM
ele é ruído: ali a decisão é a sequência, e o Speed de cada um não muda o que ela pede. Na tela de
escolha do TIME ele é a decisão inteira — medido nos dois times de teste, **699 contra 282**.

- **A SOMA É A DOS SEIS `speedDaCorrida`**, e não "nível + Speed base": aquele é o **MESMO número**
  que decide a velocidade na pista, com o nível, o shiny e a especialidade já dentro. Somar à mão
  seria uma segunda conta, e ela divergiria da pista no primeiro ajuste.
- **⚠️ E O SLOT É CARIMBADO**, senão o `effectiveSpeed` não acha a especialidade da conta e o número
  do card sairia **menor** que o da pista pra quem é especialista.
- **O RODAPÉ É UM PARÂMETRO OPCIONAL do `pescariaCardDoTime`**, e a Pescaria não o passa: um card
  próprio pra a Corrida seria a terceira cópia do mesmo desenho — é por ele ser o MESMO card da
  Liga, da home e da Pescaria que o jogador reconhece um time sem reaprender a ler.
- **O "Sair" saiu da tela de escolha** (ela já termina com um "Voltar"), e **continua nas outras** —
  é de lá que se sai do modo.
- **Medido a 320px:** o rodapé cabe em **UMA linha** (18px), os dois cards ficam em **134px** e a
  tela não rola pro lado.

#### ⚠️ O SHINY NA PISTA: O CACHE ERA POR ESPÉCIE

Reportado: *"quando o time possui um pokemon shiny, a sprite dele na corrida tbm deve exibir shiny,
esta aparecendo a normal"*.

**⚠️ A PASTA DO SHINY FOI CONFERIDA ANTES DE VIRAR CÓDIGO, e ela não é a óbvia:**

| caminho | o que é |
|---|---|
| `sprite/<dex>/0001/` | uma **FORMA alternativa** (a Mega) — usar ela desenharia **outro pokémon** |
| **`sprite/<dex>/0000/0001/`** | **o shiny** — mesmo `AnimData`, mesmas dimensões, outra paleta |

**Medido no navegador, em quatro espécies:** as dimensões são **IDÊNTICAS** (Gyarados 352×1024 nas
duas, Jolteon 128×320, Snorlax 128×384, Alakazam 128×320) — ou seja as caixas, as durações e o
`pmdQuadro` continuam valendo sem tocar em nada — e **47% a 75% dos pixels da silhueta diferem**,
que é o que prova que é outra paleta e não a mesma folha.
**Cobertura: 250/250 espécies têm sprite shiny.**

- **⚠️ A CHAVE DO CACHE PASSOU A LEVAR O SHINY** (`pmdChave`), e sem isso um Gyarados shiny e um
  normal na mesma corrida seriam a **MESMA entrada**: quem carregasse depois ficaria com a cor do
  outro. A chave do normal continua sendo o próprio id, então o cache velho continua valendo.
- **Quem lê é o `pmdDados(instância)`** — os leitores perguntam por ele e não montam a chave na mão.
- **⚠️ O PRELOAD JUNTA POR VARIANTE, não por espécie:** por espécie, um shiny e um normal do mesmo
  bicho dariam UMA folha e um dos dois sairia com a cor errada.
- **⚠️ E O SHINY QUE FALTA CAI NO NORMAL** — a única exceção à regra de "sem sprite não se larga".
  A razão é que aqui a **cor é apresentação** e a **espécie é identidade**: barrar a largada porque
  a variante colorida não baixou seria trocar um pokémon shiny por corrida nenhuma. Substituir por
  **OUTRA espécie** continua proibido, e é isso que o pedido de 18/09 protege.
- **O RESGATE ENTROU JUNTO** — ele lê o mesmo cache, e deixá-lo de fora seria a exceção onde a
  próxima omissão se esconde.

#### ⚠️ O NPC SUBIU UM DEGRAU — e a medição diz o que ele NÃO alcança

Pedido: *"deixe o NPC um pouco melhor"*. O `perfect` foi de **0,20 pra 0,24**.

**⚠️ E A PRIMEIRA COISA MEDIDA FOI O BOT DE MEDIÇÃO, porque ele estava errado DUAS vezes:**

| o bot | o que ele dava |
|---|---|
| comparava a agulha com um limiar fixo | **nunca tocava** — os 4 perfis davam o MESMO tempo, o de quem não impulsiona |
| mirava o centro do **início** da travessia | 2 perfeitos em 23 s — e o print do jogador mostra **18** |

**A causa da segunda é a mecânica: o centro das faixas SE MOVE** (um seno de amplitude 0,17), então
quando a agulha chegava onde ele mirou a faixa já tinha andado. O bot de hoje faz o que um jogador
faz: **olha onde a faixa está AGORA** e toca quando a agulha passa por ela, com a precisão do perfil.

**A TABELA (60 corridas por célula, o jogador modelado pela MIRA — o erro típico dele em fração da
barra):**

| individual | hoje(20) | **24** | 28 | 32 |
|---|---|---|---|---|
| domina (erro ≤2%) | 98% | **100%** | 100% | 100% |
| joga bem (5%) | 97% | **88%** | 78% | 72% |
| mediano (10%) | 37% | **12%** | 10% | 7% |
| *(o tempo do NPC)* | *20,0s* | *19,7s* | *19,4s* | *19,2s* |

| revezamento | hoje(20) | **24** | 28 | 32 |
|---|---|---|---|---|
| domina | 100% | 100% | 100% | 100% |
| joga bem | 80% | **57%** | 47% | 42% |
| mediano | 2% | 0% | 0% | 0% |

**⚠️ CONTRA QUEM DOMINA O JOGO ELE NÃO ALCANÇA EM CONFIGURAÇÃO NENHUMA — 100% nas quatro.** A
pilotagem perfeita já é o teto, e o eixo do **Speed já está pareado** desde 18/09
(`npcParaOSpeed`). O que subir a régua faz é **afundar o MEDIANO**, então 0,24 é o degrau que dá
pra dar: ele tira o jogador bom de 97% pra 88% na individual e de 80% pra 57% no revezamento.

**⚠️ A RÉGUA QUE ALCANÇARIA O "DOMINA" É O NÍVEL DO NPC (`nivelDoNpc`), E ELA ESTÁ FORA:** inflar a
velocidade dele é o que o pedido de 18/09 proíbe com todas as letras. Se um dia for pra valer, é
ali — e a conta está aqui.

**NA DIFICULDADE DO JOGO, NADA:** as duas impressões continuam **idênticas**
(`MOTOR 25d909ef2d79 / DIARIO c35ba4008568`) em 900 batalhas semeadas. Tudo isto é apresentação
mais uma constante de minijogo.

`tools/test-corrida.js` foi a **365 travas**, e **os nove defeitos religados acusam** (1 a 4 falhas
cada). Duas lições de teste saíram daqui:

1. **⚠️ UMA TRAVA MEDIA O LUGAR ERRADO:** ela procurava `pmdChave(p.speciesId, p.shiny)` **solto no
   arquivo**, e isso **casa com o `pmdDados`** — ou seja ela dava verde com o preload voltando a
   juntar por espécie. Foi a **conferência de acusação** que a pegou: o defeito religado passava em
   branco. Hoje ela lê o bloco do preload, com um `ok()` cobrando que a fatia tem o que ler.
2. **⚠️ E OUTRA MEDIA A ORDEM DO FIXTURE:** ela procurava `title="Jolteon · 150–300 m"`, e o Jolteon
   é o **primeiro** no time de teste. Hoje ela não amarra no nome.

### AS QUATRO DA CORRIDA (20/09/2026) -- a leva do ranking

Quatro pedidos na mesma leva. Dois são tela, um cria dado novo no servidor, e um é um defeito de
verdade -- com uma causa que já tinha mordido este modo duas vezes.

#### OS SPRITES DO TIME, E NÃO O NOME DELE

Pedido: *"na tela de resultados, nao exiba o nome do treinador e embaixo o nome do time, coloque
embaixo as sprites dos 6 pokemons que era do time"*.

O rótulo de texto durou **algumas horas** (ele tinha nascido nesta mesma data). A diferença é a
pergunta: o nome respondia **de QUEM era a equipe** e os sprites respondem **QUAL era** -- que é a
que se faz olhando uma classificação.

- **VALE PROS DOIS FORMATOS, sem exceção nenhuma:** 6 sprites no revezamento, 1 na individual.
- **O `corridaComQuemCorreu` VIROU LETRA MORTA e saiu** -- ele tinha um chamador só.
- **⚠️ E A FILEIRA É A DO CARD DE TIME DE VERDADE** (`save-slot-team-row spread`), não uma parecida.
  Isso não é só coerência: aquela classe é uma **GRADE de 6 colunas** com `min-width:0` nos filhos,
  e é ela que faz seis sprites caberem em 243px. Com um `flex-wrap` próprio, medido a 320px, cada
  sprite saía em **48px** e a fileira quebrava em **DUAS linhas** -- a linha de resultado ia a
  **180px**. Com a classe da casa ela fica em **124px**.
  ⚠️ Os sprites saem **cortados** pelo `overflow:hidden` (célula de 36px, sprite de 48px) -- e isso
  é o comportamento de SEMPRE do card: medido, o card do picker corta os seis do mesmo jeito. A
  margem transparente do sprite absorve, e é por isso que ninguém nota.
- **A `.resultTime` só POSICIONA** (`grid-column:1/-1`): na coluna do nome, que tem 83px a 320px,
  seis sprites dariam 13px cada.

#### O RANKING PERDEU A LEGENDA E GANHOU UM MODAL

Pedido: *"no ranking dos melhores tempos, nao exibir tambem o nome do time, apenas o nome do
treinador e quando clicar em cima do nome, abrir um modal exibindo o time que o treinador usou para
fazer aquele tempo"*.

Na linha do ranking se compara **TREINADOR** e **TEMPO** -- a legenda era ruído numa coluna que já
trunca. Quem responde *"com o que ele correu?"* é o modal, e ele só abre pra quem quer saber.

- **⚠️ O TIME VIAJA NO ENVIO, e é por isso que ele é o time DAQUELE TEMPO** -- não o time de hoje
  daquele jogador. Buscar na hora daria a resposta errada pra todo recorde antigo.
- **⚠️ E O SERVIDOR SANEIA O QUE CHEGA.** Ele é só apresentação (não dá vantagem nenhuma), mas o
  documento é **PÚBLICO** -- todo mundo lê o ranking --, então sem teto ele seria um jeito de gravar
  lixo grande lá dentro. Fica o mínimo pra desenhar um sprite: **espécie (40 chars), nível (1–999) e
  shiny**, no máximo **6** (`CORRIDA_RANK_TIME_MAX`).
- **⚠️ E UM TIME MALFORMADO NÃO JOGA FORA O TEMPO:** ele vira lista vazia e o recorde é gravado do
  mesmo jeito. O ranking é sobre o TEMPO -- perder um recorde por causa da legenda seria o lado
  errado pra errar.
- **O `shiny` ausente vira `false`, nunca `undefined`** -- o Firestore **recusa a gravação inteira**
  com `undefined`, e foi isso que matou as duas ligas em 13/09.
- **⚠️ SÓ QUEM TEM TIME GRAVADO VIRA BOTÃO:** recorde anterior a esta data não tem o campo, e um
  botão que abre um modal vazio é pior que botão nenhum. **Quem recusa é a AÇÃO**, não a tela.
- **A affordance é o `ⓘ` da ficha da Pokédex**, e o botão **não usa o `.btn` da casa**: aquele é
  botão de AÇÃO, com moldura de 3px, e aqui a linha é informação que por acaso se toca -- o mesmo
  raciocínio que já tirou o `.btn` das linhas da ficha, dos cartões de golpe e das prateleiras.
- **⚠️ O ESTADO GUARDA ONDE ACHAR (lista/meu + índice), nunca uma cópia da linha:** a lista é relida
  e uma cópia ficaria velha em silêncio.
- **O modal é anexado ao RENDER PRINCIPAL**, como a caixa do especial: ele é aberto de DENTRO da
  tela da corrida, e os modais empilham na ordem em que entram.
- **Medido a 320px:** modal de **280×239px** (cabe numa tela de 568 sem rolar), com a mesma fileira
  de sprites do card.

#### A LARGADA VAI PRO TOPO

Pedido: *"ao começar a corrida, consegue levar a pagina para o topo? Porque dependendo de como tava
a barra de rolagem, as vezes o quadro da corrida começa pela metade porque herdou a posição
anterior"*.

**⚠️ E O "HERDOU" É LITERAL: a largada NÃO troca de `game.screen`**, então o `render()` trata isso
como a MESMA tela e **repõe a rolagem anterior** (é o `mesmaTela` do `reporRolagens`, que existe
desde 18/09 pra a lista da loja não voltar ao topo). Quem estava embaixo na lista de ordem via a
pista começar pela metade.

**⚠️ O `window.scrollTo(0, 0)` VEM DEPOIS DO `render()`, e a ordem é a regra:** antes dele, o
próprio render desfaria. Há trava sobre a posição, não só sobre a presença.

#### ⚠️ O QUADRO VAZIO NA TELA DE ESCOLHA -- a terceira vez da mesma causa

Reportado: *"quando eu clico para jogar a corrida de novo, na tela em que eu seleciono o time, esta
exibindo um quadrado vazio embaixo que seria o quadro da corrida"*.

**A causa é o placar e a pista serem montados por `corrida.corredores.length`** -- e os corredores
são montados **ANTES** de a fase virar `carregando`, e **SOBREVIVEM** a ela. Dois caminhos
desenhavam um canvas em branco fora da corrida:

| caminho | o que se via |
|---|---|
| a fase `carregando` | os corredores já existem e o laço ainda não roda: canvas **branco** |
| **um sprite que falta** | o `corridaLargar` devolve pra `setup` **sem zerar os corredores** -- e aí o quadro vazio fica na tela de escolha **pra valer** |

**Quem responde "há corrida agora?" é a FASE, e só ela** (`emPista`). Medido nas cinco: o canvas e
o placar existem em `contagem` e `correndo`, e em mais nenhuma.

**⚠️ É A TERCEIRA VEZ QUE ESTE MODO PAGA A MESMA LIÇÃO**, e vale listar as três juntas porque elas
têm a mesma forma -- *um estado que sobrevive ao momento em que ele valia*:

1. **o modal da contagem** (18/09): montado por condição no `render()`, que o laço não chama;
2. **os chips do revezamento** (20/09, de manhã): idem;
3. **este**: montado por um estado (`corredores`) que não é a pergunta certa.

#### O QUE ISSO CUSTOU

**Nada no motor:** as duas impressões continuam **idênticas** (`MOTOR 25d909ef2d79 / DIARIO
c35ba4008568`) em 900 batalhas semeadas. O único dado novo é uma lista de até 6 objetos por recorde
no `raceRanking`, que é uma coleção com um documento por jogador.

**Medido a 320px, no navegador:** a linha de resultado em **124px** (era 180 com a fileira errada),
a classificação do revezamento em **767px**, o modal em **280×239px**, o ranking com as linhas
uniformes em 26–27px, e **nenhuma tela rola pro lado**.

#### AS TRÊS LIÇÕES DE TESTE QUE SAÍRAM DAQUI

1. **⚠️ UMA TRAVA QUE ESTOURA É PIOR QUE UMA QUE FALHA.** A do envio fazia `p.time.every(...)` numa
   lista que pode não existir: com o defeito religado ela dava **TypeError**, o processo morria
   antes de imprimir a contagem, e a conferência de acusação lia isso como **"passou em branco"** --
   um defeito real quase passou por aí. Ela agora tolera a ausência, e o próprio script de acusação
   passou a tratar *"o teste morreu"* como acusação.
2. **⚠️ CLASSE SE PROCURA NA LISTA, nunca por igualdade exata.** `class="resultTime"` cravado passou
   a casar com **ZERO** no dia em que a segunda classe entrou na mesma lista. É a mesma armadilha
   das regex do `mlog-mais` e do `matchup-row`.
3. **⚠️ REGEX EM TRAVA NÃO SE ESCREVE POR SHELL.** O `\b` virou o caractere **BACKSPACE (0x08)** ao
   passar por um `node -e`, e a trava passou a procurar `resultTime` com backspaces em volta -- que
   nunca casa. Foi a **terceira** vez nesta sessão que um escape se perdeu assim. O jeito seguro é o
   editor de arquivo, e o sintoma é sempre o mesmo: uma trava certa que acusa o que está certo.

### ⚠️ CADA MODALIDADE TEM A PRÓPRIA SELEÇÃO (20/09/2026)

Reportado com dois prints: *"eu primeiro estava na tela do revezamento, e escolhi um time, depois
eu troquei para a tela da corrida individual e apareceu automaticamente o primeiro pokemon do time
do revezamento"*.

**A troca CORTAVA a lista** (`escolhidos.slice(0, corridaQuantos())`) -- e cortar seis pra **um**
deixa o primeiro. A razão escrita era boa (*"três marcados virariam uma escalação que a tela não
sabe mostrar"*), mas a saída era a errada: **o que não cabe não é pra ser aparado, é pra ficar
guardado no lugar dele.**

- **E GUARDAR (em vez de zerar) é o que faz a ida e volta não custar nada:** quem escolheu um time,
  foi ver a individual e voltou, reencontra o time como deixou. Medido: relay(6) → single(vazio) →
  escolhe 1 → relay(os 6 de volta) → single(o 1 de volta).
- **⚠️ O CAMPO PRECISA EXISTIR NA DECLARAÇÃO do objeto, e não só no `corridaZerar`:** o
  `abrirCorrida` **não zera** (ele só mexe na fase e no picker), então um campo que só nasça lá é
  `undefined` na primeira entrada -- e o `corridaTrocarFormato` escreve nele antes de tudo. A
  primeira versão estourou exatamente assim.
- **Trocar o número de PARTICIPANTES não mexe na seleção** -- é outro eixo, e há trava.

---

### O QUE FICA PENDENTE DA LIGA LARANJA

Nada disto foi integrado, e é escopo desta etapa: **o acesso por Surf**, a **Liga Laranja** em si,
insígnias, recompensas e cobranças. O modo abre **só** pelo botão administrativo da home.
Quando a Liga existir, os pontos que mudam são: a **porta** (hoje `admin`), o **nível dos NPCs**
(hoje `nivelDoNpc`, que é uma função justamente pra isso), a **dificuldade** (`CORRIDA_NPC`) e o que
hoje não existe — **gravar resultado**, que é a primeira coisa que vai precisar de backend e de uma
checagem de permissão do lado de lá.


## PESCARIA POKÉMON — o segundo teste admin (19/09/2026)

**⚠️ ATENÇÃO: ESTA SEÇÃO É DE 19/09, E O DIA SEGUINTE MUDOU O QUE ELA DESCREVE.** Em **20/09/2026**
a pescaria virou **de TIME**: o parceiro deixou de ser UM pokémon, o adversário ganhou seis, o HP
passa de uma fisgada pra a próxima e o picker é o card da Liga. **Tudo que este texto diz sobre "o
parceiro", "1x1" e "HP cheio a cada batalha" é a régua de 19/09** -- ver **A PESCARIA PASSOU A SER
DE TIME**, no fim desta seção. O que continua valendo inteiro é a MECÂNICA da pesca (a boia, a
tensão, o comportamento), a batalha ser a da jornada e o ritmo dela.

Pedida com o `pescaria-pokemon.html` da raiz como referência, e com **quatro coisas mudadas** em
relação a ele: a lista de parceiros passa a ser a do jogo (paginada, por nível), o NPC passa a ser
sorteado (Lv.65, BST acima de 500), e — a principal — *"mude exatamente para ser a mesma mecanica
que a gente usa hoje nas batalhas da jornada, vai ser 1x1, e se o pokemon do treinador vencer, vai
pontuar na pescaria"*.

**Você e o NPC pescam no MESMO lago por 90 segundos.** Seis pontos d'água, um peixe aparece num
deles, quem chegar primeiro fisga — e aí a captura só vira ponto se o parceiro **vencer a batalha**.

### ⚠️ A BATALHA É A DA JORNADA, E ISSO É A FEATURE INTEIRA

O protótipo resolvia a luta com uma fórmula própria de três linhas. Aqui quem decide é o
**`simulateGymBattle`** — o mesmo motor do ginásio, da Elite, da Torre e do Ginásio da Cidade —, e é
por isso que ela herda **de graça** tudo o que este arquivo passou semanas medindo: os golpes
escolhidos, o STAB, o subtipo, as catorze passivas, os quatro status por ataque, os estágios, o
clima, o crítico da Gen 3 e o teto de quem raspa.

- **⚠️ O PLACAR SEGUE O MOTOR, NUNCA A ANIMAÇÃO.** A batalha é **resolvida inteira** no instante da
  fisgada, e o que a tela faz depois é **animar o diário REAL** dela, no ritmo da jornada. Quem
  fecha o confronto é o `venceu` que veio do motor — não "quem chegou a zero na tela". Decidido pela
  animação, um arredondamento de barra mudaria o resultado da partida, e o log do fim discordaria do
  placar. Há trava cobrando exatamente isso.
- **É 1x1**, e os dois entram **com HP cheio**: o `simulateGymBattle` cura os dois times na entrada,
  o que aqui é exatamente o desejado — cada peixe é um confronto novo.
- **ELA PASSA PELO `applySpecialtyBuff` E PELO `equiparItens`**, como toda chamada de batalha do
  jogo: a especialidade de tipo e o item equipado do parceiro **valem**. O peixe entra limpo (ele não
  é de ninguém). É a mesma trava que o `test-especiais` cobra pras outras oito chamadas.
- **O LOG DO FIM É O `renderMatchupLog` DA CASA** — a MESMA tela que o jogador lê depois de toda
  batalha do jogo. Como os matchups são do mesmo motor, eles servem direto, com os golpes, os selos
  e as passivas de verdade. Um resumo próprio aqui seria uma segunda apresentação pra contar a mesma
  coisa.

### ⚠️ E ELA PASSOU A SER A DA JORNADA NA TELA TAMBÉM (19/09/2026)

Pedido assim: *"a batalha pokemon que esta exibindo após a pesca, deve ser exatamente igual a
batalha que ocorre na jornada, o mesmo layout, mesma velocidade, mesmos ataques, como se fosse uma
batalha enfrentando um lider de ginasio, porém é uma batalha 1x1 contra um pokemon pescado"*.

**O MOTOR já era o da jornada desde o primeiro dia; a TELA não era.** Ela tinha um desenho próprio:
sprite pequeno, barra verde fixa por `width`, sem tipo, sem selo, sem HP em número, sem o NOME do
golpe (*"X atacou e tirou −N de HP"*) e **0,42 s fixos por passo**.

Hoje o quadro é montado pelas MESMAS funções do `renderBattling`, sem uma linha de marcação
própria: `placarDoTreinador`, `fighterHtml` (sprite grande, selos, tipos e a barra de HP com os
números), o `vs-swords` girando e a `battle-status-area` com o `statusDoConfrontoHtml`. O lado do
peixe se chama **Selvagem** — ele não tem treinador.

- **⚠️ `comTerreno: false`, como na Torre**: a pescaria não tem terreno escolhido, e o selo 🔺
  prometeria um bônus que esta batalha não dá.
- **⚠️ E OS ids DAS BARRAS SÃO OS GLOBAIS DA JORNADA** (`hp-fill-player`/`hp-fill-enemy`/
  `hp-label-*`/`battle-status-txt`). Com os antigos (`pescHpA`/`pescHpB`), o `pintarStatusDoConfronto`
  e a conta do `animatePartialHpBars` não achariam nada e falhariam **em silêncio** — a barra
  simplesmente não se moveria. Só há uma batalha na tela por vez, então não há com o que colidir.

#### ⚠️ E ISSO DESENTERROU UM DEFEITO: A BARRA ERRADA DESCIA

A tela lia o **diário CRU** (`m.golpes`, filtrado por `g.x || g.d > 0`) e aplicava
`if(doJogador) hpPeixe -= g.d; else hpMeu -= g.d`. Duas famílias quebram nisso, e as duas já
estavam registradas neste arquivo:

- **cura, fúria e dreno** — na jornada o `amount` vai **NEGATIVO** pra a barra SUBIR. Ali, como
  `g.d > 0`, o `if` passava e ele **SUBTRAÍA**, e do lado OPOSTO: uma cura do jogador descia a
  barra do PEIXE;
- **queimadura e veneno** — o `q` deles é de **QUEM PERDE**, não de quem bate. A tela invertia como
  nos outros, e a queimadura do jogador descia a barra do adversário.

Hoje a sequência sai do **`buildAnimatedHitSequence`**, que é quem sabe disso — e ele traz junto a
expansão dos multi-tapa, a suavização das fatias e o reordenamento do moribundo, que é o que faz o
log parar de mostrar `−0 de HP`.

**MEDIDO em 6.000 confrontos da pescaria** (parceiro sorteado entre as 250, peixe do pool real):
o caminho antigo punha **0,69% das linhas** do diário no lado ou no sinal errado, e isso alcançava
**2,38% dos confrontos**. As marcas que ele errava são a `furia`, o `dreno`, o `veneno` e a
`queima` -- as duas primeiras porque a barra devia SUBIR, as duas últimas porque o `q` delas é de
quem PERDE. A `confusao`, a `furiadragao`, a explosão e o resto ele acertava por acaso, porque elas
seguem a inversão comum.

#### ⚠️ O RITMO É O DA JORNADA, MAS O LAÇO NÃO PODE SER

**Os dois modelos não se misturam, e isso é a decisão estrutural da feature.** A jornada anima por
cadeia de `setTimeout` com `render()` em até cinco pontos por golpe; a pescaria roda um
`requestAnimationFrame` contínuo e **nunca** chama `render()` — de propósito, porque um render por
quadro recriaria o botão de puxar no meio do `pointerdown`.

`render()` é `app.innerHTML = html`: wipe total. Medido em 1.200 confrontos 1x1 reais, o molde da
jornada dispararia **2,48 render() por batalha (máx 11)** — cada um destruindo os cinco painéis, a
boia, as seis zonas e a transição CSS da `.hp-bar-fill` no ar. Copiar a cadeia produziria uma
batalha **pior** que a da jornada.

**O que se copia são os TEMPOS, não o laço.** O `pescariaRitmoDoGolpe` guarda os mesmos quatro
pedaços do `advanceReveal` — 550ms de abertura (mais a leitura quando o confronto abre com uma
passiva), **1s do nome do golpe** antes de a barra andar (`PAUSA_ANTES_DO_GOLPE_MS`), a barra
descendo a 94 pontos percentuais por segundo (`hpBarTransitionMs`, 150–1400ms), 150ms entre golpes
e 800ms depois do último. Quem pinta são as MESMAS funções: `pintarStatusDoConfronto` pra a frase e
a conta do `animatePartialHpBars` pra a barra.

- **⚠️ ELES VIVEM EM CONSTANTES E O TESTE LÊ O `advanceReveal`** pra provar que são os mesmos.
  Escritos à mão nos dois lugares, divergiriam no primeiro ajuste e o sintoma seria a batalha da
  pescaria andando num compasso que a jornada não tem — **sem nada acusar**.
- **⚠️ O ESTADO CONTINUA EM `p.batalha`, e não em campos do `game`** como nos cinco laços de
  revelação. A razão não é estilo: **a pescaria tem DUAS batalhas simultâneas** (o NPC também
  pesca). Num campo só, o passo de um avançaria o outro e o `venceu` do NPC sobrescreveria o seu —
  e metade disso seria invisível, porque o NPC não tem quadro desenhado. Há caso de teste com os
  dois batalhando no mesmo quadro.
- **⚠️ O NPC PASSA PELO MESMO CAMINHO**, com `desenha` falso: a batalha dele leva exatamente o
  mesmo tempo que a sua, e é isso que mantém o duelo simétrico. Torná-la instantânea daria ao
  jogador **23s a menos de água** num duelo de 90s (as 5,36 fisgadas dele vezes os 4,3s a mais que
  cada batalha passou a levar) — um efeito de balanceamento como consequência de uma mudança de
  apresentação.
- **E só o log do JOGADOR vai pra tela do fim.** O matchup do NPC existe e é real; ele é jogado
  fora de propósito — a tela do fim é sobre as capturas dele, e seis logs do NPC ali seriam ruído.

#### ⚠️ NENHUMA BATALHA EM CURSO SOME SEM PAGAR

Os pontos são creditados no **FIM** da animação. Com o ritmo da jornada ela leva ~6s, e uma captura
feita aos 88s ainda estaria animando quando o relógio acabasse: o jogador pesca, o motor diz que
ele venceu, e ele recebe **ZERO** — sem erro e sem aviso.

São duas redes: a **prorrogação não corta batalha nenhuma** (ela existe pra um encontro que travou,
e uma batalha sempre termina — a sequência é finita), e o `pescariaTerminar` **fecha as que sobrarem
pagando o que o MOTOR decidiu**. Medido em 600 duelos: **0 batalhas pendentes no fim**.

#### O PREÇO MEDIDO

| 1x1 da pescaria | passo fixo de 0,42s | ritmo da jornada |
|---|---|---|
| duração do confronto | ~1,9s | **~6,2s** (máx 16s) |
| tempo do duelo em batalha | 10,0s | **27,3s** |
| suas fisgadas | 6,21 | **5,36** |
| seus pontos | 333,6 | **290,3** |
| fisgadas do NPC | 3,84 | 3,66 |
| **você vence o duelo** | **98,8%** | **97,8%** |
| duração do duelo | 97,0s | 100,1s (p95 107,8s, máx 116s) |

400 duelos de cada lado, o mesmo bot contra duas cópias congeladas. **A taxa de vitória quase não
se move, e é esse o número que importa**: o custo cai nos DOIS lados igual, porque o NPC anima a
batalha dele no mesmo relógio. O que o jogador sente é **uma captura a menos por duelo** — ele
passa 27s dos 90 olhando a luta em vez de pescando.

**Se um dia incomodar**, as réguas são o `PAUSA_ANTES_DO_GOLPE_MS` (o segundo do nome do golpe, que
é metade do tempo) e o `PESCARIA_DURACAO`. Mexer no ritmo da batalha é desfazer o pedido.

**CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois dá o **MESMO hash** em
900 batalhas semeadas, no MOTOR e no DIÁRIO. Tudo isto é apresentação — o que mudou de mecânica foi
só a pesca, abaixo.

### ⚠️ A REALIMENTAÇÃO DA PESCA, QUE NÃO TINHA VINDO (19/09/2026)

Pedida assim: *"na hora que fisgou o peixe, no modelo que eu tinha te passado, a barra mudava de cor
de acordo com o status da pesca, a cor dos textos mudava de cor, a barra de captura ja começava um
pouco preenchida e ia descendo caso o usuário nao fazia nada"*. **As três existiam no protótipo e
nenhuma tinha vindo.**

| | protótipo | a tela até 19/09 |
|---|---|---|
| barra de tensão | verde ≤48, âmbar ≤72, vermelha acima | **vermelha desde 0%** |
| texto de comportamento | verde, e **vermelho** no aviso e na arrancada | caixa amarela estática |
| captura ao fisgar | **20%** (fisgada rápida) ou **10%** | **0%** |
| tensão ao fisgar | **25%** | 0% |
| botão de puxar | amarelo e **afundado** ao segurar, com outro texto | nunca muda |
| barras | `transition: width .08s linear` | sem transição |

- **⚠️ COMEÇANDO EM ZERO A QUEDA É INVISÍVEL, e esse era o defeito de verdade.** A decadência de
  **3%/s** existia no motor desde sempre (`ganho = -3` quando ninguém puxa) e **não aparecia na
  tela**, porque o clamp em 0 a escondia. Não faltava a queda: faltava de onde cair. Há caso de
  teste que mede os dois — a queda a partir de 10% e o zero mudo a partir de 0%.
- **A FISGADA PERFEITA VALE O DOBRO** (20% contra 10%), e o critério é o do protótipo: sobrar mais
  de 0,72s da janela de 1,15s em que a boia fica afundada — ou seja, tocar nos primeiros 0,43s.
  **Ela é COMPARTILHADA com o NPC** (`pescariaPuxarLinha`), e tem que ser: um NPC que sempre
  acertasse a janela perfeita seria o boost artificial que o desenho destes minigames proíbe.
- **⚠️ A COR DA TENSÃO VEM DE CLASSE, nunca de `style.background`.** Escrita nos dois lugares, a
  folha ganharia do inline conforme a especificidade e o sintoma seria uma barra que muda de cor
  **às vezes** — o pior tipo de defeito que existe. Os limiares são ESTRITOS: 48 ainda é verde,
  48,1 já é âmbar.
- **⚠️ E O `.pesc-puxar.puxando` PRECISA VIR DEPOIS DO `.btn.primary` NA FOLHA.** As duas regras têm
  a MESMA especificidade (0-2-0), então quem vence é a que vem depois — e uma regra declarada certa
  que não faz efeito é a família do `[hidden]` que deixou o modal da contagem da Corrida preso na
  tela: ela passa em qualquer asserção de HTML e **só a captura de tela pega**. Há trava de ORDEM.
- **⚠️ TODA CLASSE PASSA PELA GUARDA DE IGUALDADE**, como as larguras já passavam: o pintor roda 60
  vezes por segundo, e um `classList.toggle` cego força recálculo de estilo em todo quadro.
- **A LINHA SOLTA QUANDO A ABA SAI DE FOCO** (`visibilitychange` e `blur`). O botão só recebe
  `pointerup` enquanto o dedo está nele: trocar de aba com o dedo apoiado deixaria a linha puxando
  sozinha, e na volta o jogador encontraria a linha arrebentada sem ter feito nada. São duas das
  cinco portas do protótipo.

### AS CHANCES DE CADA PONTO — o último pedaço do protótipo que faltava

O protótipo tem um **(i)** em cada ponto do lago que abre as chances de encontro dele, e era a
única coisa dele que não tinha vindo. Ela responde a pergunta que se faz ANTES de lançar: o Abismo
paga 83 pontos, mas o que mora lá?

- **⚠️ AQUI A ESPÉCIE SAI DIRETO DO POOL**, sem a conversão de espécie-por-nível que o encontro
  selvagem precisa — o `pescariaSurgir` sorteia o id e o nível **separados**. Ou seja, esta lista é
  exatamente o que pode ser pescado, e é por isso que ela pode mostrar a **chance**; a tela
  "Pokémons desta rota" não pode, porque lá o nível converte a espécie.
- **A LINHA É A DA ROTA** (`.rota-mon`), e ela abre a MESMA ficha da Pokédex — é a mesma pergunta
  ("esse cobre o tipo que falta no meu time?"), e um desenho próprio obrigaria a reaprender a ler.
- **⚠️ O (i) É IRMÃO DO BOTÃO DA ZONA, nunca filho**: botão dentro de botão é HTML inválido — o
  navegador fecha o de fora e o clique de dentro se perde, com a tela continuando a PARECER certa.
  É a armadilha que a lupa do encontro selvagem e a do montador já custaram. De quebra ele
  sobrevive ao card **desabilitado**, e é justamente enquanto você está pescando num ponto que dá
  vontade de consultar os outros.

**E VIERAM JUNTO as coisas do protótipo que a tela não tinha:** o chip do ponto no painel da boia,
o chip do peixe (`Grande · na linha`), a **linha de atividade de cada ponto do lago**
(`<NOME> PESCANDO` / `Médio · 4s` / `Sem movimento`), o relógio
**vermelho** nos últimos 15s, a contagem de prorrogação (`+7s`) depois dos 90, e o chip do
cabeçalho virando `ÚLTIMOS ENCONTROS`. A função `pescariaTamanho` estava **órfã** desde que nasceu — agora ela tem chamador.

**⚠️ AS DUAS ETIQUETAS DE DISPUTA QUE ESTE PARÁGRAFO CITAVA SAÍRAM EM 20/09/2026**, quando um ponto
passou a ter UM pescador -- ver **AS SETE DA PESCARIA**, no fim desta seção. E o `VOCÊ` virou o
nome do treinador na mesma leva.

**Medido a 320px, no navegador, nas 14 telas:** **nenhuma rola pro lado** e nenhum elemento estoura
a largura. A tela da batalha é a mais alta (826px), o painel de puxar fica em 651px e o quadro dos
dois lutadores em 199px. As cores conferidas no computado: tensão `rgb(47,158,68)` / `rgb(224,168,0)`
/ `rgb(209,41,27)`, e o texto `#2d7449` → `var(--red)` na arrancada — os valores do protótipo.

### O NPC: SEMPRE Lv.65, SEMPRE BST ACIMA DE 500

Foi o pedido ao pé da letra, e são **36 espécies** — as 40 do `SPECIES` acima de BST 500 menos os
**quatro INTOCÁVEIS**.

- **⚠️ E TIRAR OS QUATRO NÃO É ZELO: eles são os MAIORES do pool.** Mewtwo, Lugia e Ho-oh são BST 680
  e o Celebi 600 — ou seja, o filtro de BST os pegaria primeiro. São justamente os que o jogo inteiro
  mantém fora de pool nenhum (o encontro selvagem, a Torre, a Vigília), e um Mewtwo Lv.65 como
  parceiro do NPC seria um adversário que o jogador **não tem como ter**.
- O sorteio é conferido em 200 voltas: todos Lv.65, todos acima de 500, todos com HP cheio — e
  **varia de verdade** (15+ espécies distintas), que é o que uma trava de "sempre 65" sozinha não
  pegaria.
- **⚠️ E DESDE 20/09/2026 ELE SORTEIA SEIS, não um** (`PESCARIA_TIME`), **sem repetir linha
  evolutiva** dentro da equipe -- a regra do encontro selvagem e do montador.

### O PICKER É O MONTADOR, ORDENADO POR NÍVEL

*"Aquela lista igual fazemos para a corrida pokemon, todos os pokemons do time, paginando a cada 10
pokemons, e ordenar pelo level mais alto."*

- **REUSA O `MONT_POR_PAGINA`, o `montadorPaginaValida` e o `game.montadorPagina`** — o mesmo estado
  que a Torre, o Ginásio e a Corrida. Uma paginação própria divergiria na primeira mexida.
- **⚠️ MAS A ORDEM É O NÍVEL, e não o Speed da Corrida** — lá o Speed **É** a prova; aqui o que
  decide é a batalha, e o nível é o que o jogador usa pra escolher.
- **⚠️ ABRIR O PICKER ZERA A PÁGINA** (`pescariaAbrirPicker`): o `montadorPagina` é compartilhado, e
  uma página 3 sobrando da Torre abriria esta lista no meio. É o mesmo cuidado do `abrirMontador`.
- **O CARD É O DO MONTADOR, estrutura por estrutura** (`mont-num`, `mont-info`, `mont-nome`,
  `mont-lv`, `mont-sub`, `mont-time`), com a **lupa IRMÃ** dele — `<button>` dentro de `<button>` é
  HTML inválido e o clique de dentro se perde. A primeira versão inventou um wrapper `.mont-sprite`
  que não existe na casa, e o sprite saiu solto no meio do card.
- **⚠️ E O SLOT VAI ENTRE ASPAS NO `onclick`**: ele pode ser `ap:3` (um aposentado), e sem as aspas o
  atributo vira sintaxe inválida e o clique **não faz nada, sem erro no console**. É a família que já
  matou o botão da notificação da liga e as setas da Montanha Sagrada.

### O ACESSO: `admin === true`, E NADA MAIS

Mesma porta da Corrida, e **as duas foram endurecidas junto**: elas eram `!game.ehAdmin` (truthy), o
que deixava um `'sim'` escrito no console passar. Hoje são `!== true`.

- **⚠️ ENQUANTO A CONTA CARREGA O BOTÃO FICA OCULTO E A PORTA RECUSA** — o **contrário** da porta dos
  modos de campeão, que erra pro lado de DEIXAR ENTRAR. Aqui o lado seguro é o outro: mostrar um modo
  administrativo a quem não é admin, mesmo por meio segundo, é pior que escondê-lo de quem é.
- O que protege de verdade é o `admin` estar na **trava de campos** do `firestore.rules`, ao lado de
  `moedas` e `rareCandies`: o dono do documento não o escreve, só o console do Firebase.
- **Nenhuma operação de backend nova**: a pescaria é offline inteira — nenhuma Cloud Function, nada
  no Firestore, **nada no save**. Conferido: seis batalhas depois, o time do save fica byte a byte
  igual, e o estado vive fora do `game`.

### O QUE FOI MEDIDO

**A CURVA DE HABILIDADE, 60 partidas por perfil** (o mesmo Jolteon Lv.70 nos quatro; o bot erra uma
fração das decisões e lê o peixe com atraso):

| perfil | você | NPC | fisgadas | vence a partida |
|---|---|---|---|---|
| domina o jogo | 221 | 115 | 4,5 | **92%** |
| joga bem | 183 | 121 | 3,9 | 78% |
| **mediano** | 148 | 139 | 3,0 | **57%** |
| distraído | 87 | 139 | 2,1 | 25% |

**O mediano empata**, quem domina ganha quase sempre e quem se distrai perde — e **quem só assiste
faz ZERO**, porque não pescar é não pontuar.

**⚠️ E A ESCOLHA DO PARCEIRO VALE 30 PONTOS**, que é a decisão que o pedido queria criar. **Esta
tabela é de 19/09, quando o parceiro era UM pokémon** -- hoje entra o time inteiro, e a escolha
passou a ser de TIME; o que ela continua mostrando é o quanto o TIPO do parceiro pesa contra as
seis zonas. (Medida com o mesmo jogador, perfil "joga bem", 80 partidas cada.)

| parceiro Lv.70 | vence a partida |
|---|---|
| **Elétrico** (Jolteon) | **86%** |
| Normal (Snorlax) | 76% |
| Voador (Pidgeot) | 66% |
| Planta (Venusaur) | 61% |
| **Fogo** (Arcanine) | **56%** |
| *(Magikarp, pra calibrar o piso)* | *4%* |

**⚠️ MAS A BATALHA SÓ FILTRA NO FUNDO DO LAGO, e é o desenho:** medida por zona, ela é 100% nas três
águas rasas e só cobra nas três fundas — Abismo com **Elétrico 97%, Planta 25%, Fogo 9%, Voador 3%**.
Ou seja, a margem é segura e o abismo é onde a escolha do parceiro aparece. É por isso que o prêmio
escala junto: **Margem 20 pts, Juncos 30, Corais 37, Cachoeira 58, Gruta 67, Abismo 83**.

- **Se um dia incomodar**, as réguas são o `PESCARIA_DURACAO` (90 s), o `PESCARIA_NPC` (a chance de o
  NPC puxar) e as faixas de nível das seis zonas — e a régua mais forte é a **duração**, porque ela
  decide quantas fisgadas cabem.

### AS ARMADILHAS DO CAMINHO

- **⚠️ O `.btn` DA CASA NUM CARD FLEX SOBE POR CIMA DO TEXTO.** O card do parceiro tinha um
  `<button class="btn">Trocar</button>` na ponta, e o `.btn` é `display:block; width:100%` — medido
  a 320px, ele cobria o nome e o nível. **O card inteiro virou o botão**, que é a regra que a ficha
  da Pokédex, o card do log de batalha e as prateleiras da loja já seguem: aquele é botão de AÇÃO, e
  aqui a linha é informação que por acaso se toca. De quebra o alvo de toque passou a ser a linha
  toda. **Só a captura de tela pegou** — o HTML estava sintaticamente perfeito.
- **⚠️ O `render()` NÃO É CHAMADO POR QUADRO.** Quem pinta é o DOM (`pescariaPintar`), como na
  Corrida e pelo mesmo motivo: um render por quadro recriaria a tela 60 vezes por segundo e o botão
  de puxar perderia o `pointerdown` no meio do toque.
- **⚠️ PUXAR É `pointerdown`/`pointerup`, com `pointerleave` e `pointercancel` junto** — sem os dois
  últimos, arrastar o dedo pra fora do botão deixaria a linha puxando sozinha até arrebentar. E o
  botão tem `touch-action:none`: sem ele, segurar e mexer o dedo rola a página e o navegador cancela
  o `pointerdown`.
- **⚠️ O `dt` É LIMITADO A 0,1 s.** Com a aba em segundo plano o rAF para, e na volta o primeiro
  quadro traria os segundos todos de uma vez — o peixe escaparia sozinho. É o mesmo aparo da Corrida.
- **AS SEIS BARRAS NASCEM COM O VALOR REAL.** Quem as pinta a cada quadro é o DOM, mas o **PRIMEIRO**
  desenho vem do `render()` — com `0%` fixo elas piscavam em zero ao entrar no painel, e o jogador
  via a captura "voltar".
- **AS SEIS ÁGUAS SÃO UMA GRADE DE 3, e não um mapa desenhado:** a 320px um mapa com áreas
  irregulares vira alvo de toque impossível de acertar. Seis botões retangulares são o mesmo jogo e
  se tocam com o polegar. A zona com peixe **pisca** (animação de `box-shadow`, que não recalcula
  layout) e é a única pista de onde tocar.

**NA DIFICULDADE DO JOGO, NADA — por construção**: as duas impressões continuam **idênticas**
(`MOTOR 6df3fbe71528 / DIARIO a12b4df14369`). A pescaria é apresentação mais um **chamador novo** do
motor, não uma mudança nele.

**Medido a 320px, no navegador:** setup **505px**, picker **505px**, tela de jogo **850px** e o fim
**1.101px** (o placar mais o log das batalhas) — e **nenhuma rola pra o lado**.

**⚠️ E A PRIMEIRA MEDIDA DISSE QUE A TELA DE JOGO ESTOURAVA 3px, e era da MEDIÇÃO:** eu montei a
página de teste embrulhando o HTML num `<div class="app-shell">` — uma classe que **não existe no
jogo** (o container de verdade é `<div id="app">`). Sem CSS, ela cresceu até a largura do conteúdo e
levou tudo junto. É a mesma família do *painel forte demais* que este arquivo já registra três vezes:
**o harness errado inventa um defeito que não existe**, e aqui ele quase custou um conserto de
layout em cima de um problema que só a minha página tinha.

`tools/test-pescaria.js` tranca a batalha (o matchup ser do motor, o placar seguir o `venceu` e não
a animação, e — lendo o código — que não sobrou fórmula de dano própria), o acesso nos **10 estados**
do campo, o NPC, o picker, a pesca (fisgar cedo perde, puxar sem soltar arrebenta, quem lê o peixe
captura), o nível do pescado batendo com a faixa da zona em 360 peixes, e o save intacto.
**⚠️ TRÊS DESSAS TRAVAS VIRARAM OUTRA COISA EM 20/09** -- o "1x1" virou "o TIME contra o peixe", o
"HP cheio" virou "só o PEIXE entra cheio", e o picker paginado por nível virou o card de time.

### ⚠️ A TELA NÃO ACOMPANHAVA O MOTOR (19/09/2026)

Reportado assim: *"a tela do sinal para fisgar não está acontecendo nada, tente deixar exatamente
como funcionava no outro arquivo, e depois que eu não fisguei, não consigo mais clicar em nenhum
botão do lago"*.

**⚠️ SÃO DOIS SINTOMAS E UMA CAUSA SÓ, e ela é a consequência direta da regra da casa.** Os cinco
painéis eram montados por **CONDIÇÃO** no `renderPescaria` — e o laço do jogo **não redesenha**, de
propósito (um `render()` por quadro recriaria o botão de puxar no meio do toque e o `pointerup`
nunca chegaria nele). Só que as duas transições que mais importam **acontecem no TEMPO**, não num
clique:

| transição | o que o jogador via |
|---|---|
| `espera` → `fisgada` | a boia afundava **no motor** e a tela continuava dizendo *"espere ela afundar"* — ou seja, **o sinal de fisgar não existia** |
| `descanso` → `parado` | as zonas ficavam `disabled` **para sempre**, e o lago nunca reabria |

**O CONSERTO É O DO PROTÓTIPO, E É O MESMO QUE A CORRIDA JÁ TINHA PAGO**: os painéis **existem
sempre** e quem escolhe qual aparece é o **pintor**, pelo `hidden` (lá é `$('waitPanel').hidden`).
Em 18/09 o modal da contagem da Corrida ficou preso na tela **exatamente por isto**, e a lição não
foi aplicada à Pescaria no dia seguinte.

- **⚠️ QUAL PAINEL CADA ESTADO MOSTRA VIVE NUMA FUNÇÃO SÓ** (`pescariaPainelDoEstado`), lida pelo
  render (que dá o valor inicial) e pelo pintor (que troca a cada quadro). Escritas em separado elas
  divergiriam no primeiro estado novo, e o sintoma seria a tela mostrando o painel de outro momento.
- **`espera` e `fisgada` DIVIDEM o painel**, e é o que faz o sinal ser um sinal: é a MESMA cena, e o
  que muda é a boia ter afundado. Em painéis separados, ele viraria uma troca de tela.
- **⚠️ O PAINEL DA BATALHA É O ÚNICO PREENCHIDO PELO PINTOR** (sprite, nome e nível do pescado mudam
  a cada captura), e **uma vez por peixe** — a guarda é o `id` dele. Refeito a cada quadro, ele
  jogaria fora as barras de HP que o próprio pintor acabou de mexer.
- **A CENA DA BOIA É A DO PROTÓTIPO**: a faixa d'água listrada, a boia balançando, e **a parada é o
  sinal** (`animation:none` mais o halo amarelo). O movimento é o *"ainda não"*.

**MEDIDO NO NAVEGADOR:** a tela do sinal mostra *"A boia afundou! Fisgue agora!"* com a boia
afundada, e depois de não fisgar o lago reabre em **1,4 s**. As três travas novas **acusam** com
cada defeito religado (2, 2 e 1 falhas).

#### ⚠️ E O DUBLÊ DE ELEMENTO DO SANDBOX MENTIA — por isso nenhuma trava tinha pegado

O `classList` do stub era três no-ops com um `contains` que **sempre devolvia false**, e `toggle`
**nem existia**. O pintor faz `if(el.classList.contains('viva') !== viva) el.classList.toggle(...)`
— ou seja ele **nunca quebrava enquanto nenhuma zona acendia**, e derrubava o teste com um
TypeError no primeiro peixe que aparecesse. Resultado: **as 87 travas da Pescaria nunca chamaram o
pintor**, e o defeito inteiro morava nele.

Hoje o stub tem `classList` de verdade (com um `Set` por trás), mais `hidden`, `disabled` e
`dataset`. **É a mesma lição do `fake-firestore` e do `getAttribute`: o dublê tem que doer onde a
produção dói** — e um dublê que mente sobre o que já está na tela não consegue testar código que
PERGUNTA o que já está na tela.

#### ⚠️ E TRÊS ARMADILHAS CONHECIDAS APARECERAM DE NOVO, TODAS NO MESMO DIA

1. **A FATIA DE CÓDIGO SAÍA VAZIA.** A trava nova fatiava de `/* jogando */` até
   `function pescariaLargar` — e o `pescariaLargar` fica **ANTES** no arquivo, então a fatia tinha
   **zero caracteres** e as seis asserções passavam **sem ler nada**. É literalmente a armadilha que
   o teste do `tentarGolpeEspecial` já tinha custado, e o conserto é o mesmo: **um `ok()` só pra
   dizer que há o que ler**. Hoje as duas fatias do arquivo são cobradas pelo tamanho.
2. **UMA CLASSE DE BOTÃO QUE NÃO EXISTE.** O botão de fisgar nasceu com uma variante de cor que a
   folha não declara (as da casa são `primary`/`secondary`/`success`/`danger`/`selected`), e saiu
   **cinza** no momento em que a tela mais precisa gritar. Um nome que não existe **não dá erro**:
   ele só não faz nada, e **só a captura de tela pega**. É a mesma família do `var(--yellow-soft)` e
   do `var(--cream)` fantasmas. Há trava nova varrendo o **jogo inteiro** — ela achou um órfão
   anterior (`mewtwo-loan-cta`, num botão que já tem o `.btn.success` fazendo o trabalho), que fica
   **nomeado** nela em vez de a regra ser afrouxada.
3. **O COMENTÁRIO DO CONSERTO SE ACUSOU NA PRÓPRIA VARREDURA** — a **quarta** vez neste projeto (o
   nome de líder na bifurcação, o código velho na trava do `slotDaConta`, a palavra "Máquina").

#### ⚠️ E O PLACAR ROLAVA PRA O LADO: `1fr` NÃO ENCOLHE

Medido a 320px com o nome e o texto de estado mais longos (*"NPC · Dragonite"* e *"Procurando
oportunidade"*): a tela ia a **337px**. O `.pesc-placar` era `grid-template-columns:1fr 1fr`, e
**`1fr` é `minmax(auto,1fr)`** — o `auto` não encolhe abaixo do conteúdo. É literalmente a mesma
armadilha que a fileira de cinco cards da home já teve.

Hoje os três grids da Pescaria usam `minmax(0,1fr)`, e o texto do estado quebra
(`overflow-wrap:anywhere`). Medido depois, nos **cinco** estados do painel: **320px em todos**.

`tools/test-pescaria.js` tranca **268 pontas** — inclusive o bloco que **dirige o laço de verdade
sem chamar `render()` nenhuma vez** (é isso que o torna uma prova: com um render no meio ele
passaria com o defeito inteiro de volta) e a varredura das classes fantasma.

### ⚠️ AS ONZE DA REVISÃO ADVERSARIAL (19/09/2026)

Uma varredura adversarial em cima da pescaria pronta achou onze coisas, e **nenhuma delas dá erro,
aparece num print ou quebra um teste** — é por isso que elas ficam registradas uma a uma. Duas são
graves, e as duas nasceram do MESMO fato: a batalha da pescaria passou a usar as peças da jornada,
e com elas vieram as responsabilidades delas.

#### ⚠️ 1) O LAÇO CONTINUAVA VIVO PINTANDO DENTRO DE OUTRA BATALHA

A guarda do `requestAnimationFrame` era só `if(pescaria.fase !== 'jogando')`. Ela **não olhava a
tela** — e desde que a batalha virou a da jornada, o pintor escreve nos ids **globais** dela:
`hp-fill-player`, `hp-fill-enemy` e `battle-status-txt`, que são os **mesmos** da batalha online, da
Torre e do ginásio (13, 13 e 6 usos no arquivo).

**Aceitar um convite online no meio de um duelo troca a `game.screen` e não avisa ninguém.** O laço
seguia rodando e passava a mexer na barra de vida e na frase **da outra batalha**, por cima do que o
jogador estava jogando.

- Hoje a guarda é `fase !== 'jogando' || game.screen !== 'pescaria'` — a mesma que os cinco laços de
  revelação têm desde sempre.
- **Parar é seguro E completo**: só o `abrirPescaria` põe a tela de volta, e ele zera tudo.
- ⚠️ **A Corrida não tem essa guarda tampouco** (`grep` por `game.screen !== 'corrida'` devolve nada).
  Lá o laço pinta num `<canvas>` de id próprio, então o estrago é menor — mas é a mesma porta, e
  fica dito pra ser decisão e não descuido.

#### ⚠️ 2) A ESPECIALIDADE E O ITEM DO JOGADOR VALIAM NO PARCEIRO DO NPC

**Os dois pescadores passam pelo MESMO caminho**, e o lado `a` do `pescariaBatalhar` é o parceiro de
quem estiver lutando — inclusive o do NPC. O `pescariaInstancia(p, ehDoJogador)` **declarava o
parâmetro e nunca o lia**, e o `pescariaBatalhar` aplicava `applySpecialtyBuff(a, game.specialties)`
e `equiparItens(a, game.equipados)` sem condição.

**Medido:** com uma especialidade em Elétrico e o NPC sorteado num Jolteon, a batalha **dele** saía
com `playerSpecialty: true` — o selo 🎖️ no quadro do adversário e 1,05× em todos os atributos. E o
parceiro do NPC é sorteado **uma vez por duelo**: caindo num tipo que o jogador domina, os 90
segundos inteiros de batalha dele saíam buffados.

⚠️ **É a armadilha que o `corridaInstancia` já registra** — *"com `true` implícito, a próxima chamada
esquecida daria o buff ao adversário em silêncio"*. Aqui ela não foi esquecida: foi **declarada e
ignorada**, que é pior — parecia tratada.

#### ⚠️ 3) O PEIXE LUTAVA SEM MOVESET — e era metade do pedido que faltava

O peixe e o parceiro do NPC entravam **sem `ataques`**, ou seja caíam no motor de tipo com o poder
implícito de 60. A regra da casa desde 09/09/2026 é o contrário: **quem NÃO escolhe golpe luta com
tudo que a espécie aprende por nível** (`equiparNpc`), e só quem ESCOLHE fica com o teto de três.

⚠️ **E ISSO É O QUE FAZIA OS STATUS POR ATAQUE NÃO EXISTIREM DO LADO DO PEIXE:** sem id de golpe o
motor não tem o que consultar nas tabelas de queimar/envenenar/paralisar/congelar. **Medido: 0 em
4.000 batalhas antes, 4,1% depois.**

**O PREÇO, medido** (5.400 batalhas de cada lado, mesmos pares e **mesmas sementes**, só o
`equiparNpc` mudando):

| | sem moveset | com | |
|---|---|---|---|
| **vitória do parceiro** | 84,8% | **82,9%** | **−1,9** |
| passos por batalha | 3,09 | 3,08 | — |
| Margem, Juncos | 100% | 100% | 0,0 |
| Corais | 99,7% | 98,1% | −1,6 |
| **Cachoeira** | 85,4% | **78,4%** | **−7,0** |
| Gruta | 77,3% | 77,0% | −0,3 |
| **Abismo** | 46,2% | **43,8%** | −2,4 |

Ele **não alonga a animação** (3,09 → 3,08 passos) e o custo se concentra na água funda, que é onde
o desafio mora. O parceiro do JOGADOR **nunca** passa pelo `equiparNpc`: os golpes dele são a
escolha dele, e um save antigo sem `ataques` continua caindo no motor de tipo, que é o desenho.

#### ⚠️ 4) OS SELOS 🔥🟣⚡ NUNCA APARECIAM NO QUADRO

O `selosDoConfronto` só devolve esses três **a partir do passo em que o status pega** (é a regra de
16/09/2026: mostrá-los antes entregaria uma queimadura que só acontece seis golpes depois). E o
quadro da pescaria é montado **uma vez por peixe**, ou seja sempre no passo 0 — então eles não saíam
**nunca**.

Na jornada quem os faz aparecer é o `render()` do ramo `animating`, disparado justamente nesses
passos, **porque `queimou`/`envenenou`/`paralisou` carregam a marca `leitura`** — que é a mesma que
agenda o repinte da área aqui. Hoje o `pescariaPintarArea` repinta também o bloco `battle-vs`, pela
**MESMA** função que o render monta (`pescariaLutadoresHtml`).

⚠️ **E ele é seguro ali e só ali:** o instante é `nome + barra + 50ms`, ou seja **depois** de a
transição da barra terminar — exatamente onde a jornada agenda o `render()` dela. Refazer os quadros
no meio da transição a mataria, que é a regra da casa.

**Medido: 244 de 244** confrontos com status têm o selo ausente no passo 0 e presente no quadro
repintado. E no navegador, a 320px: *"Snorlax ficou paralisado com GOLPE DE CORPO!"* com o ⚡ no
quadro do lutador.

#### ⚠️ 5) O NPC TINHA UM RAMO QUE NUNCA RODAVA

`pescariaNpcPuxa` abria com `if(p.falha && p.tempoDePesca > 4) return true;` e o comentário dizia
*"teimou: vai arrebentar"*. **Ele é inalcançável**: o `falha` faz o NPC errar a **FISGADA**, e quem
erra a fisgada nunca chega a puxar. **Medido: 0 de 400.**

Eram **dois comentários descrevendo uma mecânica que não existe** — e é isso que fazia parecer que o
NPC às vezes arrebenta a linha. **Ele nunca arrebenta, e é aritmética:** com o teto de 76 no cansado
e 40 no resistindo, a tensão dele não alcança 100. A maior vista em 60 duelos foi **62,6**.

#### ⚠️ 6) A TAXA DE ERRO DO NPC FICA EM 0,28, E NÃO NOS 0,15 DO PROTÓTIPO

O pedido foi *"o mais parecido com o protótipo possível"*, e este é o ponto em que **seguir o
protótipo piora o jogo** — medido, não achado no gosto. Com um bot que modela habilidade de verdade
(atraso de reação na fisgada + erro de leitura ao puxar), 200 duelos por célula:

| quem joga | **hoje (0,28)** | com 0,15 |
|---|---|---|
| domina o jogo | **86%** | 77% |
| joga bem | **82%** | 76% |
| mediano | **66%** | 74% |
| distraído | **54%** | 47% |

⚠️ **Com 0,15 a curva de habilidade quase some**: quem domina ganha 77% e quem é mediano ganha 74%.
A causa é que o duelo é decidido pelo **número de capturas**, não pela perícia em cada uma — o NPC
pescando mais afoga o diferencial do jogador. **Fica em 0,28, e a régua está aqui.**

#### AS CINCO MENORES

- ⚠️ **O `pescariaZerar` não zerava o parceiro nem a semente.** O `escolhido` é um objeto vindo do
  `game.saveSlots`, **que é recarregado a cada volta à home** — mantido, ele apontava pro time de
  uma leitura anterior. E o `pescariaReiniciar` já salvava e repunha o parceiro na mão: sem o zerar
  limpá-lo, aquele save/restore **não fazia nada** e a intenção dele só se lia no comentário.
  ⚠️ **E zerar a `semente` obrigou a limpar a marca do painel junto**, que é a consequência não
  óbvia: o pintor só remonta o painel quando o `dataset.peixe` muda, e com a numeração recomeçando
  do zero dois duelos passam pelos **mesmos** ids. No navegador o `render()` recria o elemento e
  isso não aconteceria; a linha existe pra a garantia **não depender disso** — um painel que não
  remonta não dá erro, só mostra o peixe errado.
- ⚠️ **A prorrogação deixou de aceitar linha nova.** Ela existe pra **terminar o que está na água**,
  não pra começar mais. E quem recusa é a **AÇÃO**, não o botão apagado: o `disabled` das zonas é
  escrito pelo pintor, e um toque no quadro em que o relógio vira chegaria antes dele. **A fisgada
  continua valendo** na prorrogação — quem lançou antes tem direito ao peixe dele.
- ⚠️ **O `expira` saía de um sorteio próprio e cruzava com o `entradaAte`** (5,0–8,0 contra
  3,4–5,4): a oportunidade podia **sumir com a janela de entrada ainda aberta**, e aí o ponto
  continuava piscando (o `viva` lê o `entradaAte`) e o toque não fazia nada. Um botão que pisca e
  não responde é pior que um botão apagado. Hoje ele é `entradaAte + 1,6 a 3,0`. **Medido: 0 de
  3.000.**
- **A rede do `pescariaTerminar` pagava e não registrava.** O ponto subia e o encontro não aparecia
  no histórico nem o log na tela do fim — o jogador via o placar mexer sem nada explicando. Hoje as
  duas portas (o fim da animação e a rede) chamam o **mesmo** `pescariaCreditar`.
- **A tela do duelo ganhou saída.** Não havia nenhuma: o único jeito de sair era o relógio acabar.
  Enquanto o laço está vivo isso só custa paciência — mas **se ele morrer, a tela congela e não há
  mais nada que a tire dali**. ⚠️ Ele fica no **FIM** da tela, depois do lago E do painel: entre os
  dois, que foi onde ele nasceu, ele cai exatamente onde o polegar está enquanto se joga.
- ⚠️ **O ponto fechado parecia aberto, e o que enganava era o piscar:** um ponto com peixe
  continuava pulsando *"toque aqui"* com o botão desabilitado. `.pesc-zona.viva` e
  `.pesc-zona:disabled` têm a **mesma especificidade**, então quem ganha é a última — e a de
  `:disabled` vinha antes. Hoje ela vem depois e desliga a animação. **Medido no navegador:** com
  peixe e tocável, `opacity 1` + `pesc-pisca`; com a linha na água, `opacity 0.3` + `animation none`.

#### O QUE ISSO CUSTOU NO DUELO, E O QUE NÃO CUSTOU

**No motor, NADA — e está conferido por impressão:** o mesmo script contra o `index.html` do HEAD e
contra o da árvore de trabalho dá `MOTOR 0c52f316db7b / DIARIO cf3c6f175124` nos **dois**. A pescaria
inteira é apresentação mais um **chamador novo** do motor.

**No duelo** (200 por perfil, com o bot de habilidade descrito acima):

| quem joga | você | NPC | fisgadas | vence a batalha | vence o duelo |
|---|---|---|---|---|---|
| domina o jogo | 222 | 137 | 5,69 | 5,60 | **86%** |
| joga bem | 208 | 147 | 5,41 | 5,28 | 82% |
| mediano | 189 | 151 | 5,17 | 5,09 | **66%** |
| distraído | 158 | 146 | 4,28 | 4,17 | 54% |

**Medido a 320px, no navegador, nas 17 telas:** nenhuma rola pro lado, o botão de sair mede
**320×52px**, e a tela do duelo vai a **914px** com a batalha aberta.

⚠️ **E CADA UMA DAS ONZE TEM TRAVA QUE ACUSA:** religando os defeitos um a um, a bateria falha em
todos (1, 2, 7, 1, 1, 2, 2, 1, 2, 2 e 1 falhas). Sem isso o bloco seria decoração — a metade delas
é lida do **código** (a guarda do laço, o `ehDoJogador` nas duas linhas, o `equiparNpc` só no NPC, a
ordem das regras de CSS), porque os casos chamam as funções na mão e passariam com a chamada órfã.

#### ⚠️ E O PRÓPRIO RELIGAR PEGOU UMA TRAVA QUE MEDIA OUTRA COISA

A do relógio (*"acabado o tempo, a AÇÃO recusa a linha nova"*) **passava com a guarda removida**, e
passava de forma estável — 5 rodadas de cada lado, zero falhas. O fixture criava a oportunidade no
instante **0** e só então empurrava o relógio pra 90,2s: aí a janela de entrada dela (`entradaAte`,
3,4 a 5,4s) já tinha fechado, e o `pescariaEntrar` recusava **por conta própria**. A asserção nunca
chegou perto da regra que ela diz medir.

Hoje a oportunidade nasce a **1 segundo do fim** — janela até ~92,6s —, e há um `ok()` só pra
afirmar que ela ainda está aberta quando o relógio vira. ⚠️ **A segunda asserção do mesmo bloco
tinha o mesmo furo**: com o pescador em `puxando`, o `pescariaEntrar` e o `pescariaFisgar` voltavam
pelo ESTADO e não pela fase.

É a armadilha do **fixture que não cai na faixa em que a regra vale** — a mesma que este arquivo já
registra no painel forte demais do Smeargle e no `preservePlayerHp` que cura o time B. **Trava que
passa sempre não é trava**, e o jeito de descobrir é religar o defeito: foi ele que denunciou.

#### ⚠️ E O COMENTÁRIO DA CORREÇÃO 5 CITAVA O CÓDIGO REMOVIDO

Ele reproduzia o ramo morto ao pé da letra pra explicar por que ele saiu — e o `index.html` é
**publicado inteiro**, então uma varredura futura atrás daquele nome acha o comentário e acusa o
que está certo. É a **quinta** vez neste projeto (o nome de líder na bifurcação, o código velho na
trava do `slotDaConta`, a palavra "Máquina", a interpolação da faixa de update).

Hoje ele descreve o ramo sem reproduzi-lo, e a trava dele deixou de fatiar **400 caracteres a
partir do nome** pra fatiar a **função inteira** (176 chars, até a próxima `function`) — assim ela
não pode ser enganada por um comentário acima dela, e tem um `ok()` cobrando que a fatia tem o que
ler.

### ⚠️ A PESCARIA PASSOU A SER DE TIME, E A CORRIDA TAMBÉM (20/09/2026)

Nove pedidos numa leva, e o que os amarra é um só: **os dois minijogos deixaram de ser sobre UM
pokémon e passaram a ser sobre um TIME** -- o mesmo time campeão que a Liga Clássica, o Ginásio da
Cidade e a Batalha Online já exigem.

#### ⚠️ O DESGASTE É A FEATURE, e ele sai do `preservePlayerHp` da Elite 4

*"os pokémons que morrerem tem que permanecer morto até o fim da pesca, e os que sobreviveram mas
tomaram dano, quando começar a próxima batalha depois de pescar um pokemon, deve permanecer com o
mesmo hp que estava na luta anterior"*

**Quem entrega isso é uma opção que já existia**: o `simulateGymBattle` **CURA os dois times na
entrada**, e o `preservePlayerHp` segura o lado A -- ele carrega a FRAÇÃO de vida entre as lutas,
que é o que a Elite 4 faz desde sempre. Sem ele o desgaste sumiria a cada fisgada.

- **O PEIXE CONTINUA ENTRANDO CHEIO**, e essa assimetria é o desenho: cada peixe é um encontro novo.
- **⚠️ A ÚNICA FONTE DE VERDADE DO HP É A INSTÂNCIA**: o `pescariaNovoPescador` guarda o time e o
  `pescariaComecarBatalha` o passa **direto** pro motor. Uma cópia no meio do caminho desfaria o
  desgaste **sem nada acusar** -- há trava exigindo que o HP nunca SUBA entre duas fisgadas, que é
  a diferença entre "o desgaste existe" e "o desgaste PERSISTE".
- **COM O TIME NO CHÃO NÃO SE PESCA MAIS**, e **com os DOIS times no chão o duelo termina**. Sem a
  primeira guarda o jogador fisgaria e perderia toda batalha até o relógio acabar; sem a segunda o
  relógio correria sozinho com as duas telas paradas.

**O QUE ISSO CRIA DE DECISÃO, medido** (60 duelos por cenário, time Lv.55-70):

| onde se pesca | time de pé no fim | varrido | vitórias | pontos |
|---|---|---|---|---|
| as seis zonas, 6 fisgadas | **4,9 de 6** | 0% | 6,0 | 292 |
| as seis zonas, 10 fisgadas | 3,9 de 6 | 3% | 9,9 | 434 |
| **só a Margem** (a mais rasa) | **6,0 de 6** | 0% | 10,0 | **206** |
| **só o Abismo** (a mais funda) | **0,0 de 6** | **100%** | 3,4 | 278 |

**⚠️ E É ESSA TABELA QUE FAZ O MINIJOGO TER JOGO.** A Margem não machuca ninguém e paga 206; o
Abismo paga mais por peixe e **varre o time em 100% das vezes**. Antes, com um pokémon só, a escolha
da zona era só "quanto vale este peixe" -- agora ela é "quanto disso meu time aguenta".

#### ⚠️ O TIME É O `save-slot-card` DA LIGA, e só de quem tem as 8 insígnias

*"a mesma tela de time para ser escolhido quando o usuário tem que escolher um time para inscrever
na liga clássica"* e *"para ambos os jogos, só pode escolher um time vencedor das 8 insígnias"*.

- **O CARD É O MESMO** (a estrela da média mais a fileira dos seis): é por ele que o jogador
  reconhece um time na home e na Liga, e um desenho próprio obrigaria a reaprender a ler.
- **A PORTA É O `savesCampeoes()`**, a MESMA da Liga, do Ginásio da Cidade e da Batalha Online --
  não uma regra nova. E **quem valida é a AÇÃO**: um slot forjado no console levaria um time sem
  insígnia pro duelo.
- **⚠️ O PICKER DE POKÉMON PAGINADO MORREU**, nos dois jogos. Na Corrida o `corridaToggle` ficou
  **INERTE no revezamento** (e recusa por dentro, não por tela apagada); na Pescaria ele saiu.
- **A CORRIDA INDIVIDUAL NÃO PRECISOU DE NADA**: o `towerEligiblePokemon` tem laço próprio com um
  `if(badges < 8) continue` e já era campeão-só. Fica dito pra o dia em que alguém unificar os dois.

#### ⚠️ O ITEM EQUIPADO NÃO ESTAVA CHEGANDO -- o slot não viajava

Achado ao escrever a trava, não relatado. A chave do item é **`slot:raiz-da-linha`**, e o
`pescariaTimeDoSlot` montava as instâncias a partir do `sv.team`, que **não carrega slot nenhum**.
Resultado: o `equiparItens` procurava com slot **nulo** e a poção que o jogador equipou no parceiro
**simplesmente não valia ali**, em silêncio.

Hoje o slot é carimbado na montagem, e o `pescariaBatalhar` deixou de passar um `slotPadrao` que era
`meu.slotDaConta` -- de um POKÉMON, de quando o parceiro era um só. Há trava de ponta a ponta.

#### ⚠️ O MEDALHA_DO_POSTO ERA LOCAL, E O RANKING QUEBRARIA NA PRIMEIRA LINHA

Ele nasceu `const` **dentro** da tela de resultado da Corrida (17/09), e o ranking novo o lê. O
`pescariaRankHtml` estourava com **`ReferenceError`** na primeira linha que desenhasse -- ou seja,
**só quando alguém pontuasse**: a caixa vazia e a de "carregando" nunca chamam o desenho da linha,
então nem a tela nem o teste de HTML encostavam nisso.

Ele subiu pro escopo do módulo, com a razão escrita, e a indexação foi acertada (**a tabela é
0-based** e o ranking é 1-based).

#### O RANKING: um documento por jogador, e o recorde SÓ SOBE

*"Na primeira tela, crie um ranking das maiores pontuações de pesca"*.

- **⚠️ QUEM GRAVA É O SERVIDOR**, e o `firestore.rules` fecha a coleção (`allow write: if false`,
  inclusive pro dono): pontuação é placar público, e uma linha no console poria qualquer número no
  topo. É a mesma regra do `globalBoss`.
- **É UM DOCUMENTO POR JOGADOR, com o MELHOR resultado dele** -- não um por partida. Assim a coleção
  tem no máximo uma linha por conta, e o ranking é "os melhores JOGADORES", não "as melhores
  partidas do mesmo jogador".
- **O RECORDE SÓ SOBE**, em transação: uma partida ruim depois de uma boa não apaga a boa, e duas
  abas não gravam por cima uma da outra.
- **ZERO NÃO ENTRA**: um documento de quem nunca pontuou é linha morta, e um "0 pontos" no top não
  diz nada.
- **O NOME FICA DENORMALIZADO**, como no ranking do Mew: sem isso, ler o top 10 custaria 10 leituras
  a mais em `users/` toda vez que alguém abrisse a tela. O preço é o de lá -- quem troca de nome só
  aparece com o novo depois da próxima partida.
- **⚠️ E O MEU RESULTADO VEM JUNTO MESMO FORA DO TOP**: quem está em 14º abriria a tela e não veria
  **nada seu** -- e o próprio recorde é justamente o que ele mais procura ali.
- **AS MEDALHAS SÃO AS DO PÓDIO DA CORRIDA**, desenhadas; da 4ª em diante sai o número.
- **O ENVIO É BEST-EFFORT dos dois lados**: um ranking que não carrega é uma caixa a menos na tela,
  e um envio que falha é um recorde perdido -- nenhum dos dois pode derrubar o duelo. O erro oferece
  "tentar de novo" e o botão de começar continua lá.
- **O QUE VAI É O QUE O MOTOR CONTOU** (o `pontos` do pescador), nunca um número montado na tela.

#### O MAPA DA ILHA, E ELE APARECE ANTES DO DUELO

*"quero exatamente como está lá, com uma imagem de uma ilha e os 6 botões em volta"* e *"nessa
primeira tela apareça o mapa com as localizações, para os usuários já conseguirem visualizar antes
os pontos"*.

- A grade de três colunas virou a **ilha do protótipo** (o SVG dele, byte a byte) com os seis pontos
  **por cima**, cada um em `--x/--y`.
- **NO SETUP ELE É ILUSTRAÇÃO**: os pontos viram `<span>` (um botão que não faz nada convida um
  toque que não responde) **e o (i) continua clicável** -- ele é justamente o que essa tela tem a
  oferecer, porque escolher o time sabendo o que mora em cada ponto é a decisão que ela pede.
- **⚠️ O ABISMO SUBIU DE 80% PRA 76%, e é a única posição que difere do protótipo.** A razão é
  medida: os **rótulos são de tamanho FIXO** (a 77px do topo do ponto) e o **mapa ESCALA**. Com os
  360px do protótipo o rótulo do 6º cabe; com os **282px** que sobram numa tela de 320 ele passa
  **8px** do fim do mapa e o recorte do container o **corta** -- conferido no navegador, e o
  protótipo tem o mesmo defeito nesse tamanho. Depois: **nenhum rótulo cortado**.

#### O ADVERSÁRIO TEM NOME, E UM TIME

*"Troque o nome de NPC pescando pelo nome de algum personagem pescador da série"* e *"o adversário
também vai ter um time de 6 pokemons"*.

- **`PESCARIA_NPC_NOME` = "Pescador Wilton"** -- a convenção da casa é classe + nome (os NPCs da
  Torre são classes puras como `Pescador`). Ele vive numa constante: trocar é **uma linha**.
- O time dele são **6**, Lv.65, BST > 500, **sem repetir linha evolutiva** (a regra do encontro
  selvagem e do montador) e **sem os quatro INTOCÁVEIS** -- que não é zelo: Mewtwo, Lugia e Ho-oh são
  **BST 680**, ou seja o filtro de BST os pegaria PRIMEIRO.
- **⚠️ E A LINHA DA REGRA DO SORTEIO SAIU** (*"sorteado entre os de BST acima de 500"*): ela contava
  o MOTOR, e o que o jogador precisa ver ali é QUEM ele vai enfrentar -- a fileira dos seis mostra.

#### O REVEZAMENTO DA CORRIDA É O TIME INTEIRO

*"ao invés de escolher 3 pokemons de qualquer time, vai ter que escolher 1 time e o revezamento vai
ser entre os 6 do time"*. `CORRIDA_TRECHOS` foi de 3 pra **6**.

**⚠️ E ISSO DOBRA A PROVA DUAS VEZES, não uma** (medido, 12 corridas de cada):

| | antes | hoje |
|---|---|---|
| distância | 900m | **1.800m** |
| duração | ~71s | **249s** |
| Speed médio de quem corre | os **3 melhores** do time (150,0) | **os seis** (117,7) |

A segunda metade é a que não se vê no número da distância: **não dá mais pra escolher a dedo os três
mais rápidos**. No time medido, os três melhores somam Speed 150 de média e os seis somam 117,7 --
porque o Snorlax Lv.58 corre a **39**. Ou seja, a prova ficou 2× mais longa E ~22% mais lenta.

**Se 4 minutos incomodarem, a régua é o `CORRIDA_METROS`** (300m por trecho): 150m devolveria a
prova pros ~125s, mantendo os seis integrantes -- que é o que o pedido pede. Mexer no
`CORRIDA_TRECHOS` desfaria o pedido.

#### O QUE ISSO CUSTOU NA DIFICULDADE DO JOGO: NADA, e está conferido

As duas impressões -- **MOTOR** e **DIÁRIO** -- são **idênticas** em 900 batalhas semeadas, contra o
build de antes desta leva. **E o instrumento é sensível**: a mesma medição com a velocidade
des-escalada muda os dois hashes. Tudo aqui é apresentação mais um **chamador novo** do motor.

#### AS TRÊS LIÇÕES DE TESTE QUE SAÍRAM DAQUI

1. **⚠️ DOIS PAINÉIS MEDIAM UM TIME NO CHÃO.** Com o desgaste, o time cai na 3ª batalha -- e os
   laços de 1.200 e 2.500 voltas seguiam rodando contra seis pokémon mortos, ou seja **medindo
   nada**. Um deles falhava **1 rodada em 2** achando "1 confronto" onde devia achar dezenas: o pior
   tipo de teste que existe, o que passa quase sempre. Eles passaram a **curar o time a cada volta**
   -- ali se mede a BATALHA, não o desgaste.
2. **⚠️ NOVE FIXTURES MONTAVAM O PAR À MÃO.** Viraram uma forma só; com nove cópias, a próxima
   mudança no `pescariaNovoPescador` teria que ser feita nove vezes.
3. **⚠️ UMA CLASSE DE BOTÃO SEM CSS** (`pesc-trocar`) foi pega pela varredura de classes fantasma --
   ela não fazia nada, porque o `.btn` da casa já traz a margem. Letra morta sai.

#### AS SETE DA PESCARIA (20/09/2026) -- a leva do placar quebrado

**⚠️ 1) O `(i)` NÃO ABRIA NADA NA PRIMEIRA TELA.** O estado sempre mudou (`pescaria.zonaAberta`) e
o `render()` sempre rodou -- o que faltava era o `return` do **SETUP** desenhar o modal. Ele só
estava no `return` do DUELO. O `(i)` é clicável nas duas telas de propósito (é justamente o que o
setup tem a oferecer), e a metade que faltava era a de baixo.

**⚠️ 2) O NÚMERO DO PONTO SAÍA COLADO NA ESQUERDA -- só na primeira tela, e com o MESMO CSS.**
No duelo o ponto é um `<button>`, e botão centraliza texto pelo **estilo de fábrica do navegador**;
na primeira tela ele é um `<span>`, que **não** centraliza. Hoje o `text-align:center` é explícito.

**⚠️ 3) UM PONTO, UM PESCADOR** (*"quando o adversario de pesca entrar em um ponto, nenhum outro
pode entrar até que acabe a pesca dele"*).

- Quem responde é o `pescariaQuemEsta(k)`, e ele pergunta **pela ZONA, não pelo id da**
  **oportunidade**: no instante da fisgada o `op` sai do `pescaria.oportunidades` (ele foi PESCADO)
  e quem continua ali é o **pescador**. Perguntando pelo id, o ponto **reabriria justamente no meio**
  **da pesca** que a regra protege.
- **Quem recusa é a AÇÃO**, não a tela apagada: um toque no quadro em que o outro entra chegaria
  antes do `disabled` do pintor. Vale pros dois lados -- o NPC passa pela mesma função.
- **E a TELA fecha o ponto** (classe `ocupada`): sem isso ele continuava piscando e chamando pra um
  lugar onde a ação ia recusar, que é pior que um ponto apagado. **⚠️ A regra vem DEPOIS da `.viva`**
  **e da `:disabled`** -- as três têm a mesma especificidade, e quem vence é a última.

**⚠️ E A DISPUTA VIROU LETRA MORTA NA MESMA LINHA.** Com um ponto por pescador, dois nunca estão no
mesmo -- então saíram juntas a etiqueta `DISPUTA!` da zona, a do chip do peixe, a função que a
respondia e o laço que tirava do ponto quem chegava depois. Eram **quatro formas da mesma**
**mecânica**, e as quatro morreram de uma vez.

**⚠️ 4) O PLACAR DE CIMA QUEBRAVA, e a causa era reuso demais.** Ele chamava o
`placarDoTreinador` com o nome **VAZIO** -- e aquilo devolve o **CHIP INTEIRO**, com borda, fundo e
`flex:1 1 0`. Dentro da coluna do placar isso virava uma **moldura alta e vazia** (o risco vertical
do print) que ainda **comia a margem esquerda** do texto de estado ("rocurando oportunidade").
Hoje ali vão só as pokébolas (`pokebolasHtml`), e o chip continua existindo inteiro pra quem o quer
assim -- a batalha, a jornada, a Torre.

- **E O PINTOR PASSOU A REPINTÁ-LAS**: ele repintava os pontos e o estado, mas não elas -- então
  uma morte NO MEIO da batalha só aparecia no `render()` seguinte. Com a fila animada isso ficou
  visível.

**5) O NOME DO TREINADOR, NUNCA "VOCÊ"** -- ele aparecia em **seis** pontos da tela, e a conta cai
num lugar só (`pescariaMeuNome()`, que lê o `game.trainerName`). Sem save aberto ele volta pro
"Você", que é o que o resto do jogo faz quando não há nome.

**6) SAIU O "TESTE ADMIN"** das quatro telas. A pescaria continua se identificando pelo nome.

**7) O LOG DO FIM: O QUE CADA UM PESCOU** (*"somente pokemons, level e pontos que cada treinador
fez"*). Um bloco por treinador, com o nome e o **total** no topo, e uma linha por captura --
pokémon, **Lv.** e **pontos**.

- **⚠️ É EMPILHADO, e não duas colunas**: a 320px uma coluna de captura tem ~140px e o nome com o
  nível não cabe. Empilhado, cada linha tem a largura toda.
- **A LINHA É A `.pesc-hist` QUE JÁ EXISTE** -- a mesma dos "Últimos encontros" do duelo. Ela já é
  sprite + texto + pontos, já está medida, e reusá-la é o que faz as duas listas se lerem igual em
  vez de o jogador reaprender no fim da partida.
- **⚠️ E O HISTÓRICO DEIXOU DE SER CORTADO EM 8.** Ele guardava só os oito últimos porque a tela do
  DUELO mostra "Últimos encontros" -- e o log do fim precisa de **todos**. O corte foi pra quem o
  quer cortado (`PESCARIA_HIST_NA_TELA`); uma segunda lista divergiria da primeira no dia seguinte.
- **A ORDEM É A DA PESCARIA** (o 1º peixe em cima): o `historico` empilha ao contrário.

**Medido a 320px, no navegador:** o placar em **75px** com 6 bolas de cada lado, sem chip e sem
corte no texto; o log do fim em **487px** (3 capturas + 2), nenhum nome truncado; e **nenhuma das
21 telas rola pro lado**.

**CONFERIDO QUE NÃO É MOTOR:** as duas impressões continuam **idênticas** em 900 batalhas semeadas.

Conferido que as travas acusam, uma a uma: **2** falhas sem o modal no setup, **1** sem o
`text-align`, **6** sem a guarda do ponto ocupado, **1** com o chip de volta no placar, **1** com o
"VOCÊ" de volta, **3** com o "TESTE ADMIN" e **9** sem o log do fim.

#### ⚠️ E OS COMENTÁRIOS SE ACUSARAM DE NOVO -- a sétima vez, no mesmo dia da sexta

Três comentários meus citavam ao pé da letra os nomes que acabavam de sair (`DISPUTA!`, `DISPUTADO`,
"pescou primeiro"), e as travas que cobram a remoção **acusaram o próprio comentário**. Um deles era
pior: ele **descrevia a mecânica removida como se ela existisse** -- texto caduco no mesmo commit
que o tornou caduco.

A regra é a de sempre aqui, e ela já tem sete casos: **comentário não reproduz o que saiu**. O
`index.html` é publicado inteiro, e a varredura seguinte não distingue o código do comentário.
#### ⚠️ A LUPA DO iOS NO BOTÃO DE PUXAR (20/09/2026)

Reportado: *"quando eu seguro o botão SEGURE PARA PUXAR, por estar em uma pagina web, fica
aparecendo a lupa de zoom e selecionando o texto do botão, e isso ta bagunçando e complicando a
pescaria"*.

**⚠️ O `user-select:none` SEM PREFIXO NÃO BASTA NO SAFARI, e NADA nele desliga a LUPA** -- quem
faz isso é o `-webkit-touch-callout:none`. As duas estavam no protótipo e **se perderam na**
**portagem**: conferido, o `-webkit-touch-callout` não aparecia **uma vez no jogo inteiro**.

- **O `-webkit-tap-highlight-color:transparent` FOI JUNTO**, e ele é do mesmo problema: é a caixa
  cinza que o iOS põe **por cima** do botão enquanto o dedo está nele -- e aqui o dedo fica
  **segundos**, cobrindo justamente o amarelo do `.puxando`, que é a única pista de que a linha
  está sendo recolhida.
- **⚠️ ELAS FICAM SÓ NO BOTÃO, e não no `body`.** Este é o **único** botão do jogo que se SEGURA
  (o `onpointerdown` aparece UMA vez no arquivo inteiro). Globais, elas tirariam a seleção de texto
  de tudo -- e há coisa no jogo que se **copia**, como o código de treinador.
- O `touch-action:none` que já existia continua: sem ele, segurar e mexer o dedo rola a página e o
  navegador **cancela** o `pointerdown` -- a linha soltaria sozinha no meio do puxão.

**⚠️ E NENHUM TESTE DE NAVEGADOR CONSEGUE PROVAR ISSO -- a trava tem que ler o ARQUIVO.** O
`-webkit-touch-callout` é do WebKit, e o **Chromium DESCARTA a declaração ao parsear**: conferido,
ela some do CSSOM (`cssRules` devolve a regra sem ela) e o `getComputedStyle` devolve string
**vazia**. Uma trava de navegador daria **falso negativo** -- ela não consegue distinguir "a regra
está lá" de "a regra foi removida".

#### ⚠️ E O COMENTÁRIO ABSORVEU O DEFEITO RELIGADO -- a sexta vez, e a pior

O comentário que eu escrevi ao lado da regra **reproduzia o CSS do protótipo ao pé da letra**. Na
conferência de acusação, o `replace` que remove a declaração pegou **o comentário em vez da regra**
-- e a trava **passou com o defeito de volta**, relatando zero falhas.

Este projeto já pagou isso cinco vezes (o nome de líder na bifurcação, o código velho na trava do
`slotDaConta`, a palavra "Máquina", a interpolação da faixa de update, o ramo morto do
`pescariaNpcPuxa`) -- **e nas cinco o comentário acusava o que estava certo**. Esta é a primeira em
que ele faz o contrário: **ele mente pro TESTE, escondendo um defeito real**.

Hoje a trava cobra as duas coisas de uma vez, e com a conta mais simples que existe: **a declaração
aparece UMA vez no arquivo inteiro**. Isso pega o comentário que a reproduz E a regra espalhada pro
`body`, sem precisar de uma regex sobre seletores -- e a primeira versão, que era exatamente essa
regex, **não acusava nada**.

Conferido que ela acusa: **2** falhas sem as duas `-webkit-`, **1** sem o realce, **1** sem o
`touch-action` e **1** com a regra espalhada pro `body`.
#### ⚠️ E A TELA PARAVA NO PRIMEIRO CONFRONTO -- o defeito que o time de 6 criou

Reportado no mesmo dia: *"eu lutei contra um tentacruel e meu pokemon morreu, porém ainda tinha
mais 5 para ser usado e a luta acabou"*.

**⚠️ O MOTOR SEMPRE ESTEVE CERTO, e isso foi PROVADO antes de mexer em qualquer coisa:** o
`simulateGymBattle` percorre o time conforme cada um cai, e devolvia os **6 confrontos**. Quem
parava no primeiro era a **TELA** -- ela lia `matchups[0]` e fechava.

**O estrago era maior que o incômodo:** os outros cinco **lutaram e apanharam de verdade** (o HP
deles some do save, porque a instância é a mesma), e o jogador não viu nenhum deles. O log do fim
trazia **UMA linha de seis**.

- **⚠️ ELE NASCEU COM O TIME DE 6, algumas horas antes.** Com um parceiro só, `matchups[0]` **era**
  a batalha inteira -- a linha estava certa no dia em que foi escrita e virou defeito no dia em que
  a pescaria deixou de ser 1x1. É a mesma família do `MEDALHA_DO_POSTO` e do slot do item, que
  saíram na mesma leva: **o que quebra numa mudança dessas é o que pressupunha o modelo antigo**.
- **HOJE `matchups` É A FILA E `matchup` É O DE AGORA.** Os **seis** leitores da tela (o placar, a
  barra, os dois quadros, a linha de status e o painel) continuam lendo "o confronto atual", que é
  o que eles sempre quiseram dizer -- quem anda é o `i`.
- **⚠️ ABRIR UM CONFRONTO VIROU FUNÇÃO** (`pescariaAbrirConfronto`), e ela serve o PRIMEIRO e os
  SEGUINTES. Escrita duas vezes, a segunda esqueceria de zerar o `hit` -- e a tela abriria o
  confronto novo **anunciando um golpe do anterior**. É literalmente o "golpe fantasma" de
  09/09/2026, que nasceu de exatamente isso na jornada e levou o `abrirConfronto` a existir lá.
  O teste **lê o código**: um caso de comportamento passaria com as duas cópias.
- **A VIRADA REDESENHA A TELA** (`render()`), e ali isso é obrigatório: os **SPRITES trocam**, e
  sprite só muda num redesenho -- o `pescariaPintarArea` mexe na caixa de status e em mais nada.
  É o que a jornada faz no `loading` do `advanceReveal`, e a pausa é a **mesma de lá: 1200ms**
  (`PESCARIA_ENTRE_CONFRONTOS_MS`). Sem ela os sprites trocariam no mesmo quadro em que o anterior
  cai, e a fila pareceria um confronto só com o bicho mudando.
- **A FILA INTEIRA VAI PRO PRELOAD**, como na jornada: o 2º entra 1,2s depois do 1º acabar, e um
  sprite que só começasse a baixar ali apareceria **em branco** no quadro de entrada.
- **O LOG DO FIM LEVA A FILA INTEIRA**, do último pro primeiro -- o `pescaria.logs` é lido de trás
  pra frente na tela do fim, então empilhar na ordem deixa o confronto 1 acima do 2.
- **O PLACAR DE POKÉBOLAS ACOMPANHA SOZINHO**: ele lê `playerAliveBefore`/`After` do confronto
  ATUAL, então ele vai de 6 a 0 conforme a fila anda. Medido quadro a quadro.

**⚠️ E A FILA PARA QUANDO O PEIXE CAI** -- ela não segue até o 6º só porque o time tem 6. Quem
decide é o MOTOR; a tela só mostra o que ele lutou. Medido: contra um peixe que cai no 2º, a fila
tem **2 confrontos** e sobram **5 de pé**.

**⚠️ O PREÇO É TEMPO DE DUELO, e ele é grande** (20 batalhas por caso, medido na tela):

| | confrontos | tempo de tela |
|---|---|---|
| o caso comum (um peixe fácil) | 1,0 | **3,4s** |
| um peixe duro | 2,0 | 21,0s |
| **o time VARRIDO** (o caso do relato) | **6,0** | **28,4s** |

São **28s dos 90** do duelo. Antes o defeito os ESCONDIA -- a tela mostrava ~5s e os outros cinco
confrontos aconteciam invisíveis, ou seja o jogador **ganhava tempo por causa dele**. Hoje não
ganha, e é o certo: com o time varrido o duelo **acaba** de qualquer forma (a guarda dos dois times
no chão), então o tempo não é perdido -- é o fim da partida sendo mostrado.

**CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois dá o **MESMO hash** em
900 batalhas semeadas, no MOTOR e no DIÁRIO. Isto é apresentação inteira.

`tools/test-pescaria.js` tranca: o motor lutando a fila, a tela mostrando TODOS na ORDEM dele, o log
com uma linha por confronto, a fila CURTA quando o peixe cai no meio, e -- lendo o código -- o
`pescariaAbrirConfronto` zerando o `hit`/`passo`/barras, a virada com `render()` depois da pausa de
1200ms, e o preload da fila. Conferido que ele acusa: **2** falhas com a fila cortada no primeiro,
**1** sem o `render()` da virada e **2** com o log só do primeiro.
`tools/test-pescaria.js` tranca o time de 6 do adversário, o picker campeão, o desgaste (o HP que
nunca sobe, quem caiu que não volta, o time no chão que não pesca, os dois times que encerram), o
item equipado de ponta a ponta, o mapa nas duas telas e o ranking na tela. `tools/test-corrida.js`
tranca o revezamento por time e a porta das 8 insígnias. E `tools/test-pescaria-rank.js` é novo: ele
roda as duas callables contra o `fake-firestore` e **lê a regra como texto**.
Conferido que cada defeito religado acusa: **2** sem o `preservePlayerHp`, **1** sem a guarda do time
no chão, **2** sem o slot do item, **2** com o time de 1, **1** sem a porta das 8 insígnias na
Corrida e **2** com o toggle ativo no revezamento.

## A CORRIDA: O TRECHO DE 150 m E OS DOIS RANKINGS (20/09/2026)

Quatro pedidos numa leva: *"o revezamento troque para 150m cada pokemon, e atualize aqui nessa
tela tambem, tire o TESTE ADMIN la de cima. E tambem crie o ranking individual de 300m e o ranking
do revezamento, o tempo dos npc nao coloque no ranking, apenas dos treinadores"*.

### ⚠️ SÃO DUAS CONSTANTES, e o rótulo da tela ESTAVA MENTINDO

`CORRIDA_METROS` era uma só -- a individual E o trecho do revezamento. Com o trecho em 150 ela
encolheria a individual junto, e é ela que o ranking chama de *"individual de 300 m"*. Hoje são
`CORRIDA_METROS` (300, a individual) e `CORRIDA_METROS_TRECHO` (150, cada trecho), com quatro
ajudantes: `corridaMetrosDo(f)` / `corridaTotalDo(f)` recebem o FORMATO, e os sem sufixo leem o
`corrida.formato`.

**⚠️ O `Do(f)` NÃO É ENFEITE:** a tela de setup mostra os DOIS botões ao mesmo tempo, e lendo o
estado os dois rótulos mostrariam o tamanho da modalidade selecionada.

**⚠️ E O "atualize aqui nessa tela" ERA UM DEFEITO DE VERDADE:** o botão dizia **"Revezamento ·
900 m"** desde 20/09, quando a equipe virou o time inteiro -- e a prova era de **1.800**. Texto
fixo que descreve uma constante envelhece quando a constante muda; é a mesma família do "59
espécies" da ficha da Pokédex e do `Golpe repete entre 2-5x` dos multi-tapa. Hoje os dois rótulos
são derivados, e há trava cobrando que eles **não** estejam escritos à mão no arquivo.

**O PREÇO, medido** (12 provas de cada, mesmo time):

| | antes | hoje |
|---|---|---|
| distância do revezamento | 1.800 m | **900 m** |
| duração | ~249 s | **122,4 s** |
| por trecho | ~41 s | **~20,4 s** |
| a individual | 300 m, ~26 s | **igual** |

A previsão que este arquivo já tinha (*"150 por trecho devolveria os 900 m, com cada trecho em
~12 s"*) acertou a distância e **errou o tempo por trecho**: 12 s era a conta de um corredor
rápido, e a média de um time real cai em 20,4 s porque ele leva o Shuckle e o Snorlax junto.

### OS DOIS RANKINGS

⚠️ **É UM DOCUMENTO POR JOGADOR com as DUAS modalidades dentro** (`raceRanking/{uid}`, campos
`single` e `relay`), e o `merge` é obrigatório: um recorde no revezamento não pode apagar o da
individual. Cada campo é ordenado por conta própria, e **quem nunca correu uma modalidade não tem
o campo dela** -- o Firestore já o exclui daquele ranking, que é exatamente o certo.

- **MELHOR É MENOR**, e é a diferença pro ranking da pescaria: lá o recorde SOBE, aqui ele DESCE.
  O empate exato não regrava (não melhora nada e só gastaria uma escrita).
- **QUEM GRAVA É O SERVIDOR** e a coleção é `allow write: if false` **inclusive pro dono** -- tempo
  é placar público, e uma linha no console poria 0,01 s no topo. Mesma regra do `fishingRanking`.
- **⚠️ O TEMPO DO NPC NÃO ENTRA, e isso é por CONSTRUÇÃO e não por filtro:** o que chega na callable
  é UM tempo, e ele é gravado no documento de **quem chamou**. O adversário não tem conta e não tem
  como ter documento. A trava manda um `tempoNpc` junto de propósito e cobra que nada nasça pra ele.
- **Zero, negativo, texto, infinito e absurdo não entram** -- um documento de quem não completou é
  linha morta, e um tempo lixo no topo trancaria o ranking pra sempre.
- **O nome fica DENORMALIZADO**, como no da pescaria e no do Mew: sem isso o top 10 custaria 10
  leituras a mais em `users/`. O preço é o de lá -- quem troca de nome só aparece com o novo depois
  da próxima corrida.
- **AS DUAS LISTAS VÊM NUMA CHAMADA SÓ**: a caixa mostra a da modalidade escolhida, e trocar de
  modalidade não pode custar outra ida ao servidor.
- **E O MEU TEMPO VOLTA JUNTO mesmo fora do top** -- quem está em 14º abriria a tela e não veria
  nada seu, que é justamente o que ele mais procura ali.

**NA TELA** a caixa aparece no **setup** e no **resultado**, e reusa a linha do ranking da pescaria
(`pesc-rank-*`) com as medalhas do pódio: reusá-la é o que faz os dois rankings se lerem igual em
vez de o jogador reaprender.

- **⚠️ ELE NÃO É PEDIDO DURANTE A CORRIDA**: ali o laço está pintando, e uma resposta de rede
  chamaria `render()` no meio da animação -- a regra da casa, que já custou três defeitos.
- **⚠️ O "Recorde novo!" ZERA NA LARGADA**, senão ele gruda na corrida seguinte. E ele guarda a
  MODALIDADE, não um booleano: um recorde na individual não pode piscar no ranking do revezamento.
- **⚠️ E A LEGENDA É O TIME NO REVEZAMENTO E A ESPÉCIE NA INDIVIDUAL.** Os seis nomes juntos medem
  mais que a coluna inteira a 320px -- ela truncava no segundo pokémon e não dizia nada.
- **⚠️ O TÍTULO SAIU DO `<h2>`**: a 320px "Melhores tempos · Individual 300 m" na fonte de PIXEL
  quebrava em duas linhas com o **"m" sozinho embaixo**. O `<h2>` ficou com o nome curto (como o
  "Melhores pescarias") e a modalidade desceu pra uma linha de texto.
- **E o rótulo do botão usa espaço FINO entre o número e a unidade**: com o espaço normal ele saía
  "Revezamento · 900" numa linha e "m" na outra.

**Medido a 320px, no navegador, nas três telas:** **nenhuma rola pro lado**, todo `<h2>` em uma
linha só, nenhum tempo truncado, e a página em **873px** no setup.

### ⚠️ E O "TESTE ADMIN" SAIU das duas telas da Corrida

A Pescaria já tinha tirado o dela horas antes. O modo continua se identificando pelo nome.

### AS TRÊS LIÇÕES DE TESTE QUE SAÍRAM DAQUI

1. **⚠️ CINCO TRAVAS DO REVEZAMENTO MEDIAM O NÚMERO, NÃO A REGRA.** Elas tinham **300 e 600**
   escritos à mão -- as marcas de troca --, e caíram todas de uma vez quando o trecho virou 150,
   **sem nada estar errado**. A correção não foi trocar os números: foi elas lerem a CONSTANTE
   (`M1`/`M2` derivados do `CORRIDA_METROS_TRECHO`), que é o que faz a próxima mudança de régua
   não derrubar cinco travas certas. É a mesma família das travas que "mediam a DURAÇÃO e não a
   regra" no sono e na paralisia.
2. **⚠️ UMA TRAVA MINHA PASSOU COM O DEFEITO RELIGADO**, e a causa foi o fixture: o
   `corridaCarregarRank` já tinha a lista em mãos, então ele voltava pela guarda DELE (lista já
   lida) e não pela guarda que a trava diz medir. Hoje ela zera a lista antes, e tem a metade do
   controle junto ("parado, ele PEDE") -- sem ela, a primeira passaria com a chamada removida.
3. **⚠️ O `orderBy` DO FAKE NÃO EXCLUÍA QUEM NÃO TEM O CAMPO**, e o Firestore de verdade exclui.
   Isso é o dublê sendo **mais permissivo que a produção** pelo lado que mais engana: no ranking,
   quem nunca correu o revezamento aparecia nele com tempo **0**. Um teste escrito em cima disso
   acreditaria numa lista que o servidor nunca devolve. É a mesma lição do `undefined` que matou as
   duas ligas, do `arrayUnion`, do `getAll` e do `count()`: **o fake tem que doer onde a produção
   dói** -- e aqui ele tinha que EXCLUIR onde ela exclui.

**CONFERIDO QUE NÃO É MOTOR, por impressão:** as duas -- MOTOR e DIÁRIO -- são **idênticas** em 900
batalhas semeadas. A mudança de metragem é de apresentação e de física do minijogo, que não passa
pelo motor de batalha.

`tools/test-corrida.js` ganhou **39 pontas** novas (as duas constantes, os rótulos
derivados e não escritos à mão, o "TESTE ADMIN" fora, o envio com UM tempo só, quem não completou
não enviando, a caixa seguindo a modalidade, o ranking não sendo pedido durante a corrida, e os
três estados da caixa) e `tools/test-corrida-rank.js` é novo, com **44 pontas** no
servidor: o acesso, a regra lida como texto, "melhor é menor", o `merge`, o que não entra, os dois
tops ordenados, quem não correu não aparecendo, o meu tempo fora do top, e o tempo do NPC não
tendo por onde entrar.
**Conferido que elas acusam: 16 de 16 defeitos religados** derrubam pelo menos uma trava.

#### AS CINCO DA PESCARIA (20/09/2026) -- a leva do relógio que parava

**⚠️ DUAS DAS CINCO SÃO A MESMA FAMÍLIA, e é a QUINTA vez que ela aparece:** o laço do jogo
**não chama `render()`** -- de propósito, porque ele recriaria a boia, os seis pontos e o botão de
puxar 60 vezes por segundo, e o `pointerdown` se perderia no meio do toque. Então **tudo que muda
DURANTE a partida tem que ser trocado pelo PINTOR**. As quatro anteriores: o modal da contagem da
Corrida (18/09, reportado DUAS vezes), os chips de trecho do revezamento (20/09 de manhã), o quadro
vazio da corrida (20/09 à tarde) e, agora, o mapa e o azul do ponto.

##### ⚠️ O RELÓGIO PARAVA COM A ABA OCULTA

Reportado: *"quando eu saio da tela, troco de aba ou minimizo, o relógio esta pausando, isso nao
deve acontecer"*.

O laço somava `dt` de quadro em quadro -- e o `requestAnimationFrame` **PARA** quando a aba não
está visível. O duelo inteiro congelava: voltando depois de 30 s, o relógio marcava os mesmos 12 s
e o adversário não tinha pescado nada.

- **HOJE O RELÓGIO É O REAL** (`inicioReal`, carimbado no primeiro quadro): o alvo é
  `(ts - inicioReal) / 1000`, e o laço roda em VOLTAS até alcançá-lo. Medido: `1,00s -> 21,00s`
  depois de 20 segundos de aba oculta.
- **⚠️ MAS O PASSO DA SIMULAÇÃO CONTINUA LIMITADO a 0,1 s**, e isso não é conservadorismo: a física
  é POR PASSO (a tensão sobe por segundo, a boia afunda num instante) -- entregar 20 s num `dt` só
  daria outro resultado, com a linha arrebentando sem ninguém ter tocado.
- **⚠️ E O NÚMERO DE VOLTAS TEM TETO** (`PESCARIA_PASSOS_MAX`, derivado da duração + a prorrogação):
  sem ele, uma aba esquecida por uma hora tentaria **36.000 iterações num quadro só**. O excedente
  é descartado pelo próprio fim -- medido, uma ausência de 10 min **encerra o duelo** em vez de
  travar.
- **⚠️ E A TRAVA DIRIGE O LAÇO, saltando o tempo -- ela não lê o código.** A versão velha lia
  (`/Math\.min\(0\.1,/`) e por isso **não conseguia distinguir** *"o passo é limitado"* (que continua
  sendo, e tem que ser) de *"o tempo é jogado fora"* (que era o defeito).

##### ⚠️ O MAPA SOME ENQUANTO A PESCA ACONTECE

Pedido: *"quando o usuario clicar em algum ponto de pesca e exibir a bóia, deixe o quadro da ilha
invisivel, até acabar o confronto contra o pokemon pescado ou arrebentar a linha"*.

Fora do `parado` **não há nada pra decidir no lago**: todos os pontos já estão fechados pelo
`posso`, e o que importa está no painel de baixo (a boia, a tensão ou a batalha).

- **⚠️ E O `hidden` PRECISA DA REGRA `.pesc-mapa[hidden]{display:none}`.** O elemento é
  `display:block`, e **qualquer `display` do autor anula o `hidden` da folha do NAVEGADOR**, que
  tem a menor prioridade que existe. **Provado no navegador, desligando só essa regra:** com ela o
  mapa é `display:none` e mede 0px; sem ela ele volta a `block` com **298px** na tela. É
  literalmente o defeito do modal da contagem da Corrida, que custou dois relatos porque a primeira
  correção mexeu na marcação e não no CSS.
- **⚠️ E O MAPA GANHOU `id`:** o pintor o achava por `querySelector('.pesc-mapa')`, e **todo o resto
  dele usa `getElementById`** -- varrer a árvore por classe a cada quadro pra achar o mesmo elemento
  é o caminho caro, e o barato já existia.
- **Medido a 320px:** a tela cai de **800 para 614px** enquanto a boia está na água.

##### ⚠️ O PONTO DE ONDE EU SAÍ FICAVA AZUL

Reportado: *"após eu entrar em um ponto e fazer todo o ciclo dele, quando volta para o mapa, o ponto
que eu estava antes esta ficando com um azul mais vivo ... inclusive se tem peixe naquele ponto, ta
ficando amarelo só nas bordas"*.

A classe `minha` era posta no `render()` e o pintor **não a tirava** -- então o azul ficava preso no
ponto de onde o jogador já tinha saído.

**⚠️ E A SEGUNDA METADE DO RELATO É CONSEQUÊNCIA DA ORDEM DA FOLHA:** a regra da `minha` vem
**DEPOIS** da `viva`, então num ponto com peixe sobrava só a borda amarela. Com a `minha` fora, a
`viva` volta a pintar o fundo -- medido: `rgb(42,95,214)` (azul) → `rgb(255,211,71)` (o amarelo da
`viva`).

##### O QUADRADO VAZIO SAIU DO "NENHUM TIME ESCOLHIDO"

Ele era um lugar **RESERVADO pra um sprite que ali não existe** -- sem time escolhido não há bicho
pra mostrar, e o tracejado vazio se lia como algo faltando carregar.

**⚠️ E A REGRA DE CSS SAIU JUNTO** (`.pesc-vazio`): regra sem usuário é **letra morta**, a mesma
decisão que a trava dos selos cobra (*"todo desenho tem chamador"*) e que tirou o `pesc-trocar`.

##### OS 18 PESCÁVEIS NOVOS: DE 12 PRA 28 ESPÉCIES

Foram os pedidos, distribuídos pelas seis zonas por **profundidade** -- e é isso que mantém a escada
de prêmio (20 a 83 pts) honesta. Medido, o BST médio por zona:

| Margem | Juncos | Corais | Cachoeira | Gruta | Abismo |
|---|---|---|---|---|---|
| 253 | 319 | 332 | 416 | 460 | **520** |

- **Os evolutivos ficam nas zonas fundas** (Kingdra, Starmie, Poliwrath, Omastar, Kabutops no
  Abismo; Lanturn, Mantine e Dragonair na Gruta) e as formas base nas rasas (Marill, Remoraid e
  Poliwag na Margem).
- **⚠️ O PESO NÃO PRECISA SOMAR 100** -- o `chancesDaZona` normaliza --, mas toda zona precisa de
  soma **maior que zero**, senão o sorteio divide por zero. Há trava.


##### ⚠️ E OS 18 TRANSFORMARAM UMA TRAVA ESTÁVEL NUM FLAKE

A trava do **moveset do peixe** (19/09) rodava as seis zonas com o time Lv.55-70 e contava quantas
de 1.200 batalhas tinham um status por ataque. Ela caiu de **5,5 para 2,25 eventos** quando o pool
cresceu -- e com média 2,25 a chance de dar ZERO é `e^-2,25 = 10%`: ela passou a **falhar uma
rodada em dez, sem nada estar errado**. Pego rodando a bateria cinco vezes, não por relato.

**A CAUSA É ARITMÉTICA E ERA PREVISÍVEL:** os novos das zonas rasas (Marill, Remoraid, Poliwag,
Chinchou, Staryu) são fracos, o parceiro Lv.70 **mata em um golpe em 90% das vezes** na Margem, e
**status por ataque precisa que o golpe do PEIXE saia**.

**⚠️ MAS O CONSERTO NÃO É AUMENTAR A AMOSTRA -- é a trava medir a REGRA e não a FREQUÊNCIA.** E a
medição achou por que a taxa é estruturalmente baixa: **o motor escolhe pelo DANO**, então quase
todo golpe de status perde a vaga. Varrendo as 28 espécies pescáveis no nível médio da zona delas,
**só TRÊS escolhem um golpe que causa status**:

| | escolhe | vira status |
|---|---|---|
| **Poliwag Lv.35** | Golpe de Corpo | **51%** |
| **Chinchou Lv.35** | Faísca | 46% |
| Gyarados Lv.53 | Salto | 26% |

**É a mesma conclusão do Rolamento e dos golpes de prender: o motor está certo em recusar** -- um
Ferrão Venenoso de poder 15 nunca vai ganhar de uma Hidro Bomba, e é por isso que Tentacruel,
Kingdra, Starmie e Poliwrath dão **zero** mesmo com 4,9 golpes por batalha.

⚠️ **E DOIS DOS TRÊS DONOS SÃO NOVOS** (Poliwag e Chinchou entraram nesta leva): os 18 não
enfraqueceram a mecânica, eles **acrescentaram** donos de status. O que caiu foi a taxa MÉDIA do
painel, porque entrou muito peixe fraco nas zonas rasas.

Hoje a trava é **dirigida** -- Snorlax Lv.45 (um parceiro que não mata em um golpe) contra um
Poliwag Lv.35 -- e ela cobra **duas coisas separadas**, que é o que a versão velha não conseguia
distinguir:

1. **o peixe ESCOLHE o golpe de status que ele leva** (300 de 300 com Golpe de Corpo) -- sem isso um
   moveset vazio daria zero pelos dois motivos e a trava não saberia qual;
2. **e o status ACONTECE** (158 de 300, determinístico em 16 rodadas).

**Conferido que ela acusa:** removendo o `equiparNpc` do peixe, as duas viram `0 de 300`.

##### O QUE ISSO CUSTOU

**Nada no motor:** `MOTOR 25d909ef2d79 / DIARIO c35ba4008568`, idêntico em 900 batalhas semeadas.

##### ⚠️ E DUAS LIÇÕES DE FERRAMENTA SAÍRAM DAQUI

1. **⚠️ O `querySelector` DO SANDBOX DEVOLVIA UM STUB NOVO A CADA CHAMADA** -- exatamente a
   armadilha que o `getElementById` já teve e que foi consertada em 12/09. O pintor escrevia
   `hidden` num descartável e a trava, chamando de novo, recebia outro: **6 falhas num código que
   estava certo**. Hoje ele lembra, como o irmão.
2. **⚠️ `function pescariaPintar` É PREFIXO DE `pescariaPintarArea`**, que vem **600 linhas antes**
   no arquivo -- a fatia da trava começava na função errada e acusava o que estava certo. É a
   armadilha do **padrão largo demais**, a mesma das regex do `mlog-mais`, do `matchup-row` e da
   fase `correndo` que o Resgate roubou da Corrida. Hoje ela ancora no parêntese, com um `ok()`
   cobrando o tamanho da fatia.

`tools/test-pescaria.js` foi a **363 pontas**, 31 delas novas: o quadradinho e a regra órfã, o
relógio real (o laço dirigido de verdade, o teto de voltas e a ausência de 10 min), o mapa nos cinco
estados mais o `[hidden]` no CSS, o azul saindo e o ponto com peixe acendendo inteiro, e os 18 com o
BST subindo por zona -- mais a do moveset do peixe, reescrita pra ser dirigida.
**Conferido que elas acusam: 5 de 5 defeitos religados** (3, 6, 5, 2 e 1 falhas), e o do
`equiparNpc` do peixe derruba 6.


## AS DUAS DA CORRIDA (20/09/2026) -- o ranking e a faixa que acelera

### ⚠️ O NOME DO RANKING NÃO ERA NEGRITO -- e a causa era um ATALHO DE CSS

Pedido assim: *"no ranking dos melhores tempos, deixe o nome do treinador em Negrito e diminua 1
no tamanho da fonte"*.

**⚠️ MEDIDO A 320px ANTES DE MEXER, e a lista tinha DUAS FONTES:**

| a linha | elemento | fonte | peso |
|---|---|---|---|
| **com** time gravado (abre o modal) | `<button>` | **16px** | **400** |
| **sem** time gravado | `<span>` | 11,5px | 700 |

Ou seja a linha que virava botão saía **maior que a coluna dos tempos (12,8px) e NÃO era negrito**,
e a de baixo saía normal -- duas leituras na mesma lista.

**A CAUSA É O ATALHO `font`.** O `.corrida-rank-btn` usava `font:inherit`, e `font` **reescreve
peso e tamanho junto**; como ele é declarado DEPOIS da `.pesc-rank-nome` e tem a mesma
especificidade, ele ganhava o empate -- o `font-weight:700` e o `font-size:.72rem` da classe iam
junto com ele. O botão passou a herdar só o que um `<button>` precisa mesmo: a **família** e a
**entrelinha**.

- **⚠️ O "-1" É DERIVADO, nunca reescrito:** o `.pesc-rank-nome` ganhou um `--rank-nome`, e o
  ranking da Corrida usa `calc(var(--rank-nome) - 1px)`. Um `0.655rem` escrito à mão divergiria
  no primeiro ajuste do outro.
- **⚠️ E A REGRA É DO CONTAINER** (`.pesc-rank.corrida`), não do elemento: assim ela pega o
  `<span>` e o `<button>` de uma vez, e **a lista deixa de ter duas fontes**. A Pescaria usa a
  MESMA linha e não muda.
- **O ⓘ desceu junto** (de .66 pra .6rem): do mesmo tamanho do nome, ele deixaria de se ler como
  affordance.
- **⚠️ A TRAVA LÊ O CSS, e tem que ler:** peso e tamanho de fonte **não aparecem em asserção de
  HTML nenhuma** -- é a mesma razão pela qual a do `-webkit-touch-callout` da Pescaria lê o
  arquivo, e a mesma família do `[hidden]` que deixou o modal da contagem preso na tela.

**Medido a 320px depois:** as quatro linhas em **10,52px peso 800**, uniformes; a altura da linha
vai de 24/28/29 pra **23-24 em todas**; **nenhum nome truncando** ("TreinadorNomeComprido" passou a
caber); sem rolagem lateral.

### ⚠️ ENQUANTO O JOGADOR NÃO ERRA, AS FAIXAS ACELERAM

Pedido assim: *"enquanto o treinador não errar, ou seja, só ficar acertando o perfeito e bom, a
barra amarela e verde vai ficando mais rapida, e quando o treinador erra, ela volta a ficar na
velocidade normal"*.

**⚠️ ELA PUNE O PRÓPRIO SUCESSO, e é isso que a torna uma mecânica e não um prêmio:** cada acerto
encolhe o período das faixas em **12%** (`CORRIDA_SEQUENCIA_PASSO`), ou seja o alvo do PRÓXIMO
impulso passa mais rápido. A sequência se quebra sozinha quando fica difícil demais -- e o erro que
a quebra já tem a penalidade dele (0,80 por meio segundo).

- **⚠️ SÓ UM `miss` ZERA.** Não tentar **não** zera, e é literal: o pedido fala de ERRAR. Quem para
  de tocar já é punido pelo DESLEIXO, e somar as duas coisas seria uma regra que ninguém pediu.
- **⚠️ É DO JOGADOR, NÃO DO NPC:** o NPC não usa a barra -- ele sorteia --, então não há faixa dele
  pra acelerar. A sequência vive no `corrida`, não no corredor, pelo mesmo motivo. Há trava com o
  NPC acertando 10 segundos seguidos e a sequência do jogador parada em zero.
- **⚠️ TEM PISO** (`CORRIDA_SEQUENCIA_MIN`, 0,45): a faixa nunca passa de **2,22x** a velocidade
  normal. Sem ele ela viraria um borrão e o impulso deixaria de ser uma decisão.

#### ⚠️ A FASE TEVE QUE VIRAR ACUMULADA -- senão a faixa TELEPORTA

O centro era `0,5 + A·sin(2π·t / P)`. **Com o período mudando no meio da prova, essa conta SALTA**:
em t=10s, trocar P de 2,0 pra 1,6 leva o argumento de 31,4 pra 39,3 rad -- outro ponto qualquer do
seno. A faixa pularia **até um terço da barra** no instante do acerto, e o jogador leria isso como
a tela piscando.

Hoje a fase é **integrada** (`corridaAvancarFaixas`, chamada pelo `corridaFisicaPasso`): o que muda
é a VELOCIDADE angular daí pra frente, e a faixa continua de onde estava.
**⚠️ E DE QUEBRA ISSO CONSERTOU UM SALTO QUE JÁ EXISTIA:** a troca de TRECHO no revezamento também
muda o período (o nível do pokémon novo), e ela saltava do mesmo jeito desde 18/09 -- ninguém tinha
reportado porque o salto passava por uma travessia inteira. A trava velha cobrava justamente esse
salto (`c0 !== c1`); ela passou a medir o **RITMO**, que é a regra.

#### ⚠️ E A SINCRONIA COM A AGULHA: o que importa é o PISO

A regra de 18/09 é que o período das faixas **nunca** pode ser múltiplo inteiro da travessia, senão
a configuração barra+faixa se repete e o jogador decora o padrão. Com a aceleração, o período
efetivo vai de **0,52 a 1,90** travessias -- ou seja **atravessa o inteiro 1**, e existem 30
combinações nível+sequência em sincronia.

**Elas são toleradas porque duram UMA travessia:** cada acerto muda a sequência, então a
configuração não fica parada tempo suficiente pra ser decorada.
**⚠️ O QUE NÃO PODE FICAR EM SINCRONIA É O PISO**, porque ele é o único estado que PERSISTE -- e
medido, a sequência chega ao piso em **100% das corridas** de quem joga bem. No piso o intervalo é
**0,52 a 0,86** da travessia, que não contém inteiro nenhum. Há trava pros 99 níveis.

#### O QUE ISSO CUSTA, MEDIDO

O jogador é modelado pela **MIRA** (o erro típico dele em fração da barra) -- e não por "acerta bom
X% das vezes", senão o A/B pressuporia o resultado em vez de medi-lo. É a mesma modelagem que o
degrau do NPC usou. 120 corridas por célula, Jolteon Lv.60 dos dois lados:

| mira do jogador | sem acelerar | com acelerar | |
|---|---|---|---|
| ±2% (domina o jogo) | 100,0% | **99,2%** | −0,8 |
| **±5% (joga bem)** | 90,0% | **74,2%** | **−15,8** |
| ±10% (mediano) | 30,8% | 27,5% | −3,3 |
| ±18% (distraído) | 3,3% | 0,8% | −2,5 |

**⚠️ ELA MORDE QUEM JOGA BEM, e quase não toca nos extremos** -- e isso é o desenho: quem domina
acerta em qualquer velocidade, quem é mediano erra cedo e a sequência nem chega a crescer. Quem
joga bem constrói uma sequência longa e **a faixa acelerada passa a cobrar**.

**E O EFEITO COLATERAL BONITO ESTÁ NA CONTAGEM DE TOQUES:** o bot de ±2% vai de **14,3 pra 11,3
impulsos** por corrida -- com a faixa mais rápida, sobram menos instantes em que a agulha e ela se
encontram, e as travessias puladas caem no **DESLEIXO**. A mecânica se auto-regula por dois
caminhos que já existiam.

**QUANTO ELA ACUMULA:** medido, a maior sequência de uma corrida tem **mediana 10-11** pra quem
joga bem (maior vista: 13), e o piso é alcançado em **100%** das corridas dele; pra o mediano, em
**42%**.

- **Se um dia incomodar**, as réguas são o **passo** (`CORRIDA_SEQUENCIA_PASSO`, 12% por acerto) e
  o **piso** (`CORRIDA_SEQUENCIA_MIN`, 0,45). O passo é o que decide quantos acertos a rampa dura;
  o piso, o quão rápida ela fica no fim.
- **NA TELA** a sequência entra em dois lugares: o **recado** ("5 seguidos: faixa 1,9x.", a partir
  do SEGUNDO acerto -- "1 seguido" não é uma sequência) e o **chip dos perfeitos** ("7 perfeitos ·
  5 seguidos"). O erro diz "A faixa voltou ao normal.".
  **⚠️ O CHIP VIVE NUMA FUNÇÃO SÓ** (`corridaChipDosPerfeitos`), porque ele tem DOIS desenhistas: o
  `render()` dá o valor inicial e o pintor o move durante a prova (o laço não redesenha a tela).
  Escritos em separado, o chip sairia certo no primeiro quadro e errado dali em diante -- que é a
  família do modal da contagem e dos chips do revezamento.
  **⚠️ E O NÚMERO É O MULTIPLICADOR, não a porcentagem:** "189% mais rápida" se lê como +189%, o
  dobro do que ela acelerou.
- **Medido a 320px:** o recado cai em 2 linhas e o chip em 2, a faixa de feedback fica em
  **243x24px** e a tela não rola pro lado.

#### O QUE ISSO CUSTOU NO MOTOR: NADA

`MOTOR 4e1b30e2729d / DIARIO 603f5c7e563f`, idêntico em 900 batalhas semeadas. A Corrida é um
chamador do motor, não o motor.

`tools/test-corrida.js` foi a **451 pontas**, e as novas cobrem: o fator só encolhendo e com piso,
o período encolhendo pelo fator exato, cada acerto subindo e o erro zerando, o **BOM** contando
junto com o perfeito, a largada zerando os dois campos, o NPC não movendo a sequência, a fase
andando com o relógio da PROVA, **acelerar não teleportando a faixa** (nem trocar de trecho), o
chip nos três estados, e o CSS do ranking (o atalho `font` fora, o tamanho derivado, o negrito, a
classe no container e a Pescaria intacta).
**Conferido que ele acusa: 6 de 6 defeitos novos religados** (3, 3, 4, 2, 6 e 3 falhas).

#### ⚠️ E UMA LIÇÃO DE MEDIÇÃO SAIU DAQUI, cara de pagar

O `tools/test-especiais.js` tem um flake conhecido desde 17/09 (*"NINGUEM ataca com a barra em
zero"*, sempre no par Charmeleon × Mankey). Medindo-o **sem semente**, ele deu **0 de 17 no HEAD
e 6 de 12 no meu build** -- o que parecia uma regressão clara e custou meia hora de bissecção.

**Não era.** Três coisas provaram isso, e vale a ordem:

1. a **impressão do motor** (900 batalhas semeadas) é idêntica nos dois builds;
2. rodando o MESMO teste com o `Math.random` SEMEADO, os dois builds dão o **mesmo resultado
   semente por semente** -- 8 de 8 sementes concordam, e a taxa real é ~25% nos dois;
3. o diff não encosta em `doExchange`, `sequenciaDoConfronto`, `passosVisiveis`, `simulateGymBattle`
   nem `calcDamage`.

**⚠️ COMPARAR UM TESTE FLAKY SEM SEMENTE ENTRE DOIS BUILDS NÃO É MEDIÇÃO** -- é a mesma armadilha
do "amostra única não é medição" que este arquivo já registra no σ binomial, agora do lado do
teste. O `tools/semear-random.js` (um preload que troca o `Math.random`) é o que transforma a
comparação em medição -- e ele NÃO entra em bateria nenhuma: semeado, o teste varre sempre os
MESMOS confrontos, e é a variedade que faz uma trava de invariante valer alguma coisa.

**⚠️ E A PRIMEIRA BISSECÇÃO MEDIU O VAZIO, pelo motivo de sempre:** a árvore de teste que eu montei
não tinha o `functions/index.js`, o teste **morria na linha 1329** e devolvia **156 asserções em
vez de 1271** -- ou seja ele "passava" sem nunca chegar na trava. É literalmente a lição que este
arquivo já registra (*"uma trava que estoura é pior que uma que falha"*), agora aplicada à árvore
inteira: **conferir a CONTAGEM de asserções antes de acreditar num verde**.

**⚠️ E A TAXA DELE NÃO É ESTÁVEL -- remedida em 22/09/2026: 3 de 6 rodadas.** Ela já foi registrada
como "~1 em 17" e como "6 de 12", e as três medições são do MESMO defeito: o teste sorteia
confrontos novos a cada rodada, então a taxa observada num punhado de rodadas não diz nada.
**Não use essa taxa como sinal de regressão.** O que separa os dois casos continua sendo o trio
acima -- e a terceira perna é a mais barata de todas: **ver se o diff encosta no código que a trava
lê**. Aqui ela lê `sequenciaDoConfronto`, o diário e o `fraseDoEspecial`; um diff que só mexe em
`fighterHtml`, nos containers e no CSS não tem por onde alcançá-la.
**⚠️ E O SEMEADO TEM UM LIMITE QUE VALE SABER:** com a semente fixa o teste varre sempre os MESMOS
confrontos, então "8 de 8 sementes concordam" prova que os dois builds se comportam igual **naquelas
amostras** -- ele não exercita o flake. A prova de que não é regressão é a impressão do motor mais o
diff, não o semeado sozinho.

## AS TRÊS DA CORRIDA (21/09/2026) -- a pista fixa, o rótulo e os líderes

### ⚠️ SÃO SEMPRE QUATRO NA PISTA

Pedido assim: *"pode retirar os botoes de 2 e 3 pokemons/equipes, pode deixar sempre 4"*. Era um
segmentado de 2/3/4 no setup.

- **⚠️ O NÚMERO VIROU CONSTANTE, e não um campo do `corrida` fixado em 4:** campo é ESTADO, e
  estado que nunca muda é a forma mais silenciosa de código morto que existe -- ele ficaria no
  `corridaZerar`, no `escolhaPorFormato` e nas quatro contas de pista esperando alguém tentar
  mudá-lo de novo. O `corridaTrocarParticipantes` saiu junto.
- **AS DUAS CONTAS QUE PERGUNTAVAM PELO NÚMERO viraram o valor que elas já davam com 4:** a escala
  do sprite (`participantes === 2 ? 3 : 2.5`) e a fonte do brilho (`=== 4 ? 10 : 12`).
- **O QUE SOBRA NO SETUP É UMA FRASE**, porque a pista com quatro raias é o que o jogador vai ver:
  *"4 equipes na pista: você e 3 líderes da Liga Laranja"* -- derivada da constante.
- **⚠️ E DEZESSETE TRAVAS ESCREVIAM `corrida.participantes` À MÃO.** Elas passaram a escrever num
  campo que ninguém lê -- verde, e medindo nada. Saíram todas, e a que media as **seis**
  combinações (2/3/4 × individual/revezamento) virou **duas**, cobrando que o número de corredores
  seja o da CONSTANTE. É a mesma lição das cinco travas que caíram quando o trecho virou 150 m:
  **trava que fixa um número envelhece com ele.**

### O RÓTULO DO BOTÃO SEGUE A MODALIDADE

*"Quando clicar no botao de revezamento, trocar o texto do botao de 'Escolher corredor' para
'Escolher equipe'"*. No revezamento o que se escolhe é uma EQUIPE inteira, e o singular descrevia
a individual.

**⚠️ E AS DUAS TELAS PRA ONDE ELE LEVA JÁ ERAM DIFERENTES** -- a lista de POKÉMON na individual, a
de TIMES no revezamento, cada uma com o título dela. O que dizia a mesma coisa nas duas
modalidades era só o botão. (A primeira versão pôs a função também no título do picker da
individual, onde ela só pode devolver um valor: o revezamento nem passa por aquela tela. Saiu.)

### OS NPCs SÃO OS LÍDERES DA LIGA LARANJA

*"coloque que o nome dos npcs, ao inves de 1, 2 e 3, seja nomes de lideres das ilhas laranjas"*.
São os cinco do Orange Crew: **Cissy, Danny, Rudy, Luana e Drake**.

- **⚠️ E O NOME JÁ ESTAVA NO JOGO ANTES DELES:** a **Cissy** é a líder da **Ilha Mikan**, que é
  justamente a *Enseada de Mikan* onde o Resgate acontece.
- **⚠️ A ORDEM É FIXA, e não sorteada:** o adversário da raia 2 é sempre o mesmo, e é isso que
  deixa o jogador reconhecê-lo de uma corrida pra outra. Sortear faria o placar mudar de gente
  sem nada explicando.
- **⚠️ E A ETIQUETA DA PISTA E A DO HUD PASSARAM A LER A MESMA FUNÇÃO.** O rótulo estava escrito à
  mão em TRÊS lugares (o quadro do corredor, o marcador de borda e a linha do placar) -- três
  cópias divergem no primeiro ajuste. O lado 0 continua sendo "VOCÊ" na PISTA (ali o nome do
  treinador pode ter 20 caracteres num rótulo de 10px) e "Você" no HUD.
- **A LISTA TEM FOLGA sobre as raias** (cinco nomes pra três adversários), e o `%` é a rede pro dia
  em que a pista crescer -- sem ele a raia a mais sairia com `undefined`.
- **⚠️ E O TAMANHO IMPORTAVA:** o "Rival N" tinha sido escolhido porque *"Adversário 1"* quebrava
  em duas linhas na coluna de 83px da classificação. Os cinco cabem -- o mais longo tem cinco
  letras --, e há trava cobrando o teto.

**Medido a 320px, no navegador:** a pista com quatro raias, o placar com "Você · Jolteon / Cissy ·
Dugtrio / Danny · Alakazam / Rudy · Raikou", nenhum nome truncando e **sem rolagem lateral**.

**No motor, nada:** `MOTOR 4e1b30e2729d / DIARIO 603f5c7e563f`, idêntico em 900 batalhas semeadas.

`tools/test-corrida.js` foi a **458 pontas**. **Conferido que ele acusa os 3 defeitos religados**
(2, 2 e 3 falhas).

## AS ILHAS LARANJA: UM MAPA NO LUGAR DE TRÊS BOTÕES (21/09/2026)

Pedido assim: *"coloque um botão no home chamado Ilhas Laranja, e crie um mapa com 5 ilhas com o
gráfico parecido do que já temos na pescaria e no resgate. E para cada ilha, você vai adicionar um
desses novos jogos que criamos até agora ... e então pode tirar esses 3 botões de Pescaria, corrida
e resgate que tem na tela home e substitui por apenas um chamado Ilhas Laranja. Esse botão vai ser
exibido apenas para quem tem admin = true"*.

| ilha | líder | jogo | por quê |
|---|---|---|---|
| **Mikan** | Cissy | **Resgate** | o Resgate JÁ acontecia na *Enseada de Mikan* -- estava no jogo antes do mapa |
| **Navel** | Danny | **Corrida** | o desafio da Navel no original é uma subida contra o tempo |
| **Trovita** | Rudy | **Pescaria** | |
| **Kumquat** | Luana | **Seleção** | ver a seção do draft, abaixo |
| **Pummelo** | Drake | *em breve* | o quinto jogo |

**⚠️ OS CINCO LÍDERES JÁ ESTAVAM NO JOGO, e isso não é coincidência: são os MESMOS nomes que a
Corrida usa nos adversários** (`CORRIDA_NPC_NOMES`, de 21/09 de manhã). Há trava comparando as duas
listas -- divergindo, o jogador corre contra um líder que não tem ilha.

- **⚠️ A GEOMETRIA DA ILHA (`cx`/`cy`/`r`/`giro`) MORA NA TABELA, e é dela que saem as DUAS coisas:
  o desenho do arquipélago e a posição do pino.** Escritas em separado, um ajuste no mapa deixaria
  o botão boiando no mar -- e isso não aparece como erro, aparece como um pino fora do lugar. Há
  trava lendo o código (o mapa chama o `ilhaPino`, e não monta a posição à mão).
- **⚠️ OS DEFS DO SVG SÃO UMA CÓPIA SÓ** (`ILHA_DEFS`): os padrões de mar, areia e grama e as
  árvores são os MESMOS da ilha da Pescaria, extraídos pra uma constante quando o arquipélago
  nasceu. Duas cópias divergiriam no primeiro ajuste, e o mar de uma tela deixaria de ser o mar da
  outra. **⚠️ E os `id` deles são GLOBAIS no documento**, então os dois SVG nunca podem estar na
  tela ao mesmo tempo -- e não estão: um é da tela `ilhas` e o outro da `pescaria`.
- **AS TRÊS CAMADAS DE CADA ILHA SÃO O MESMO POLÍGONO EM TRÊS TAMANHOS** (água rasa, areia, grama),
  que é o desenho da ilha da Pescaria. O raio varia por vértice com uma conta **FIXA** (o `giro` da
  ilha entra nela): é o que dá silhueta própria a cada uma sem sortear nada -- um mapa que muda de
  forma a cada render não é um mapa.
- **⚠️ A ILHA SEM JOGO É UM `<span>`, e não um botão apagado**: um botão que não faz nada convida um
  toque que não responde. É a mesma decisão da ilha da Pescaria e da ilhota do Resgate no setup. E
  **o rótulo diz o que falta** (*"Em breve"*) -- uma ilha apagada sem motivo faz procurar defeito.
- **⚠️ O `abrir` É A FUNÇÃO, nunca o NOME dela.** Um nome em texto viraria uma busca no `window`
  (que não existe no sandbox dos testes) ou um `onclick` montado com ele dentro -- e handler que
  aponta pro nada é a família do `moveTeam` da Montanha e do slot sem aspas do montador.
- **QUEM RECUSA É A AÇÃO**: o `entrarNaIlha` recusa a ilha sem jogo e o índice forjado, e cada
  `abrir*` refaz a checagem de admin por conta própria.
- **⚠️ SAIR DE UM JOGO VOLTA PRA AS ILHAS, e não pra home**: o jogo mora numa ilha. Quem quer a
  home aperta o Voltar de lá.

**O BOTÃO DA HOME OCUPA A LINHA INTEIRA** (`home-btn-largo`), como o Boss de Domingo: a fileira de
modos é de DUAS colunas, e com os quatro modos normais o administrativo fica sozinho na quinta
célula -- medido a 320px, um buraco de 137px do lado. **Não é hierarquia: é a linha fechando.**

**⚠️ O SELO `ilhas` FOI REFEITO DEPOIS DA PRÉVIA, e a razão é a regra dos 16px.** A primeira versão
era uma copa REDONDA no centro de uma duna -- e a 16px isso lê como **CABEÇA SOBRE OMBROS**: uma
pessoa, não uma ilha. Hoje a duna é larga e baixa e a palmeira sai **INCLINADA** pra direita, com a
copa passando da borda da duna; nenhuma silhueta de pessoa faz isso. **Foi a prévia no navegador
que pegou** -- a regra da casa é que ASCII não se julga, e ela pagou de novo.

**Medido a 320px, no navegador:** a tela em **658px**, o mapa em **281×297px**, os cinco pinos com
nome e jogo **todos dentro do mapa**, **zero** pinos colidindo e **nenhuma rolagem lateral**. O
botão da home fica em **281×76px** com o selo em 26×26.

**No motor, nada:** `MOTOR 385943f3e1fa / DIARIO 850af0fd1763`, idêntico em 900 batalhas semeadas.

⚠️ **E TRÊS TRAVAS DOS MINIGAMES MEDIAM O BOTÃO NA HOME** -- elas viraram *"a ilha leva até mim"*,
que é o que elas sempre quiseram provar: existe UM caminho até o modo, e ele passa pela mesma
checagem de admin. **E duas do mapa fixavam 3 e 2** (com jogo / em breve) e caíram no MESMO DIA,
quando a Kumquat ganhou o draft: hoje elas contam a TABELA. É a lição das cinco que caíram quando o
trecho da Corrida virou 150 m -- **trava que fixa um número envelhece com ele.**

`tools/test-ilhas.js` tranca 91 pontas: o acesso nos 10 estados do campo, a home com UM botão e sem
os três velhos, a tabela (líderes casando com a Corrida, `abrir` sendo função, nenhum jogo em duas
ilhas), a ação recusando, o mapa, o pino DERIVADO do centro, os defs numa cópia só, e a volta.
**Conferido que ele acusa os 7 defeitos religados.**


#### ⚠️ AS ETIQUETAS DO MAPA CRESCERAM 45%, E O TETO NÃO É O GOSTO (23/09/2026)

Pedido assim: *"na tela que aparece as 5 ilhas das ilhas laranjas, aumente os textos do nome das
ilhas e do modo que se joga em cada ilha"*.

| a 320px | antes | **depois** |
|---|---|---|
| o nome da ilha | `.62rem` — **9,9px** | `.9rem` — **14,4px** |
| o jogo | `.5rem` — **8px** | `.72rem` — **11,5px** |
| altura das duas | 18 / 15px | 22 / 18px |
| folga até o fim do mapa | 29px | **21px** |
| folga à esquerda / direita | 39 / 41 | **28 / 30** |
| etiquetas fora do mapa, colisões, texto cortado | nenhuma | **nenhuma** |

**⚠️ O TETO É O `overflow:hidden` DO MAPA, e não o gosto.** A etiqueta de baixo da ilha mais baixa
(Kumquat, `cy` 274 de 380) é a que chega mais perto da borda — e o mapa **RECORTA** o que passar
dela. Medido em iframe de 320px, que é a menor largura que a casa mira, foram comparadas quatro
variantes (+26%, +35%, +45% e o de hoje): **as quatro cabem**, e a de +45% é a maior que ainda
deixa 21px embaixo. Crescer mais começa a cortar — **e cortar não aparece como erro, aparece como
um nome pela metade**.

- **⚠️ E O `top` DO JOGO ANDOU JUNTO (67 → 72px), que é o par que faz isto funcionar:** ele não é
  uma posição solta, é **o fim da etiqueta de cima mais o respiro**. O nome é `position:absolute`
  com `line-height` e uma borda de 1px de cada lado, então a altura dele é `line-height + 2` — hoje
  47+20+2 = **69**, e o 72 deixa os 3px que separam as duas. **Mexer na fonte do nome sem mexer aqui
  faz as duas se encostarem**, e encostar também não dá erro: dá duas caixas grudadas.
  Na primeira rodada de medição, com o `line-height` derivado por fórmula, **as três variantes
  caíram em `entre 0`** — foi ela que mostrou que o segundo número tinha que ser escolhido à mão.
- **A HIERARQUIA FICA DE PÉ:** o nome continua maior que o jogo. Iguais, o olho não sabe qual dos
  dois ler primeiro — o nome é o que se procura e o jogo é a legenda dele.
- **⚠️ E O NOME MAIS LONGO DE HOJE TEM 7 LETRAS** (Trovita, Kumquat, Pummelo), com 85px de etiqueta
  e 28 de folga lateral. Uma ilha de nome bem mais longo ficaria apertada — a conta é a largura da
  etiqueta centrada no `cx` da ilha, e a mais à esquerda (Kumquat, `cx` 82) é a que aperta primeiro.

**⚠️ A TRAVA É UM PISO, e não o valor exato** (`.8rem` no nome, `.65rem` no jogo): cravar `.9rem`
ali faria ela envelhecer no próximo ajuste — a família que já caiu **cinco vezes** só na Corrida (a
metragem do revezamento, o texto do botão de modalidade, o cache, a fileira da classificação). O
que ela existe pra impedir é a **regressão** pro tamanho que foi reclamado. E ela **lê o CSS**:
tamanho de fonte e posição não aparecem em asserção de HTML nenhuma — a lição do `[hidden]` que
deixou o modal da contagem preso na tela e da `section-title` fantasma que saía em texto de corpo.

**No motor, nada:** `MOTOR 5481ce57abca / DIARIO a4c6725aa4aa`, idêntico em 900 batalhas semeadas.
**Os 6 defeitos religados acusam.**

## A TRAVESSIA PELAS ILHAS LARANJA, A PARTIR DA JORNADA (21/09/2026)

Pedida assim: *"em qualquer momento quando o treinador tiver 6 pokemons, vai aparecer aleatoriamente
uma terceira rota quando ele tem 2 para escolher, essa rota sera para as ilhas laranjas, e só chega
la usando o surf(HM03) ... quando o usuario for jogar o resgate pokemon, ele vai ser obrigado a ir
com o pokemon que ele usou o surf ... na pescaria, ele vai usar o time que ele esta na jornada agora
... na arena 1x1, e na corrida, ele tbm vai ter que selecionar 1 pokemon do time atual ... o
treinador vai ter apenas 2 chances de vencer os confrontos, e caso ele vença todos, todos os
pokemons dele ganha + 3 levels"*.

**⚠️ POR ENQUANTO SÓ PRA `admin === true`** (a pedido, no mesmo dia), e a guarda mora no **SORTEIO**:
a carta não chega a existir pra quem não é. Sem isso ela apareceria trancada — e um cadeado que
ninguém consegue abrir é pior que carta nenhuma.

> **⚠️ ISTO É HISTÓRIA desde 23/09/2026: a CARTA saiu do sorteio** — a travessia virou uma caixa
> na tela de FIM da jornada, ao lado da Elite 4 (ver **A TRAVESSIA SAIU DA JORNADA E FOI PRO FIM
> DELA**, logo abaixo). O que esta seção continua descrevendo inteiro são as **quatro restrições de
> time**, as **2 chances por desafio** e o **prêmio de +3 níveis** — essas não mudaram. O que virou
> história é tudo que fala do SORTEIO da carta, do `ILHAS_TIME_MINIMO` e do teto de uma por
> jornada (que hoje é o `game.ilhasFeita`).

### ⚠️ COPIAR OS CINCO JOGOS OU PÔR UM CONTEXTO? A pergunta foi do pedido, e ela foi MEDIDA

| | |
|---|---|
| os cinco blocos de minigame somam | **6.363 linhas** — **16,5%** do `index.html` |
| as travas que os cobrem hoje | **1.503 asserções** |
| o que uma cópia teria de cobertura | **zero** |

**Copiar acrescentaria 6.363 linhas sem trava nenhuma**, e a cópia divergiria da original no
primeiro conserto — deixando dois jogos com a mesma cara e comportamentos diferentes. É a armadilha
que este arquivo registra em dezenas de lugares.

**⚠️ E O CONTEXTO COUBE PORQUE CADA JOGO JÁ TEM UMA PORTA ÚNICA PRO TIME:** `corridaElegiveis`,
`pescariaElegiveis`, `resgateElegiveis` e `queimadaElegiveis`. São **quatro funções**, não quatro mil
linhas. (A **Seleção fica de fora**: o bolo dela é sorteado e não usa o time de ninguém — ela é um
dos cinco desafios, mas não tem restrição a aplicar.)

**O que garante que nada quebra** é o campo ser UM e nascer nulo: fora da visita as quatro portas
respondem exatamente o que respondiam. Isso é cobrado pelas 1.503 travas que já existiam, pela
impressão do motor (**`MOTOR 079861051846 / DIARIO cfedb1fdcab2`, idêntica**) e por um bloco próprio
que mede as quatro **antes e depois**.

### A ROTA: a terceira de chave, e a primeira cuja condição não é o trecho

A mata é do 4º trecho em diante e a montanha do 6º; esta pede um **TIME COMPLETO**
(`ILHAS_TIME_MINIMO = 6`), em qualquer trecho. É o pedido ao pé da letra, e faz sentido pelo que há
do outro lado — os cinco desafios usam o time da jornada, e entrar com quatro pokémon é entrar
pra perder.

- **⚠️ UMA TERCEIRA CARTA POR TRECHO, e a ordem é a de antiguidade:** mata > montanha > ilhas. Com
  duas no mesmo trecho seriam QUATRO cartas, e a promessa é de uma terceira. **As ilhas vão por
  último no `else if` porque a condição delas é a mais larga**: postas na frente, elas roubariam
  trechos das outras duas e mudariam a jornada de quem já tem save aberto.
- **⚠️ A CONDIÇÃO DE TIME É LIDA FORA DA SEMENTE**, de propósito: o dado de cada trecho é sempre o
  mesmo, e o que muda é a carta ser OFERECIDA ou não. Assim capturar o sexto pokémon não re-sorteia
  nada — ele destrava o que o dado já havia decidido.

**MEDIDO** (800 saves, time cheio a partir do trecho 3):

| | |
|---|---|
| a rota sai por trecho | **20,1%** (a constante é 25%; a mata come 14,8% dos trechos e a montanha 13,0%) |
| jornadas que veem as Ilhas **alguma** vez | **60,6%** |
| travessias por jornada | **0× em 38,6%, 1× em 61,4%** — e nunca mais que uma |

### ⚠️ UMA TRAVESSIA POR JORNADA (21/09/2026) — e o mecanismo é o OPOSTO do da mata

Pedido assim: *"se a travessia para a ilha laranja ja apareceu 1x na jornada, ela nao deve aparecer
mais"*. Ela nasceu podendo sair **até 3×** (0× em 39,4%, 1× em 38,8%, **2× em 18,3%, 3× em 3,6%**),
o que dava **até +9 níveis** contra +4 do Bônus de Kanto — a régua que esta seção já apontava.

**⚠️ E "APARECEU" É A CARTA TER SIDO OFERECIDA, não o jogador ter entrado** — é o pedido ao pé da
letra, e é o que a mata já faz: lá a carta também aparece trancada pra quem não tem o Corte e a
chance vai embora com o trecho.

**⚠️ A MATA *DERIVA* E ESTA *GRAVA*, e a diferença não é gosto.** O `legDaMataFechada` varre os
trechos e fica com o primeiro que passa no dado — e isso funciona lá porque **o dado da mata só
depende do trecho**. O das Ilhas depende também do **TIME estar completo**, e o time muda ao longo
da jornada: varrendo, a pergunta *"ela saiu no trecho 0?"* seria respondida com o time de HOJE,
quando naquele trecho o jogador tinha dois pokémon — e a travessia seria dada como **gasta num
trecho em que ela nunca pôde aparecer**. Por isso aqui a aparição é gravada (`game.ilhasTrecho`).

- **⚠️ A MARCA É POSTA NO `cartasDeRota`**, que é o único ponto em que a carta de fato entra na
  lista — os três chamadores dele fazem `game.routeCards = cartasDeRota(...)`, ou seja **montar a
  lista É aparecer**.
- **⚠️ E NO MESMO TRECHO A CARTA CONTINUA SAINDO** (`marcado === leg`). Sem isso o
  `renderRouteCardsBlock` — que remonta as cartas quando elas vêm vazias, a auto-recuperação de
  save antigo — **apagaria a própria carta que ele acabou de recuperar**. Há trava.
- **⚠️ O `ilhasTrecho` USA `== null`, NUNCA `|| null`**, nos dois lados (gravar e ler): **o trecho
  0 é um trecho válido e `0 || null` dá NULL** — a travessia voltaria a aparecer pra quem a viu no
  primeiro trecho, que é exatamente o que a regra existe pra impedir.
- **Save anterior à regra nasce sem marca** e se comporta como antes: o dado decide.

**MEDIDO, e são DOIS números — o segundo é o que fecha a mudança:**

| | antes | depois |
|---|---|---|
| jornadas que veem a travessia **alguma** vez | 60,6% | **61,4%** (não caiu) |
| travessias por jornada | até **3×** (média 0,86) | **no máximo 1** (média 0,61) |
| teto do prêmio | **+9 níveis** | **+3** |

**⚠️ E A PRIMEIRA TRAVESSIA CAI EXATAMENTE ONDE CAÍA: conferido em 800 jornadas, o trecho da
primeira é IDÊNTICO ao do build anterior.** É a mesma propriedade que a mata garante — *"some só a
repetição"* —, e é ela que faz a mudança não alterar a jornada de quem já tem save aberto.

### AS TRÊS ROTAS DE CHAVE VIRARAM UMA TABELA

O card e a ação decidiam com `r.corte ? ... : ...` — **o que dá o certo com DUAS e deixa a terceira
cair no ramo errado**: ela pediria o HM02 e nomearia o voador. É literalmente o defeito dos banners
de intro (`CLASSE_DO_BANNER`), onde três contextos caíam numa string vazia e a tela saía ilegível.

Hoje é o **`ROTAS_DE_CHAVE`** (HM, ícone, quem abre, pra onde vai), e a quarta rota de chave nasce
com o cadeado certo, a frase certa e o nome de quem abre. **A mata e a montanha não mudam um
caractere** — há trava comparando as três.

### AS QUATRO RESTRIÇÕES, uma regra por jogo

| jogo | pela home | **pela jornada** |
|---|---|---|
| **Corrida** | todos os saves campeões | **só o time da jornada** (12 → 6 no fixture) |
| **Arena 1x1** | idem | **só o time da jornada** |
| **Resgate** | todos os surfistas de todos os saves | **UM: quem abriu o caminho** |
| **Pescaria** | escolhe o save | **o save da jornada** |
| Seleção | — | — (o bolo é sorteado) |

- **⚠️ O RESGATE É UM SÓ, e não a lista filtrada por `SURFISTAS`:** devolver a lista daria a ele os
  OUTROS surfistas do time, e quem abriu o caminho foi **um**. Há trava com dois surfistas no time.
- **⚠️ E O SURFISTA É CASADO POR POSIÇÃO+ESPÉCIE, nunca só pelo `monId`**: ele é um contador que
  recomeça a cada carregamento de página e repete entre saves — a lição que custou oito pokémon
  marcados no Ginásio da Cidade.

### AS 2 CHANCES E O PRÊMIO

- **⚠️ SÃO 2 POR DESAFIO, não no total:** 2 no total pra cinco ilhas tornaria o prêmio impossível, e
  o pedido fala dos "confrontos" no plural.
- **A tentativa é contada mesmo na DERROTA** — é isso que as 2 chances são —, e **vencer duas vezes
  não conta duas**.
- **⚠️ O REGISTRO É UMA PORTA ÚNICA fechada por dentro** (`if(!naJornadaDasIlhas()) return`): os
  cinco jogos abertos pela HOME passam por ela e nada acontece. É a mesma decisão do
  `registrarSketch`, que aprendeu isso do jeito caro quando o Ginásio da Cidade reusou a tela da
  jornada.
- **⚠️ E ELA MORA NO `*Terminar` DE CADA JOGO**, que é a porta por onde cada um já passa quando a
  partida acaba. Posta no `sairDa*`, o jogador escaparia da tentativa só fechando a tela.
- **O vencedor sai do MOTOR, nunca da tela**: `corridaRanking()[0].i === 0`, `queimadaVencedor() > 0`,
  os pontos do Resgate **depois** da entrega final, os da Pescaria **depois** das batalhas pendentes.
- **O prêmio são +3 níveis no time inteiro**, pagos ao sair, **só com as cinco vencidas**.

**⚠️ E O `premiado` QUE EU TINHA POSTO ERA LETRA MORTA — a conferência de acusação pegou:** quem
impede o pagamento duplo não é a marca, é o **contexto ser anulado** na mesma função. Religando o
defeito, a trava passava em branco. Rede que não dá pra exercitar é letra morta, e ela saiu.

### ⚠️ A VARREDURA DE SELO FANTASMA, E OS DOIS QUE ELA ACHOU EM PRODUÇÃO

Escrevi o checklist com `selo('certo')`, `selo('errado')`, `selo('vazio')` e `selo('estrela')` — e
**nenhum dos quatro existe**. `selo()` de um nome que não está no `DESENHOS` **sai vazio, sem erro**.

A varredura que nasceu daí achou **dois fantasmas que já estavam no ar**:

| | usos | o certo |
|---|---|---|
| **`selo('medalha')`** | **4** | `medalha_ouro` |
| `selo('selecao')` | 1 | `estadio` |

**⚠️ E UM DELES É O SELO 🎖️ DA ESPECIALIDADE NO QUADRO DO LUTADOR** — aquele que este arquivo
descreve aparecendo "nas CINCO telas de batalha". Ele estava **invisível** desde que os emojis
viraram desenho (18/09). Os cinco foram consertados.

### ⚠️ E CINCO LIÇÕES DE MÉTODO SAÍRAM DAQUI

1. **⚠️ O MEU PATCH IMPRIMIU CINCO "ok" E NÃO GRAVOU NADA.** Ele grava no FIM, e um `process.exit` num
   passo posterior abortou antes — os "ok" eram de INTENÇÃO, não de efeito. Foi a bateria que
   pegou. **Conferir o ARQUIVO depois do patch, não a saída dele.**
2. **⚠️ COLISÃO DE NOME COM UMA FUNÇÃO DO MESMO DIA:** eu criei um `registrarPartidaDaIlha` que
   **sobrescreveu o do monitor** (declaração duplicada — a última vence), e o monitor parou de
   contar. A trava do monitor pegou no mesmo minuto. Hoje o novo é `registrarResultadoDaIlha`.
3. **⚠️ AMOSTRA ÚNICA, TRÊS VEZES.** O primeiro smoke disse "a rota nunca sai" — era o slot 0/gen 0,
   cujos oito dados deram acima de 0,25. E duas travas da porta mediam **um trecho de um save**, e
   por isso passaram em branco. **Sorteio semeado se mede varrendo.**
4. **⚠️ O FIXTURE TEM QUE DISTINGUIR OS DOIS LADOS:** três travas de restrição comparavam com `=== 6`
   e o sandbox devolvia **ZERO** elegíveis — os dois lados davam o mesmo e elas não mediam nada.
   Hoje o fixture tem dois saves campeões (12 fora contra 6 dentro).
5. **A conferência de acusação achou 6 travas mudas de 18.** Sem ela, um terço deste bloco seria
   decoração.

**Medido a 320px, no navegador:** a tela das ilhas com checklist em **305×851px** (sem rolagem
lateral), o checklist em 281×228px com 5 linhas de 25px, nenhum nome truncado, **nenhum selo sem
desenho**; a carta nova sai **trancada** sem surfista e **aberta** com ele, em 145px.

`tools/test-ilhas.js` foi a **293 asserções**, e **os 24 defeitos religados acusam** (2 a 8 falhas
cada).

### ⚠️ E A VISITA ERA GRAVADA NO SAVE E NUNCA LIDA DE VOLTA

Achado ao escrever a trava do "uma vez", não por relato. O `serializeGame` mandava o `ilhasJornada`
pro banco e **o `applySavedState` não o restaurava** — ele é explícito **campo a campo**, e não um
`Object.assign`.

**O estrago:** um F5 no meio da travessia (ou voltar pra home e reabrir o save) **apagava a
visita** — o jogador reencontrava as quatro portas de time respondendo como se ele estivesse na
HOME, com o time de todos os saves campeões, e as ilhas já vencidas zeradas.

**⚠️ E A TRAVA QUE EU TINHA ESCRITO NÃO PEGOU PORQUE ELA OLHAVA O `serializeGame`: ela provava que
o campo SAI, nunca que ele VOLTA.** Hoje ela faz o **round-trip** (serializa, zera o `game`,
aplica de volta e cobra a visita e o surfista de pé), e o trecho 0 passa pelo mesmo caminho.
**Trava de save tem que fazer a IDA E A VOLTA** — vale pro próximo campo de save que nascer.

### O QUE FICA PENDENTE

- **o fluxo de ponta a ponta no navegador** (entrar → jogar os cinco → voltar) não foi exercitado:
  o que está medido é cada peça e o estado, não a travessia inteira num navegador;
- **a Seleção não tem restrição de time**, e é o desenho — mas ela conta pro prêmio.


## ⚠️ A TRAVESSIA SAIU DA JORNADA E FOI PRO FIM DELA (23/09/2026)

Pedida assim: *"tire o acesso a ilhas laranjas durante a jornada, como opção de terceira rota. Faça
com que ela apareça sempre na mesma tela que aparece para enfrentar a Elite 4, no fim da jornada, e
o treinador só consegue acessar se um dos pokemons do time tiver Surf, então quando ele clicar no
botão para entrar nas Ilhas Laranjas e ele não ter um pokemon que tem Surf, porém ele tem o HM03,
exiba um modal ... caso ele não tenha o HM03, exibir ..."*.

**Ela era a TERCEIRA ROTA DE CHAVE** (com a Mata Fechada e a Montanha Sagrada), sorteada em 1 de
cada 4 trechos pra quem tivesse o time cheio. Hoje ela é uma caixa na tela de fim da jornada, ao
lado da caixa da Elite 4 — e tudo que a seção acima descreve sobre o SORTEIO virou história.

### ⚠️ O ALCANCE MUDOU MUITO, E É O NÚMERO QUE JUSTIFICA A MUDANÇA

A porta velha tinha **dois filtros em série**, e o segundo era invisível até o jogador chegar nele:

| | |
|---|---|
| jornadas que **VIAM** a carta alguma vez | **60,6%** |
| e ela vinha **TRANCADA** sem um surfista **naquele trecho** | — |

Medido agora, com o bot jogando 600 jornadas inteiras:

| | |
|---|---|
| jornadas **CONCLUÍDAS** com um surfista no time | **93,3%** (318 de 341) |
| jornadas (todas) com um surfista no time no fim | 87,0% |
| quantos dos seis surfam, em média | **2,02** |

**⚠️ E A DIFERENÇA NÃO É SÓ O NÚMERO: é QUANDO ele é medido.** A carta perguntava *"você tem um
surfista AGORA, no trecho 4?"*; a tela de fim pergunta no fim da jornada, quando o time já está
montado — e é por isso que ela sobe pra 93%. Os **65 surfistas** são 26% do bestiário e **40 das
138 evoluções finais**, então um time de seis quase sempre tem um.

### ⚠️ O CADEADO MUDO VIROU UM CAMINHO — e é isso que o pedido pede

Na carta, quem não tinha Surf via um card **apagado** e mais nada. Aqui o botão **sempre responde**,
e a recusa diz o que fazer:

| o estado | o modal |
|---|---|
| **tem o HM03** | *"É necessário que algum Pokemon do seu time saiba o movimento Surf(HM03). Ensinar o Surf para seu time atual?"* — com o botão que ensina |
| **não tem** | *"É necessário que algum Pokemon do seu time saiba o movimento Surf(HM03). Para obte-lo, tenha todos os pokemons da Zona Safári na Pokedex."* |

As duas frases foram ditadas no pedido e são trancadas **palavra por palavra**, como as dos golpes
especiais. A primeira é uma **PERGUNTA** porque ali há o que fazer; a segunda é um aviso, porque o
caminho é longo (as 17 da Zona de Safári) e não cabe num botão.

- **⚠️ O ATALHO É O `ensinarMaquinaNesteTime`, e não o `abrirEnsinarHm` cru.** Aquele já fixa o time
  **ABERTO** e guarda a volta — e o pedido diz *"ensinar o Surf para seu time ATUAL"*. Com o
  `abrirEnsinarHm`, o jogador cairia na lista de **TIMES**: uma pergunta cuja resposta já está na
  tela. É a mesma decisão que o picker da travessia já tinha tomado.
- **⚠️ E QUEM TEM A MÁQUINA MAS NENHUM CANDIDATO NO TIME não recebe a pergunta:** o HM03 na conta
  não garante que **ALGUM** dos seis aprende Surf, e um botão que abre uma lista vazia é pior que
  botão nenhum. Medido: um time de Gengar e Onix mostra *"Nenhum dos seis aprende Surf"* e nenhum
  botão. É o único ramo desta tela que a medição no navegador não alcançou, e ele tem trava própria.
- **⚠️ QUEM VALIDA É A AÇÃO**, nunca o botão: um toque forjado no console não atravessa sem ninguém
  que nade. A regra da casa, e há caso de teste.

### ⚠️ ELA NÃO DEPENDE DA ELITE 4 — verificado (23/09/2026)

Perguntado assim: *"só verifique que o usuario pode fazer o desafio das ilhas laranjas a qualquer
momento em que ele vencer as 8 insignias, independente de ele ter vencido a elite 4 ou nao"* e, logo
depois, *"mesmo se ele tiver vencido a elite 4 mas nao tenha jogado o desafio da ilha laranja, ele
pode"*.

**Pode nos dois casos — e isso foi MEDIDO, não lido.** A condição da caixa é o `won` do
`renderJourneyEnd`, que é `game.badgesEarned.length === numGinasios()`: as **8 insígnias**, e mais
nada. Nem o `ilhasNaJornadaHtml`, nem o `pedirIlhasDaJornada`, nem o `entrarNasIlhasDaJornada` leem
o `eliteStatus`.

**⚠️ O ÚNICO BLOQUEIO É O `ilhasFeita` — a matriz dos dois campos:**

| `eliteStatus` | ainda **não** atravessou | **já** atravessou | *(o APOSENTAR, na mesma tela)* |
|---|---|---|---|
| **`null`** (nunca enfrentou a Elite) | **PODE** | não | — |
| **`inProgress`** (no meio dela) | **PODE** | não | — |
| **`champion`** | **PODE** | não | ✓ |
| **`defeated`** | **PODE** | não | ✓ |

A coluna da direita é a resposta da segunda pergunta: **campeão que ainda não jogou as Ilhas entra**,
e o que fecha a porta é só já ter atravessado **naquela jornada**. A **AÇÃO** entra nos quatro
estados também — não é só o botão aparecendo.

**⚠️ O APOSENTAR É O CONTROLE, e ele é a metade que faz a medição valer:** ele fica na **MESMA
tela** e **só** aparece com a Elite resolvida (2 de 4). Sem ele, um fixture em que os quatro
estados não mudassem nada daria "4 de 4" e a trava não estaria medindo coisa nenhuma — é a lição do
*fixture que não distingue os dois lados*.

**⚠️ E TERMINAR A ELITE VOLTA PRO `journeyEnd`**, que é onde a caixa está: campeão e derrotado caem
lá, e só quem está **no meio** dela vai pro `eliteHeal`. Sem isso a caixa existiria e seria
**inalcançável** pra quem já jogou a Elite — há trava lendo essa linha.

**E O PONTA A PONTA CONFIRMA O OUTRO LADO:** em **600 jornadas do bot**, as **221 concluídas**
chegam ao `journeyEnd` com `eliteStatus: null` — ou seja **sem nunca terem enfrentado a Elite** — e
a caixa está presente em **221 de 221**. O bot não joga a Elite, então esse é literalmente o caso
"venceu as 8 e ainda não foi lá".

**⚠️ E A REABERTURA DO SAVE TAMBÉM**, que é o caminho de quem fecha o jogo e volta noutro dia: o
`journeyEnd` é tela segura de gravação, e nenhuma das redes de segurança do `applySavedState` (que
existem pra Elite em batalha, evolução pendente e resultado sem resultado) o desvia. Medido o
round-trip nos quatro estados: grava `journeyEnd`, reabre em `journeyEnd`, **e a caixa continua lá
nos quatro**.

**⚠️ E A TRAVA NOVA É A ÚNICA QUE PEGA UM DOS CASOS:** religando *"a caixa passa a exigir a Elite
NÃO começada"*, as duas travas antigas (*a caixa está na tela*, *com o botão*) **passam** — porque o
fixture delas já roda com `eliteStatus` nulo. Conferido: os **sete** defeitos de amarração à Elite
acusam (1 a 14 falhas cada), inclusive *"o campeão é barrado"*, que é o caso perguntado.

### ⚠️ DUAS COISAS QUE A CARTA DAVA DE GRAÇA E PRECISARAM DE CAMPO

1. **UMA VEZ POR JORNADA.** Pela carta a regra vinha sozinha (ela sumia do trecho, pelo
   `game.ilhasTrecho`); no fim da jornada **a tela fica lá pra sempre**, e sem uma marca o prêmio de
   **+3 níveis** sairia de novo a cada visita, sem teto. Hoje é o `game.ilhasFeita`, escrito quando
   a travessia termina.
   **⚠️ E ELE FAZ A IDA E A VOLTA DO SAVE** — o `applySavedState` é explícito campo a campo, e um
   campo que sai e não volta se perde num F5. Foi exatamente o que aconteceu com o `ilhasJornada`
   até 22/09, e lá o custo era a travessia inteira; aqui seria o prêmio saindo de novo. Há trava
   fazendo o **round-trip**, que é a única forma que pega isso.
2. **PRA ONDE VOLTAR.** Agora são **DUAS portas com destinos diferentes**: pelo fim da jornada o
   jogador volta pro `journeyEnd`, e pela **CARTA** — que um save antigo ainda pode ter na mão — ele
   segue pro encontro selvagem do trecho, como as outras duas rotas de chave fazem. Sem o campo
   (`ilhasJornada.volta`, repassado no `ilhasResultado`), quem entra pelo fim cairia num encontro
   selvagem que aquela tela não tem.
   **⚠️ A VOLTA ATRAVESSA O RESULTADO porque a visita é ANULADA antes do `seguirDasIlhas`** — e sem
   o campo o `seguirDasIlhas` cai no encontro selvagem, que é o certo pra a porta velha, **inclusive
   num save gravado antes deste campo existir**.

### ⚠️ A ROTA E A CHAVE FICARAM DE PÉ, E O SORTEIO MORREU

O que saiu foi o **sorteio**: o `ILHAS_TIME_MINIMO`, a `CHANCE_ILHAS` e o `ilhasSaemNoTrecho`
(2.701 caracteres). O `ROTA_DAS_ILHAS` e a entrada `surf` do `ROTAS_DE_CHAVE` **continuam** — save
parado na tela de escolha **COM a carta na mão** continua com ela funcionando, cadeado e tudo.
Tirar os dois deixaria aquele card clicável levando a lugar nenhum, e é a mesma razão pela qual log
velho nunca some deste jogo.

**⚠️ E O `game.ilhasTrecho` CONTINUA SENDO GRAVADO E LIDO**: é ele que impede a carta de reaparecer
num save que já a viu, enquanto aquela carta existir.

**⚠️ E AS TRAVAS DO SORTEIO NÃO FORAM APAGADAS: elas viraram a trava da regra NOVA.** Sem elas,
alguém reintroduz a carta no `cartasDeRota` e a rota volta ao meio da jornada **sem ninguém ver** —
é a mesma decisão das que viraram do avesso quando as Ilhas abriram pra todo mundo. Hoje elas
varrem **1.280 trechos** (20 slots × 20 gerações × 8) cobrando **zero** cartas, e um segundo caso
cobra que a **mata e a montanha continuam saindo**: sem ele, uma guarda que matasse as TRÊS passaria
na primeira linha, porque zero é zero.

### O QUE ISSO CUSTOU AO MOTOR: NADA

`MOTOR 2d6a83f24cf1 / DIARIO 72e61601d1fb`, **idêntico ao HEAD** em 900 batalhas semeadas — e o
instrumento é sensível (com o `CRIT_BASE` em 1/8 os dois hashes mudam). O smoke da jornada roda
**600 jornadas com 0 falhas**, atravessando 22 telas.

**⚠️ E O NÚMERO ABSOLUTO DA IMPRESSÃO SÓ VALE COMPARADO COM O MESMO SCRIPT.** Ele mudou de
`5481ce57abca` pra `2d6a83f24cf1` sem que o motor tivesse mudado — o que mudou foi o painel do
script. O que prova alguma coisa é rodar o MESMO script contra as duas cópias, e foi isso que foi
feito (`git show HEAD:index.html` contra a árvore).

**⚠️ E O PARÂMETRO DO SMOKE É `--runs`, NÃO `--n`:** um `--n 1200` roda os **20** do padrão e
imprime *"20 jornadas completas"* na mesma linha — uma medição que parece grande e é pequena. Foi
assim que três smokes desta sessão mediram 20 jornadas achando que mediam centenas.

**Medido a 320px, no navegador, nas cinco telas** (com Surf, sem Surf, já atravessada e os dois
modais): **nenhuma rola pro lado** (305 de 320) e **nenhum texto cortado**.

| | |
|---|---|
| a caixa das Ilhas, **com** um surfista | **281×283px** (ela nomeia quem leva o time, com o sprite) |
| **sem** surfista | 281×226px |
| já atravessada | 281×162px |
| o modal de **ensinar** | **265×307px**, a frase em 4 linhas, com os dois botões |
| o modal de **como conseguir** | 265×272px, a frase em 5 linhas, só o Fechar |

A caixa fica **logo abaixo da caixa da Elite** (281×214px), que é o que o pedido diz — as duas são o
que há pra fazer quando a jornada acaba.

### AS LIÇÕES DE TESTE QUE SAÍRAM DAQUI

1. **⚠️ O CONTADOR DO SCRIPT DE ACUSAÇÃO CONTOU `FALHA` E O TESTE IMPRIME `FALHOU`** — a **terceira**
   vez desta armadilha neste projeto. Os 13 defeitos religados apareciam como *"1 falha"* (o sumário
   `N FALHA(S)`), e um deles **estava passando em branco** escondido nesse 1. Um "1 falha" idêntico
   em treze casos diferentes é o sinal.
2. **⚠️ E O DETECTOR DE "MORREU" DAVA FALSO POSITIVO:** o `TypeError: snap.forEach` do stub de saves
   acontece **em toda rodada**, inclusive no build certo. Detector que dispara sempre não é detector.
3. **⚠️ O HEREDOC COMEU AS BARRAS DUPLAS PELA QUARTA VEZ NESTA SESSÃO:** a regex que procura a
   chamada do modal no render virou outra coisa (os parênteses escapados viraram grupo e as chaves,
   quantificador), e ela **falhava com o código certo**. O caminho seguro é o `indexOf`, que não tem
   o que escapar.
4. **⚠️ E UMA TRAVA MINHA DEIXOU RASTRO E DERRUBOU A VIZINHA:** ela trocava o `saveSlots[0]` pra
   medir o ramo sem candidato e o **reconstruía** no fim, com o time da jornada dentro — e a trava
   do **Resgate**, que conta os surfistas dos SAVES, caiu. O save original é **guardado**, nunca
   remontado.

## ⚠️ O SAVE ENTRAVA DIRETO NAS ILHAS LARANJA (22/09/2026)

Reportado assim: *"o último save (slot 20) da minha conta, quando eu clico nele, está entrando
diretamente nas ilhas laranjas, sendo que nem tinha aparecido pra mim a rota da liga laranja"*.

**⚠️ A CAUSA É A HOME NÃO DESCARREGAR O SAVE — e isso já estava escrito neste arquivo.** A nota do
HM01 diz, com todas as letras: *"a mochila é aberta da HOME, e ir pra home NÃO descarrega o save: o
`game` continua com o time, o trecho, as cartas de rota e tudo o mais — só o `game.screen` muda"*.
Então, com um save aberto e o jogador de volta na home, o `currentSaveSlot` **continua preenchido**:

```
clica em "Ilhas Laranja"  ->  abrirIlhas()  ->  game.screen = 'ilhas'  ->  render()
render()                  ->  maybeAutoSave()
maybeAutoSave()           ->  'ilhas' ESTÁ no SAFE_SAVE_SCREENS  ->  GRAVA o save do slot aberto
```

O save era gravado **apontando pra tela das ilhas**, e o `applySavedState` (que devolve qualquer
tela do `SAFE_SAVE_SCREENS`) levava o jogador direto pra lá na próxima abertura.

**⚠️ E O JOGADOR ESTAVA CERTO NAS DUAS METADES DO RELATO — o documento prova.** Lido no Firestore
antes de mexer em qualquer coisa:

| campo | valor | o que ele diz |
|---|---|---|
| `screen` | **`ilhas`** | o sintoma |
| **`ilhasJornada`** | **`null`** | ele **nunca** entrou pela travessia |
| **`ilhasTrecho`** | **`null`** | a carta **nunca chegou a ser oferecida** |
| `gymIndex` / `badgeCount` | 5 / 5 | 6º trecho, Dojo Lutador, `losses: 1` |
| `team` | 6 pokémon Lv.46–57 | intacto |

**NADA DE PROGRESSO SE PERDEU: o que corrompe é só a TELA.** O time, as insígnias, o trecho, o
`rivalPool` e o `wildOffer` estavam todos lá.

**MEDIDO NO BANCO, em 177 contas: 2 saves presos assim** — o do relato e um de outra conta, no 8º
trecho. O alcance é pequeno porque as Ilhas abriram pra todo mundo em 21/09; **ele cresce sozinho**,
porque todo jogador que abrir um save, voltar pra home e tocar no botão fica preso.

**⚠️ E A JANELA DE RECUPERAÇÃO NÃO ALCANÇOU.** O `readTime` do Firestore lê o documento como ele
estava em qualquer instante da **última hora** — e a sobrescrita foi às **16:53**, quase três horas
antes do relato. A versão mais antiga alcançável já tinha `screen:'ilhas'`. Não fez falta (o estado
estava inteiro), mas fica registrado: **neste projeto o diagnóstico de dado perdido tem uma hora de
prazo**, e é a primeira coisa a tentar.

### O CONSERTO SÃO OS DOIS LADOS DA MESMA PERGUNTA

As duas telas das ilhas **precisam** ser ponto seguro de gravação **dentro da visita** — ela tem
cinco partidas dentro e um prêmio no fim, e fechar a aba no meio não pode zerá-las. Então tirá-las
do `SAFE_SAVE_SCREENS` não serve: o que muda é **de onde se chegou nelas**.

- **`telaSegura(screen, estado)`** responde às duas perguntas, porque elas são a MESMA vista dos
  dois lados: *"posso gravar nesta tela?"* (o autosave) e *"esta tela gravada vale?"* (o
  `applySavedState`). **Fechando só a torneira, os dois saves já presos continuariam presos;
  consertando só a leitura, o save continuaria sendo gravado errado toda vez.**
- **⚠️ E CADA TELA PERGUNTA PELO CAMPO QUE A JUSTIFICA**, nunca as duas pela visita — e este é o
  ponto em que o conserto **quase nasceu com um defeito maior que o original**. O `ilhasFim`
  acontece **DEPOIS** de o `sairDasIlhas` zerar o `ilhasJornada`, e é exatamente ali que os **+3
  níveis do prêmio** acabaram de entrar no time. Perguntando pela visita, a guarda **barraria a
  gravação da maior recompensa da jornada fora do Bônus de Kanto**. Hoje o `ilhas` pergunta pelo
  `ilhasJornada` e o `ilhasFim` pelo `ilhasResultado`.
- **⚠️ O ESTADO É PARÂMETRO E NÃO TEM PADRÃO**, pela mesma razão do `corridaInstancia`: os três
  chamadores do autosave perguntam pelo estado **VIVO** (`game`) e o `applySavedState` pergunta pelo
  **DOCUMENTO** (`data`) — e ali o padrão erraria **em silêncio**, porque a tela é decidida no TOPO
  dele, antes de o `game.ilhasJornada` ser restaurado: ele ainda seria o do save **anterior**. Isso
  só funciona porque os dois objetos usam os mesmos nomes de campo.
- **OS SAVES PRESOS SE SOLTAM SOZINHOS**, na primeira abertura depois do deploy: sem visita, a tela
  cai no `preBattle` — que é o fallback que o `applySavedState` já tinha pra qualquer tela não
  segura, e que no save do relato é **exatamente onde ele deveria estar** (time completo, golpes
  escolhidos, `pendingLevels` ausente, 1 derrota no 6º ginásio). Nada foi escrito no banco à mão.
- **⚠️ E O QUE ELE NÃO CONSERTA, registrado:** se o save estivesse parado no **encontro selvagem**
  quando isso acontecesse, o fallback custaria a oferta daquele trecho. É o comportamento que o jogo
  já tem pra toda tela não segura, e deduzir a tela a partir do estado seria mecânica nova.

**⚠️ A REGRA DO HM01 VALE AQUI INTEIRA, e é a terceira vez que ela é paga:** *nada chamado de FORA
da jornada pode gravar o estado da jornada.*

### ⚠️ E O `ilhasResultado` TINHA O MESMO DEFEITO DO VIZINHO

Achado ao escrever a trava, não por relato: ele era **GRAVADO e nunca lido de volta** — o
`applySavedState` é explícito campo a campo, e quando o `ilhasJornada` foi consertado (21/09) o
**vizinho ficou pra trás**.

O comentário do `serializeGame` promete que sem ele *"um F5 ali engoliria o anúncio do prêmio"* — e
ele era engolido do mesmo jeito, porque ninguém o restaurava: quem reabria o save na tela do prêmio
via o **fallback** dela (`0 de 5`, nenhum nível) mesmo tendo vencido as cinco ilhas. Os +3 níveis
nunca se perderam (eles estão no `team`); o que se perdia era o **anúncio**.

**CONFERIDO QUE NÃO É MOTOR, por impressão:** `MOTOR d19915312988 / DIARIO 741ec5a626c3`, idêntico
ao build anterior em 900 batalhas semeadas — e o instrumento é sensível (com o `CRIT_BASE` mexido os
dois hashes mudam). Bateria: **37 de 37**.

### ⚠️ E AS DUAS TRAVAS PRINCIPAIS NASCERAM MEDINDO A FUNÇÃO, NÃO OS CHAMADORES

Na conferência de acusação, **os dois defeitos que importam passaram em branco**: religando o
autosave e o `applySavedState` pro `SAFE_SAVE_SCREENS` cru, o `podeGravarNaTela` e o `telaDeVolta`
**continuavam certos** — e era só eles que as travas chamavam.

É a armadilha do *"trava que pergunta à função que ela mede não é trava"*, e o conserto é exercitar
o caminho real:

- **o autosave** é dirigido de verdade, e o observável é o **TIMER**: a guarda de entrada é
  síncrona, então barrada ela não chega a armar o debounce (`S.__timers`);
- **a leitura** passa pelo `applySavedState` de verdade, com o documento do relato campo por campo.

Com isso os **5 defeitos religados acusam** (2 a 3 falhas cada) — incluindo o do excesso: uma guarda
que barrasse **todas** as telas passaria nos casos nomeados e quebraria a jornada inteira em
silêncio, e é a varredura das outras 29 telas seguras que a pega.

**⚠️ E UM RENOMEADOR GLOBAL ENTROU NUM COMENTÁRIO.** Ao desfazer uma colisão de nome no teste, o
`split/join` da palavra `preso` trocou também a palavra dentro de um comentário em prosa. É a
armadilha do padrão largo demais, a mesma das regex do `mlog-mais` e do `matchup-row` — e a que já
fez um comentário acusar a si mesmo cinco vezes neste arquivo.

### ⚠️ E O TIME DA TRAVESSIA: `Time [object Object]1`, E DOIS JOGOS TRAVADOS (22/09/2026)

Reportado com print do picker da Pescaria: o card saía **`Time [object Object]1`** com a estrela em
**0**, e o pedido veio junto — *"quando vier atraves da jornada, nem precisa pedir o time, ja deixa
automaticamente o time da jornada atual, para a corrida de revezamento tambem"*.

**⚠️ A CAUSA É A LISTA TER DOIS TIPOS.** O `pescariaElegiveis` devolvia o **OBJETO do save** na
visita e um **SLOT** fora dela:

```js
if(naJornadaDasIlhas()){ const sv = game.saveSlots[game.currentSaveSlot]; return sv ? [sv] : []; }
return savesCampeoes();   // <- numeros
```

E o card faz `Time ${slot + 1}` — com um objeto, `slot + 1` é **`"[object Object]1"`**. A média
zerou pelo mesmo motivo: o `game.saveSlots[objeto]` é `undefined`, então o card desenhava um time
vazio.

**⚠️ MAS O SINTOMA DO PRINT ERA O MENOR DOS DOIS PROBLEMAS — a Pescaria estava TRAVADA.** A ação
faz `pescariaElegiveis().indexOf(Number(slot))`, e `Number({})` é **NaN**: `indexOf(NaN)` é sempre
**-1**, então **escolher o time era impossível** e o duelo nunca começava.

**⚠️ E O REVEZAMENTO DA CORRIDA ESTAVA TRAVADO POR OUTRA PORTA, no mesmo dia.** Ele validava com
`savesCampeoes()` — e **o save da jornada pode não ter as 8 insígnias**: o do relato tinha **5**.
A ação recusava em silêncio, e o `corridaPickerDeTimes` ainda listava **os times campeões da
conta**, que não são o time da travessia. Ou seja **dois dos cinco jogos não davam pra jogar pela
jornada**, e só um deles tinha sintoma visível.

**⚠️ E A RÉGUA DAS 8 INSÍGNIAS NÃO É A MESMA NOS DOIS CAMINHOS, e é isso que a correção separa:**
pela HOME ela existe pra o jogador trazer um time que **terminou** uma jornada; na travessia o time
é **o que ele está jogando agora**, e exigir dele um troféu que a jornada ainda não deu fecharia o
modo justamente pra quem o pedido quer deixar entrar.

#### O CONSERTO: uma lista, um tipo

- **`timesDeIlhaElegiveis()`** é a porta única: `savesCampeoes()` pela home, `[currentSaveSlot]` na
  travessia — **slots nos dois casos**. Ela é lida pelos quatro pontos que decidiam por conta
  própria (os dois `Elegiveis`, o picker de times e a validação do relay).
- **⚠️ E O TIME VEM DO `timeDoSlot`, não do `game.saveSlots`** — a função que o HM01 já tinha
  criado pra isto: *"o `game.saveSlots` é uma cópia carregada na HOME; o `game.team` é o time VIVO
  do save aberto"*. Na travessia isso é a diferença entre pescar com o time de agora e pescar com o
  de antes da última captura e da última distribuição de níveis. Vale nos três lugares que liam a
  cópia (o time da pescaria, o card e o `corridaSpeedDoTime`).
- **E O TIME JÁ ENTRA ESCOLHIDO** (o pedido): na travessia só existe **um** time possível, e **uma
  tela de uma resposta só é pior que tela nenhuma** — a mesma regra que já dispensa a tela de
  golpes de quem tem 2 ou menos disponíveis. O botão de trocar some, o card vira uma **prévia** (uma
  `<div>`, sem ação: um card clicável que reabre uma lista de um item só convida um toque que não
  leva a lugar nenhum) e **quem recusa abrir o picker é a AÇÃO**, não o botão escondido.
- **⚠️ A INDIVIDUAL DA CORRIDA CONTINUA PEDINDO**, e não é exceção esquecida: lá a escolha **existe**
  — qual dos seis corre. O auto-preenchimento é do **revezamento**, onde a equipe é o time inteiro.
- **⚠️ E ELE SÓ PREENCHE SE ESTIVER VAZIO**, senão desfaria a **reordenação** que o jogador acabou de
  fazer com as setas da tela de revezamento toda vez que ele fosse à individual e voltasse.
- **⚠️ O GANCHO DA CORRIDA FICA NO `abrirCorrida`, e não no `corridaZerar`:** entrar na Corrida
  **não passa** pelo zerar (quem o chama é o `sairDaCorrida`), então o auto posto só lá nunca
  rodaria na entrada. Na Pescaria é o contrário — o `abrirPescaria` chama o `pescariaZerar`, e é
  nele que ele mora.

**MEDIDO A 320px, no navegador:** o card da travessia fica em **216×114px**, é uma **`<div>`**, o
nome sai certo (**zero** `[object Object]`), a média é **51** com os **6 sprites**, **nenhum texto
cortado** e **nada rola pro lado** nas quatro telas. Pela home a oferta de escolher continua lá,
inteira (**216×76px**).

**CONFERIDO QUE NÃO É MOTOR, por impressão:** `MOTOR d19915312988 / DIARIO 741ec5a626c3`, idêntico.
Bateria: **37 de 37**.

#### ⚠️ E A TRAVA QUE EXISTIA MEDIA A CONTAGEM, NÃO O TIPO

Ela era `naVisita.pesca.length <= 1` — e **`[objeto]` e `[slot]` têm o mesmo tamanho**, então ela
passava nas duas formas e não pegou nada disto. Hoje ela mede o **TIPO** (`typeof === 'number'` nos
dois modos), o **SINTOMA** (o card sem `[object Object]` e com média > 0) e a **USABILIDADE** (a
ação aceitando o slot da jornada) — que é o que estava quebrado de verdade.

**⚠️ E O FIXTURE PRECISOU DE UM SAVE NÃO-CAMPEÃO.** O do bloco tinha `badgeCount: 8` em todos, e
com ele a trava do revezamento **não distinguiria nada**: o defeito é justamente o save da jornada
**não** ter as 8. Há um `ok` só pra afirmar que o fixture cai na faixa em que a regra vale.

**⚠️ E UM DOS SETE DEFEITOS RELIGADOS PASSOU EM BRANCO:** o `corridaPickerDeTimes` voltando ao
`savesCampeoes()`. A razão é que, com a guarda da ação, **ele é inalcançável na travessia hoje** —
e deixá-lo com a lista errada seria uma bomba-relógio pro dia em que a guarda mudasse. A trava
**força o picker aberto** e cobra a lista, que é a mesma decisão da guarda do `registrarSketch`:
ela vale pro caminho que ainda não existe. Com ela, os **7 acusam**.

**⚠️ E UMA TRAVA MINHA DERRUBOU A VIZINHA:** o bloco desenha a tela da Pescaria, e o
`renderPescaria` **PEDE o ranking** — isso deixava o `pescariaRank` carregado e as três travas de
*"a primeira leitura pede ao servidor"* do bloco seguinte caíam **sem nada estar errado**. O estado
é guardado e reposto no fim. **Trava que deixa rastro derruba a vizinha.**

## AS ILHAS LARANJA ABRIRAM PRA TODO MUNDO, E O MONITOR NASCEU JUNTO (21/09/2026)

Pedido assim: *"crie um monitor para eu conseguir ver quais treinadores já jogaram algum jogo das
ilhas laranjas e quantas vezes ele jogou cada jogo. Após isso, pode tirar que só quem é admin =
true consegue ver os botões das ilhas laranjas e exiba também o modal das novidades"*.

**⚠️ A ORDEM DO PEDIDO É A RAZÃO DE ELE EXISTIR**: o monitor veio ANTES da abertura porque é ele
que diz se o arquipélago pegou. Sem ele, abrir os cinco jogos pra todo mundo seria uma mudança
sem instrumento — e este projeto não faz isso.

### ⚠️ O MONITOR: QUEM CONTA É O SERVIDOR

- **Um contador mantido pelo CLIENTE nunca é confiável**, e essa lição o `registrantCount` da Liga
  Clássica já custou em 20/09: sempre existe cliente velho em cache. Aqui é pior — **a MÉTRICA é o
  motivo da feature**, então uma linha no console a tornaria inútil. Quem escreve é a callable
  `registerIslandPlay`, e o campo entrou na **trava do `firestore.rules`** ao lado de `moedas` e
  `admin`.
  ⚠️ **E ele é o primeiro campo da trava que NÃO dá poder de compra**: mentir nele não compra nada.
  Ele está lá só pela métrica, e isso vale ser dito porque o comentário daquela lista fala em
  "campos de prêmio".
- **⚠️ E ELE MORA NO DOCUMENTO DO USUÁRIO** (`ilhasJogadas`), não numa coleção própria: o painel de
  treinadores **já lê esse documento** por treinador, então o monitor custa **ZERO leitura a mais**
  nele. Numa coleção à parte seriam 20 leituras por página do painel.
- **⚠️ É UM `increment`, NÃO UMA TRANSAÇÃO**: o Firestore o resolve **sem ler**, então duas abas
  contando ao mesmo tempo não se atropelam — e ele não paga a leitura que uma transação pagaria. É
  a mesma escolha do contador de inscritos.
- **⚠️ O ID DA ILHA É VALIDADO CONTRA UMA LISTA FECHADA**, e a lista é **duplicada** no cliente e no
  servidor. Sem a validação, um cliente forjado escreveria chave qualquer dentro do mapa e ele
  viraria lixo que ninguém limpa de fora; sem a comparação das duas listas, **uma ilha que nascesse
  só no cliente seria recusada com `invalid-argument` e sumiria do monitor EM SILÊNCIO**. O teste
  compara as duas.
- **⚠️ E O `merge` NÃO É DETALHE**: sem ele o `set` do contador **substituiria o documento inteiro**
  e apagaria a conta do jogador. Há caso de teste pra exatamente isso, e ele acusa.

**QUANDO ELE CONTA: onde a partida LARGA, não onde a tela abre.** Abrir e fechar o setup não é
"jogou", e o que o monitor mede é partida jogada. São os cinco pontos em que a fase vira jogando:
`corrida.fase='contagem'`, `pescaria.fase='jogando'`, `selecao.fase='draft'`,
`resgate.fase='correndo'` e `queimada.fase='jogando'`.

- **⚠️ E AS CINCO CHAMAM UMA FUNÇÃO SÓ** (`registrarPartidaDaIlha`). Cinco `httpsCallable` escritos
  à mão garantiriam que **o próximo jogo nascesse sem contar** — e ele sumiria do monitor em
  silêncio, que é a pior forma de uma métrica falhar. A trava varre os cinco e cobra que cada
  chamada esteja **colada na largada**.
- **ELA É BEST-EFFORT**: falhar não pode atrapalhar a partida, e o pior caso é uma partida que não
  entra na conta. Travar a largada por causa do monitor seria o monitor atrapalhando o que ele
  existe pra medir. **E sem login ela nem tenta** — a callable recusaria, e uma ida ao servidor que
  nunca pode dar certo é desperdício.

**NA TELA DO PAINEL são DUAS coisas, porque a pergunta tem duas metades:**

| | responde |
|---|---|
| a **ficha** na conta de cada treinador (`Mikan · Resgate: 12`) | *quantas vezes ELE jogou cada jogo* |
| o **resumo** no topo (`🏝️ Ilhas Laranja: 2 treinadores · 23 partidas`) | *QUAIS treinadores já jogaram* |

Sem o resumo, responder a primeira metade exigiria abrir os 20 cards um a um.

- **⚠️ E O RESUMO DIZ QUE CONTA SÓ O QUE ESTÁ CARREGADO** (`(dos 3 carregados)`): o painel é
  **PAGINADO**, então um número apresentado como total do jogo mentiria em toda página que não
  fosse a última. É o mesmo cuidado do aviso de online truncado, logo acima dele.
- **O zero fica de fora**, como no inventário: o `increment` deixa a chave em 0 e um "0× Corrida"
  seria ruído. E **quem nunca jogou vem com lista VAZIA**, nunca `undefined` — a tela faz
  `.forEach` nela.
- Os cinco nomes vivem no painel, como os onze de item: ele não carrega a tabela do jogo.

### A ABERTURA: AS SEIS PORTAS

Saíram o botão da home, o `abrirIlhas`, os cinco `abrir*` e as duas guardas de **largada** (a da
Corrida e a da Arena) — **dez pontos**. O `game.ehAdmin` **continua existindo**: ele é a porta do
**painel**, que é onde o monitor se lê. O que saiu foi só o uso dele como porta das ilhas.

- **⚠️ O QUE NÃO ABRIU foram as réguas de JOGO**: a Corrida individual, a Pescaria, o Resgate e a
  Arena continuam pedindo um time com as **8 insígnias**, porque montam a partir dos saves. A
  **Seleção nunca pediu** — o bolo dela é sorteado na hora.
- **⚠️ E O `conferirNovidades` MANTEVE O `contaCarregada`, com a razão TROCADA**: antes ele era
  parte da guarda de admin; hoje ele existe porque o `novidadeVista` vem do documento da conta —
  sem esperar a leitura ele é `undefined` no primeiro desenho, e **o anúncio abriria de novo pra
  quem já leu**.

**MEDIDO A 320px, numa conta COMUM (`ehAdmin = false`):** os cinco botões de modo, o das Ilhas em
**281px** ocupando a linha inteira (a fileira é de duas colunas, e com quatro modos normais ele
ficaria sozinho na quinta célula), **nenhum texto cortado e sem rolagem lateral**.

### O QUE ISSO CUSTOU AO JOGO: NADA

**`MOTOR d159ac3d1cb5 / DIARIO a0c57e0f0362`, idêntico** em 900 batalhas semeadas — e o instrumento
é sensível (com o `CRIT_BASE` mexido os dois hashes mudam).

### ⚠️ E DEZESSEIS TRAVAS MEDIAM A PORTA QUE ACABOU

Elas cobravam a RECUSA em seis arquivos (`test-ilhas`, `test-corrida`, `test-pescaria`,
`test-queimada`, `test-resgate`, `test-selecao`) — **e não foram apagadas: viraram a trava da regra
NOVA**, senão alguém reintroduz a porta e ninguém vê. É a mesma decisão das cinco que caíram quando
o trecho da Corrida virou 150 m.

A que importa é a do `test-ilhas`: ela varre **as SEIS portas num laço só**. Cada uma tinha a guarda
escrita separadamente, então uma que ficasse pra trás não apareceria em teste nenhum dos outros
arquivos — só pra quem não é admin, em produção.

**⚠️ E UMA DELAS FIXAVA UM NÚMERO:** o `test-inventario` cobrava que a home tem **exatamente 4**
botões de modo, e caiu quando a fileira ganhou o quinto — **sem nada estar errado**. Hoje ela
**NOMEIA os quatro**, que é o que ela sempre quis provar (a recusa dos modos de campeão não esconde
os botões). É a terceira vez que esta família de trava envelhece aqui.

### ⚠️ E A FERRAMENTA DE ACUSAÇÃO MENTIU DUAS VEZES, pelas DUAS armadilhas já registradas

Os 10 defeitos religados acusam — mas o script de acusação disse *"4 passaram em branco"* na
primeira rodada e *"3"* na segunda, e **as duas vezes o errado era ele**:

1. **ele contava só `FALHOU`, e metade dos testes imprime `FALHA`** — é literalmente a mesma
   armadilha que este arquivo já registra ("a ferramenta de acusação mentiu junto");
2. **o `\b` do regex virou o caractere BACKSPACE (0x08)** ao passar por um `node -e` no shell, e o
   padrão virou `/FALHOU|FALHA^H/` — que nunca casa. Foi o **`cat -A`** que revelou, exatamente
   como o arquivo sugere.

**A regra fica mais forte: um "passou em branco" é suspeito ANTES de o defeito ser suspeito** — e
o jeito de separar os dois é religar o defeito **na mão** e olhar a saída.

## O ANÚNCIO DAS NOVIDADES NA HOME (21/09/2026)

Pedido assim: *"quando os usuários abrirem o jogo pela primeira vez, coloque para exibir um modal
na tela home com os updates, fale das ilhas laranjas e de um breve resumo sobre cada ilha"*.

### ⚠️ ELE APARECE SÓ PRA QUEM É ADMIN, e essa é a decisão que o pedido obrigou a tomar

As Ilhas Laranja são **administrativas**: o botão da home só existe com `admin === true` e as
**SEIS** portas (o `abrirIlhas` mais os cinco jogos) recusam quem não é. Então um anúncio pra "os
usuários" falando delas **anunciaria cinco jogos que ninguém consegue abrir** — o jogador leria o
modal e procuraria na home um botão que não está lá.

Perguntado antes de escrever, com as três saídas medidas em custo (abrir as ilhas pra todos /
anunciar como "em breve" / anunciar só pra quem entra), **a escolha foi a terceira**. O anúncio
chega a quem consegue entrar, e **no dia em que as ilhas abrirem é uma linha** no
`conferirNovidades`.

- **⚠️ E ENQUANTO A CONTA NÃO CARREGOU ele não nasce**, exatamente como o botão — e aqui o lado
  seguro é o **CONTRÁRIO** do da porta dos modos de campeão, que erra pro lado de DEIXAR ENTRAR:
  mostrar um anúncio administrativo a quem não é admin, mesmo por meio segundo, é pior que
  atrasá-lo meio segundo pra quem é.
- **⚠️ É `=== true`, exatamente o booleano:** `'sim'`, `1`, `'true'` e `''` **não** abrem. É a
  mesma régua da porta das ilhas, e há caso de teste pros oito valores.
- **⚠️ E SÓ NA HOME**: o `loadPermanentUserData` roda também ao abrir a **Pokédex** e as
  **Conquistas**, e um modal cobre a tela inteira. Sem a guarda de tela o anúncio nasceria por cima
  de outra — há caso pras quatro telas.

### ⚠️ A MARCA É A VERSÃO DO ANÚNCIO, NUNCA UM BOOLEANO DE "JÁ VIU"

Com um booleano este seria o **único anúncio da vida do jogo**: o próximo update não teria como
reaparecer, e alguém teria que limpar o campo de todas as contas na mão. Com a versão
(`NOVIDADES_VERSAO`), o próximo é **uma linha** — e conta nova, que não tem campo nenhum, vê este.

- **⚠️ O CAMPO É DA CONTA** (`users/{uid}.novidadeVista`), **não do save**: quem leu não pode reler
  ao abrir outro save. É a mesma razão do `hms` e do `visitouOsNinhos` — e, como eles, ele é
  registro de **LEITURA** e não poder de compra, então continua **LIVRE pro dono** no
  `firestore.rules`: **não houve uma linha a mexer nas regras nem no servidor**.
- **⚠️ E OS DOIS CAMPOS ENTRARAM NO `CAMPOS_DA_CONTA`** (`novidadeVista` e o `novidadesModal` de
  tela): sem isso o `resetGame` os apagaria ao abrir um save e o anúncio voltaria pra quem já leu.
  É a lição do `hms`, do `visitouOsNinhos` e do `hmGanhoModal`.
- **A gravação é best-effort** (o molde do `darHM` e do rival padrão): falhando, o anúncio volta na
  próxima abertura — **que é o lado certo pra errar**, porque ver duas vezes é melhor que nunca
  ver. O `game` é escrito **na hora** pra ele não reabrir nesta sessão mesmo sem a confirmação.
- **OS DOIS BOTÕES MARCAM COMO LIDO** — o que marca é ter **LIDO**, não o caminho tomado. Sem isso
  quem clica em "Ver as Ilhas" reencontraria o anúncio na próxima vez que abrisse a home.

### ⚠️ O RESUMO DE CADA ILHA SAI DO `ILHAS_COMO`, NUNCA ESCRITO NO MODAL

Ele já existia, ao lado do nome e do líder — é o mesmo texto que o **(i)** do mapa mostra. Uma
segunda lista divergiria dela no dia em que uma ilha nascesse ou trocasse de jogo, que é
literalmente a razão pela qual aquele campo mora na tabela. **Ilha sem entrada lá não entra no
anúncio**, porque ali não há o que resumir — a mesma regra que faz o (i) não aparecer nela.

A trava que prova isso **mexe no resumo da tabela e cobra que o modal acompanhe**: sem esse caso,
uma cópia escrita à mão passaria em todos os outros.

### ⚠️ TRÊS ANDARES, E NÃO A CAIXA INTEIRA ROLANDO

O padrão dos modais compridos da casa é `max-height:85vh; overflow-y:auto` na caixa (as Variações
do Unown, os aptos do TM, a lista da rota) — e **aqui ele não serve**: lá o único botão é *Fechar*,
e aqui o principal **LEVA a outro lugar**.

**Medido a 320×568 com a caixa rolando inteira: os DOIS botões caíam abaixo da tela** — o jogador
teria que rolar pra descobrir que existe um. Hoje é o desenho da **loja** e do quadro da
**notificação**: topo, miolo que cede, rodapé colado.

- **⚠️ `min-height:0` no filho de flex que rola** — sem ele o item **não encolhe** abaixo do
  conteúdo e a caixa estoura o teto. É a mesma família do `1fr` que não encolhe.
- **⚠️ E O MIOLO CEDE ATÉ SUMIR:** na primeira medição a lista ficou com **45px — UMA linha de
  cinco**. Não foi o flex que estava errado, foi o conteúdo ser grande demais pra 568px. O que
  saiu foi o que a própria lista já dizia.

**O QUE FOI CORTADO, e por quê:**

| | ganho |
|---|---|
| o `<h2>` foi de *"Novidades: as Ilhas Laranja"* pra **"Novidades"** | **27px** — na fonte de PIXEL o título longo quebra em duas linhas a 320px, e quem nomeia as ilhas é a frase logo abaixo |
| a frase de abertura encurtou pra *"As **Ilhas Laranja** abriram — 5 desafios novos:"* | 21px |
| **saiu** o rodapé que explicava o **ⓘ** do mapa | **57px** — mais de uma linha de ilha, e ele contava uma coisa que a tela das ilhas conta no instante em que o jogador chega lá |

**MEDIDO NO NAVEGADOR depois dos cortes:**

| | 320×568 | 390×844 (iPhone 16e) |
|---|---|---|
| modal | **265×483px** | 335×589px |
| a lista mostra | **2,9 de 5** ilhas, rolando | **as 5 inteiras** (251 de 251) |
| os dois botões | **dentro da tela** | dentro da tela |
| rolagem lateral | **nenhuma** (305 de 320) | nenhuma |
| linha de ilha | 43px, nenhum nome truncado, nenhum resumo cortado | — |

- **⚠️ E O SELO DE CADA ILHA SÓ APARECEU NA SEGUNDA CAPTURA.** A primeira saiu com as cinco linhas
  **sem ícone** — e não era o código: o `montarSelos()` injeta o `<svg>` dos símbolos no
  `document.body` **de verdade**, e a página de prévia é montada pelo sandbox, que não tem body.
  A prévia passou a injetá-los na mão. **Quem for medir uma tela com selo fora do jogo precisa
  disso, senão todo `<use href="#s-x">` sai vazio** — e isso se lê como um defeito que não existe.

### O QUE ISSO CUSTOU AO JOGO: NADA

**`MOTOR d159ac3d1cb5 / DIARIO a0c57e0f0362`, idêntico** ao build anterior em 900 batalhas
semeadas — **e o instrumento é sensível**: a mesma medição com o `CRIT_BASE` mexido muda os dois
hashes. Sem essa segunda metade, um hash que nunca muda não prova nada.

`tools/test-ilhas.js` ganhou **34 pontas**: o acesso nos 8 valores do campo, a conta carregando, as
4 telas, a versão (quem leu não relê, quem leu uma ANTIGA vê), o fechar marcando e gravando **com
merge**, o botão que leva às ilhas marcando também, o conteúdo derivado do `ILHAS_COMO` (com a
tabela mexida), a ilha sem resumo ficando de fora, e — **lendo o código** — os dois campos no
`CAMPOS_DA_CONTA`, a chamada não ficando órfã no `loadPermanentUserData`, o modal anexado ao render
e a marca não indo pro save. **E, lendo o CSS**, os três andares — isso não aparece em asserção de
HTML nenhuma, que é a lição do `[hidden]` que deixou o modal da contagem da Corrida preso na tela.

**Conferido que os 9 defeitos religados acusam** (1 a 9 falhas cada).

### ⚠️ E ELE REABRIA: A RELEITURA DA CONTA REBAIXAVA A MARCA (21/09/2026)

Pedido assim: *"após o usuário ver a mensagem de novidades e clicar em Ok, esse modal não deve mais
aparecer, deve aparecer somente 1x e depois não exibir mais"*.

**A marca já existia** (o `fecharNovidades` grava desde o primeiro dia) — **o que faltava era ela
SOBREVIVER à releitura da conta**, e o furo foi reproduzido antes de qualquer conserto:

```
1) primeira home    -> abre
2) fechou           -> marca = "ilhas-laranja"
3) releu a conta    -> marca = null        <- aqui
4) de volta na home -> abre DE NOVO
```

- **⚠️ A JANELA É COMUM, não um caso de canto.** A gravação é **best-effort** (sem `await`, o molde
  do `darHM`) e o `loadPermanentUserData` roda **toda vez que se volta pra HOME** e ao abrir a
  **Pokédex** e as **Conquistas** — quem voltasse antes de ela propagar tinha
  `d.novidadeVista` vazio e a linha `|| null` **zerava a marca em memória**.
- **O conserto é `|| game.novidadeVista` no meio**: esta marca **só CRESCE**. É a mesma regra do
  `arrayUnion` da Pokédex — a única escrita que não pode encolher —, e é por não ser assim que um
  jogador já perdeu 49 espécies.
- **⚠️ E ELA NÃO É "o campo vazio não sobrescreve": um valor vindo do BANCO continua ganhando** do
  que está em memória, senão um anúncio novo publicado noutra aba nunca chegaria nesta.

**⚠️ E O PRIMEIRO REPRO MEDIU UMA CÓPIA DA REGRA.** Ele simulava a linha à mão
(`g.novidadeVista = d.novidadeVista || null`) em vez de chamar o `loadPermanentUserData` — ou seja
**ele continuaria "acusando" com o conserto aplicado**, porque media o que estava escrito nele
mesmo. É a armadilha do *"trava que pergunta à função que ela mede não é trava"*, e só a
conferência de acusação separa os dois casos.

**⚠️ E A SEGUNDA VERSÃO DELE MEDIU A PORTA, NÃO A MARCA:** chamando o `loadPermanentUserData` de
verdade, o stub do Firestore devolve um documento **VAZIO** — então ele zera o **`ehAdmin`** junto,
e o anúncio deixava de abrir pelo motivo errado. Os dois lados davam `false` e o furo sumia. Repor o
`ehAdmin` depois da releitura (na vida real ele vem do documento) é o que faz o caso cair na faixa
em que a regra vale — a mesma lição dos fixtures do `preservePlayerHp` e do painel forte demais.

### O ÍCONE NO TÍTULO E O LARANJA (21/09/2026)

Pedido junto: *"como estamos falando das ilhas laranjas, adicione o mesmo ícone que está no botão,
no título dessa mensagem, e também adicione algum elemento da cor laranja"*.

- **O selo foi pro `<h2>`, e o `modal-icon` de cima SAIU** — senão o mesmo ícone apareceria duas
  vezes na mesma caixa. **De quebra isso devolveu 45px**, e a lista passou de **2,9 para 4,4 das 5
  ilhas** visíveis a 320px.
- **⚠️ A TRAVA COMPARA COM O SELO DA HOME, não com o nome `ilhas` escrito nela:** se o botão trocar
  de selo um dia, é o anúncio que tem que acompanhar.
- **⚠️ A COR GANHOU DONO** (`COR_ILHAS`). Ela pinta a **borda da caixa** e o **botão principal** do
  anúncio **e** o botão da home — escrita à mão nos dois, a segunda divergiria no primeiro ajuste e
  **o anúncio deixaria de casar com o botão que ele manda procurar**. Há trava cobrando que o valor
  apareça **uma vez só** no arquivo.

**⚠️ E O NÚMERO DO CONTRASTE FICA REGISTRADO, porque ele é baixo:** o texto branco sobre o laranja
dá **3,01:1** — medido no navegador. **Ele não é regressão desta feature**: é exatamente o que o
**botão da home já pratica** desde 21/09 (o roxo da Batalha Online, pra comparar, dá **5,82**).

Ele fica porque é a **identidade** das ilhas, e porque trocar só no modal desfaria o casamento com
o botão. O que entrou foi a **sombra no texto** — o mesmo remendo das plaquinhas de nome da
Corrida —, que melhora a leitura sem mexer na cor.
**Se um dia incomodar, a régua é o `COR_ILHAS`: escurecê-lo conserta os DOIS lugares de uma vez**
(pra 4,5:1 com branco ele precisa ir de L=0,297 pra ~0,183).

**MEDIDO A 320px DEPOIS:** modal **265×483px**, título em **1 linha**, a lista em **4,4 de 5**, os
dois botões dentro da tela e **nenhuma rolagem lateral**. `tools/test-ilhas.js` ganhou **10 pontas**,
e **os 7 defeitos religados acusam**.

## SELEÇÃO POKÉMON: O DRAFT DA ILHA KUMQUAT (21/09/2026)

Pedido assim: *"vai ser uma batalha contra um líder, e vão ser sorteados 12 pokémons aleatoriamente,
menos os lendários, e então o treinador e o líder vão ter que montar o time selecionando 1 desses 12
até ficar 6x6. O líder do ginásio vai escolher 1 e o usuário vai escolher 2, depois o líder escolhe
2 e o usuário escolhe 2 e assim vai até acabar os pokémons, depois o treinador vai escolher a ordem
que vai entrar na luta"*.

**⚠️ É O ÚNICO DOS QUATRO QUE NÃO USA O TIME DO JOGADOR.** Os 12 são sorteados na hora e os dois
lados montam do MESMO bolo -- então não há picker de save, e **não há régua de 8 insígnias**: exigir
uma coleção que o modo não usa seria uma porta sem razão. O que se mede aqui é a ESCOLHA.

**⚠️ A ORDEM DO PEDIDO É EXATAMENTE JUSTA, e isso foi MEDIDO e não escolhido.** Com os dois lados
pegando sempre o melhor disponível, o snake `1-2-2-2-2-2-1` distribui as posições assim:

| | pega as posições | soma |
|---|---|---|
| **líder** | 1, 4, 5, 8, 9, 12 | **39** |
| **você** | 2, 3, 6, 7, 10, 11 | **39** |

É essa propriedade que faz o modo não ser decidido pela vez -- e ela é uma trava: a ordem tem que
**fechar** com o bolo (12) e dar 6 pra cada lado. Uma ordem que some 11 ou 13 deixa o jogador com 5
ou o bolo com sobra, e isso **não aparece como erro**: aparece como uma tela que não avança.

**⚠️ O QUE A ESCOLHA VALE, MEDIDO** (400 drafts, os dois lados com a mesma política):,,| o jogador | vence | na faixa baixa | média | alta |,|---|---|---|---|---|,| pegando o de maior BST, como o líder | **50,0%** | 51,7% | 52,6% | 46,0% |,| pegando o PIOR de cada vez | **11,5%** | 4,5% | 8,2% | 19,5% |,,**50% é moeda ao ar** -- a consequência do snake ser justo -- e **38,5 pontos de amplitude** é o,que a decisão vale. Sem esses dois números o draft seria enfeite.,,**⚠️ ELA VALIA 46 PONTOS ATÉ AS TRÊS FAIXAS ENTRAREM (48,0% x 1,8%), e a queda tem causa:** com o,nível fixo em 60 a lista crua punha um **Caterpie (BST 195) ao lado de um Dragonite (600)** no,mesmo bolo; com a espécie acompanhando o nível, aquele Caterpie vira Butterfree e a amplitude de,BST **dentro** de um bolo cai pra ~217. Escolher mal continua sendo ruim, só deixou de ser,suicídio -- e na **faixa alta** (onde quase tudo já está evoluído) o pior time ainda ganha 19,5%.

- **⚠️ O LÍDER PEGA O DE MAIOR BST, e isso é uma linha de propósito**: é a régua mais simples que
  existe, ela é MEDÍVEL, e com ela o snake sai empatado. Se um dia ele precisar ser mais esperto, é
  no `selecaoEscolhaDoLider` -- e a régua está aqui.
- **⚠️ O NÍVEL SAI DE UMA DAS TRÊS FAIXAS, e uma partida inteira roda numa faixa só** -- ver **AS
  TRÊS FAIXAS DE NÍVEL**, logo abaixo. Ele foi fixo em 60 (`SELECAO_NIVEL`) até 21/09/2026.
- **NEM LENDÁRIO NEM INTOCÁVEL** -- um Mewtwo no bolo decidiria o draft sozinho --, **e sem repetir
  LINHA evolutiva**: com Magikarp e Gyarados no mesmo bolo, os 12 viram 11 opções de verdade. É a
  mesma regra do encontro selvagem e dos guardiões da Montanha. Medido em 400 bolos: sempre 12,
  zero lendários, zero linhas repetidas.
- **⚠️ OS DOIS LADOS LEVAM O MOVESET INTEIRO DA ESPÉCIE** (`equiparNpc`): ninguém ESCOLHEU golpe
  aqui (o bolo é sorteado, não vem de save), e a regra da casa é que quem não escolhe cai no
  moveset por nível. Dar a um lado e não ao outro seria a assimetria que o pedido não pede.
- **⚠️ A ESPECIALIDADE E OS ITENS VÃO VAZIOS**, de propósito: os 12 não são do jogador. Uma
  especialidade de tipo faria o MESMO bolo valer mais numa conta que na outra.
- **⚠️ QUEM JÁ FOI ESCOLHIDO NÃO SOME DO BOLO**: ele apaga e ganha a FAIXA de quem levou. Sumindo,
  o jogador perderia a única coisa que um draft tem a contar -- o que o outro lado está montando.
- **O LÍDER ESCOLHE NA FRENTE DO JOGADOR** (`SELECAO_PAUSA_NPC`, 700ms por escolha): sem a pausa
  ele leva os dele todos no mesmo quadro e o que se vê é uma lista que se preenche sozinha.
- **QUEM RECUSA É A AÇÃO**: fora da vez, fora da fase, no card já levado e no índice forjado.

**A BATALHA É A DA CASA, sem uma linha de motor próprio**: `simulateGymBattle` e o MESMO ciclo de
revelação da Torre (`trainerBattling`), que já sabe animar um resultado com `matchups`. O que a
distingue é a marca (`selecaoBattlePending`), como a Torre e a raide -- sem ela a batalha voltaria
pro destino do vizinho. E o resultado reusa o `renderMatchupLog` de sempre.

**⚠️ E A TRAVA DO GOLPE FANTASMA PEGOU UM DEFEITO DE VERDADE AQUI.** O `selecaoLutar` entrava em
`loading` sem chamar o `abrirConfronto`, então o passo e o último golpe do confronto ANTERIOR
sobreviviam e o primeiro quadro anunciaria um golpe que ninguém deu. É o defeito de 09/09/2026, e a
trava do `test-especiais` -- que conta os `RevealPhase` contra os `abrirConfronto` -- é exatamente
o que existe pra pegá-lo. **Ela pagou o preço dela hoje.**

**Medido a 320px, no navegador:** o draft em **1.268px** com os 12 cards de **78×200 a 259px** em
**3 colunas e 4 fileiras**, nenhum nome truncado, a faixa de quem levou visível; a tela de ordem em
**1.715px** (os 6 seus com setas mais os 6 dela) e a de resultado em **1.667px** -- sem rolagem
lateral em nenhuma das três. (Os cards mediam 72×71px até 21/09/2026.)

**No motor, nada:** `MOTOR 385943f3e1fa / DIARIO 850af0fd1763`, idêntico em 900 batalhas semeadas.

⚠️ **E UMA TRAVA MINHA NASCEU MEDINDO O QUE A ESPÉCIE NÃO TEM:** ela cobrava que os 6 de cada lado
tivessem moveset, e o `equiparNpc` dá o moveset **por NÍVEL** -- há espécie que não aprende golpe de
dano nenhum (o Ditto). Ela falharia num bolo que sorteasse um deles: **um flake, o pior tipo de
teste que existe**. Hoje ela compara com o que a espécie OFERECE.

`tools/test-selecao.js` tranca **69 pontas**: o acesso (e a ausência da régua de insígnias), a
ordem fechando e sendo justa, o bolo em 400 sorteios, a ação recusando nos quatro casos, o draft
fechando em 6x6 com os dois levando moveset, **o que a escolha vale**, as três faixas, o card, os
dois `<h2>`, as setas da ordem, a batalha caindo no ciclo da casa com o 1º de cada lado se
encarando, e nada indo pro save. `tools/test-selecao-rank.js` tranca **25** no servidor.
**Conferido que os 12 defeitos religados acusam** (as 7 de 21/09 mais as 5 de hoje).

### AS SEIS DA SELEÇÃO (21/09/2026) -- o card grande, as três faixas e o ranking

Pedidas na mesma leva, horas depois de o modo nascer: *"pode aumentar o card de cada pokemon que
enfrenta a Luana na Ilha Kumquat, e exiba level, tipos e ataques que cada um possui. A líder sempre
vai optar pelo maior bst disponível. Exiba 3 cards de pokemon por linha, totalizando 4 linhas. Será
sorteado 3 faixas de level ... A fonte do Seu Time e Time de Luana, pode deixar igual as outras
fontes ... e troque o texto "Seu Time" por "Time de Treinador". Após a batalha, exiba um quadro
mostrando o top10 melhores aproveitamentos contra a Luana ... Pode retirar o botão "Sortear outro
bolo""*.

#### ⚠️ AS TRÊS FAIXAS DE NÍVEL, E A ESPÉCIE TEM QUE ACOMPANHAR

`SELECAO_FAIXAS` são **[20-30], [35-45] e [55-60]**, e uma partida inteira roda numa faixa **SÓ** --
que é o pedido ao pé da letra (*"então uma batalha contra sempre vai ser todos os pokemons entre o
level 20-30 ou..."*). O `SELECAO_NIVEL = 60` morreu.

- **⚠️ E A ESPÉCIE ACOMPANHA O NÍVEL** (`formaNoNivel`), que é a outra metade do pedido (*"sempre
  exibir as evoluções de acordo com a faixa de level"*). **Foi na Vigília que isso custou um
  relato** -- *"está aparecendo Charizard no level 24, Poliwrath no level 25"* --, e a lição de lá
  vale inteira aqui: o `especieNoNivel` só anda **PRA FRENTE**, então quem sorteia da dex INTEIRA
  precisa do `formaNoNivel`, que **DESCE** a linha até a forma que existe naquele nível.
- **O QUE ISSO PRODUZ, medido** (400 bolos por faixa):

  | faixa | BST médio | espécies distintas |
  |---|---|---|
  | **20-30** | **378,7** | 159 |
  | 35-45 | 448,9 | 166 |
  | **55-60** | **471,1** | 133 |

  As três são três jogos diferentes: na baixa entram as formas base e na alta elas somem. É
  justamente esse degrau que a trava cobra (`alta > baixa + 40`) -- um número fixo ali envelheceria
  no primeiro ajuste de faixa.

**⚠️ E A INSTÂNCIA PASSOU A NASCER NO SORTEIO, não no fim do draft.** Ela nascia no
`selecaoFecharDraft`, o que era inofensivo enquanto o card mostrava só o nome; **com o card
mostrando os GOLPES**, o `equiparNpc` rodaria duas vezes -- uma pro card e outra pro time -- e a
tela prometeria um moveset que a batalha não levaria. Hoje o draft só SEPARA (`.map(p => p.mon)`), e
há trava cobrando que o objeto do time seja **o mesmo** do bolo.

#### O CARD

Ele traz **sprite, nome, nível, os selos de tipo e os golpes** (em ordem de poder efetivo
decrescente, a mesma do cartão de golpe). Medido: **3,78 golpes por card**, o maior com 10, e **13
cards em 2.400 sem golpe nenhum** -- o `equiparNpc` dá o moveset por NÍVEL, e há espécie que não
aprende golpe de dano em nível nenhum (o Ditto). Esses saem com a linha vazia em vez de mentir.

- **O SELO DO GOLPE É O `golpeSeloHtml` DA CASA**, o mesmo do log de batalha e das três telas de
  golpe: reusá-lo é o que faz o Talho aqui ser o mesmo Talho de lá.
- **3 POR LINHA, 4 FILEIRAS** -- `repeat(3, minmax(0,1fr))`, e o `minmax(0,...)` não é detalhe:
  `1fr` é `minmax(auto,1fr)` e **não encolhe abaixo do conteúdo**, então um nome comprido empurraria
  a grade pra fora dos 320px. É a armadilha que a fileira de cinco cards da home já pagou.
- **A GRADE DEIXOU DE SER A `tower-pick-row`**: aquela é a grade de quadradinhos do montador, e o
  card aqui tem quatro linhas de conteúdo.

#### ⚠️ OS DOIS TÍTULOS ERAM UMA CLASSE FANTASMA

O pedido foi *"deixe igual as outras fontes, mais bonita, maior"*, e a causa do relato é melhor
que "eles eram menores": eles eram `<div class="section-title">`, **e essa classe nunca teve regra**
**na folha** -- ela existia em exatamente dois lugares do arquivo, os dois criados por mim no dia
anterior. Ou seja eles saíam em **texto de corpo**, ao lado de um "A ordem de entrada" que já é
`<h2>`.

⚠️ **CLASSE QUE NÃO EXISTE NÃO DÁ ERRO: ela só não faz nada**, e só a captura de tela pega. É a
mesma família do `var(--cream)` que deixou uma aba transparente, do `var(--yellow-soft)` que não
realçava e da variante de cor do botão de fisgar da Pescaria.

⚠️ **E A VARREDURA DE CLASSE FANTASMA QUE EXISTE NÃO PEGAVA ESTA:** a do `test-pescaria` varre o
jogo inteiro, mas só o que está em `class="btn ..."`. Medido hoje, um sweep de TODAS as classes
acha **16 órfãs em 765** -- todas anteriores a isto e nenhuma tocada aqui. Fica registrado como
lacuna conhecida: estendê-la exigiria uma lista de 16 nomes conhecidos, que é uma manutenção que
ninguém pediu.

Hoje os dois são `<h2>`, e conferido no navegador: os **três** títulos da tela saem em Press Start
2P 12.8px peso 700, e `section-title` **não aparece mais em lugar nenhum do arquivo**.

#### O TOP 10 CONTRA A LUANA

⚠️ **É O TERCEIRO RANKING DO PROJETO, E O PRIMEIRO QUE GRAVA UM CONTADOR.** O da Pescaria guarda o
melhor PLACAR e o da Corrida o melhor TEMPO -- os dois são recordes que **só andam pra um lado**, e
um cliente forjado no máximo poria um número bom. Aqui o que se grava são **partidas, vitórias e
derrotas**, e um cliente forjado poria **999 vitórias e 0 derrotas**.

- **⚠️ O QUE CHEGA É UM BOOLEANO (`venceu`), e a conta é do SERVIDOR.** Aceitar `partidas`/
  `vitorias` do cliente seria deixá-lo escrever o próprio aproveitamento por outro caminho -- e há
  trava mandando os quatro campos juntos e cobrando que nenhum entre.
- **E `venceu` AUSENTE OU DE OUTRO TIPO CONTA COMO DERROTA**: ele é lido como `!!`, senão um
  `'sim'` viraria vitória por ser truthy num campo que o servidor não controla.
- **⚠️ O `aproveitamento` É GRAVADO, não calculado na leitura: o Firestore não ordena por uma RAZÃO
  entre campos.** Ele é derivado na MESMA transação que conta a partida, então não tem como ficar
  velho. É a primeira vez que este projeto precisa disso.
- **A ORDEM É PELO APROVEITAMENTO, com as PARTIDAS como desempate** -- e a **consequência é
  conhecida e aceita: 1 vitória em 1 (100%) fica ACIMA de 18 em 20 (90%)**. A tabela mostra as
  partidas justamente por isso: quem lê vê o denominador. Se um dia incomodar, a régua é um mínimo
  de partidas pra entrar na lista.
- **A TRANSAÇÃO É OBRIGATÓRIA aqui**, e não conveniência: o que se escreve **depende do que se
  leu**. Nos outros dois ela protege um empate; aqui ela protege a contagem.
- **O NOME FICA DENORMALIZADO** e o **MEU resultado volta junto mesmo fora do top** -- as duas
  regras dos outros dois rankings, pelos mesmos motivos (10 leituras a menos; quem está em 14º
  abriria a tela e não veria nada seu).
- **A coleção é `allow write: if false` INCLUSIVE pro dono**, e a trava **lê a regra como texto**.
- **É UM DOCUMENTO POR JOGADOR**: quatro envios deixam um documento, e a coleção não cresce sem
  limite.

**O "SORTEAR OUTRO BOLO" SAIU, e a função foi junto** -- ela não tinha outro chamador, e função de
apresentação sem chamador é exatamente o tipo de coisa que fica anos no arquivo. Há trava pros dois.

#### ⚠️ E O `fake-firestore` GUARDAVA SÓ O ÚLTIMO `orderBy`

Este ranking é o primeiro do projeto com **dois critérios** (`aproveitamento` desc, `partidas`
desc), e o fake substituía um pelo outro em vez de **encadear**: a lista saía ordenada pelo
**DESEMPATE**, que é uma ordem que a produção nunca devolve. Um teste escrito em cima disso
"provaria" uma ordem errada.

⚠️ **É A SÉTIMA VEZ QUE O DUBLÊ É MAIS PERMISSIVO QUE A PRODUÇÃO** -- depois do `increment` dentro
de mapa, do ponto no `update()`, do `getAll` da transação, do `arrayUnion`, do `count()` e do
`undefined` que matou as duas ligas. **O fake tem que doer onde a produção dói**, e aqui ele tinha
que ordenar como ela ordena. De quebra a exclusão de quem não tem o campo passou a valer pra
**TODOS** os critérios, que é o que o Firestore faz.

**No motor, nada:** `MOTOR 385943f3e1fa / DIARIO 850af0fd1763`, idêntico em 900 batalhas semeadas.


### O TÍTULO DO DRAFT DIZ QUANTOS FALTAM (21/09/2026)

Pedido assim: *"na tela de escolher os pokemons na ilha kumquat, coloque para quando for a vez do
usuário escolher os times, apareça assim: Sua vez: Escolha 2 pokemons"*. Ele era **"Sua vez"**, e a
linha que dizia quantos faltavam tinha saído horas antes — as duas prévias de time a substituíram.

**⚠️ O NÚMERO É DERIVADO DO `selecao.restam`, nunca escrito à mão — e é isso que a trava cobra.**
Ele é **quantos FALTAM nesta vez**, e o `selecaoDescontar` o move: escolhido o primeiro do par, o
título passa a dizer **"Escolha 1 pokémon"**, que é justamente o que o jogador quer saber ali.

Com o **2 fixo** ele mentiria **na segunda metade de TODA vez** do jogador, e mentiria de novo no
dia em que a `SELECAO_ORDEM` tivesse um passo de 1 ou de 3. É a mesma armadilha do
*"Golpe repete entre 2-5x"*, do *"Revezamento · 900 m"* e da legenda das faixas do Resgate:
**texto fixo que descreve uma tabela envelhece com ela.** O plural acompanha pela mesma razão.

- **A vez DELA não mudou**: continua *"Luana está escolhendo…"*, e a caixa não muda de altura entre
  as duas vezes — as duas frases caem em **2 linhas** na fonte de pixel.
- **Medido a 320px:** o título em **243×44px (2 linhas)**, sem corte e sem rolagem lateral. O
  antigo *"Sua vez"* era 1 linha, então a caixa ganhou 22px.

**⚠️ E A TRAVA QUE IMPORTA NÃO É A FRASE, É O NÚMERO ANDAR.** Um texto fixo com o 2 passaria nos
dois casos nomeados; o que ele **não** passa é o caso de `restam = 3`, e é ele que prova que o
número sai do estado. Mais o caminho de verdade: escolher um de verdade no meio do par move o
título sozinho (`Escolha 2 pokémons` → `Escolha 1 pokémon`). Conferido que o defeito religado
derruba **3** travas.

## RESGATE POKÉMON -- o terceiro teste admin (20/09/2026)

Pedido com o `resgate-pokemon.html` da raiz como referência, e com **cinco coisas mudadas** em
relação a ele: o parceiro sai dos times do jogador entre os que **têm Surf**, a velocidade **escala
com o nível**, **todo mundo leva 2** (o protótipo tinha 3/2/1), o adversário é um **Lv.60 aleatório**
da lista de quem aprende Surf, e o botão da home só existe pra `admin === true`.

**Você e um rival disputam o mesmo mar por 90 s.** Seis ilhotas com um pokémon cada (⚠️ **elas
valiam 10/20/30 conforme a distância até 20/09/2026**, e hoje o valor é o do BICHO -- ver **AS
QUATRO DO RESGATE**, no fim desta seção), dois redemoinhos, uma faixa de correnteza -- e **os pontos só contam
quando você volta à praia e desembarca**. O mar inteiro muda de lugar a cada 7 a 11 segundos, com
2 s de aviso tracejado.

### ⚠️ A VELOCIDADE: A FAIXA CRUA DO JOGO NÃO CABE NUM MAPA

```
px/s = 24 + 22 × √(speedDaCorrida / 100)
```

O `speedDaCorrida` é o `effectiveSpeed` do motor -- e **desde 20/09/2026 ele escala com o nível**,
que é justamente o que o pedido pede. Reusá-lo é o que dá **shiny (1,20×) e especialidade (1,05×)**
de graça, e é o que faz um buff novo do motor entrar aqui junto.

**⚠️ MAS ELE NÃO PODE ENTRAR CRU, e o número diz por quê:** medido, o Speed da corrida vai de **6**
(Slowbro Lv.5) a **232** (Starmie Lv.99) -- **38×**. Linear, o mais lento levaria **74 s** pra uma
ida e volta ao ponto mais longe (296px) e o mais rápido **1,3 s**: os dois extremos ficam
injogáveis. Com a raiz a razão cai pra **1,96×**:

| | Speed | px/s | ida e volta | viagens em 90 s |
|---|---|---|---|---|
| Slowbro Lv.5 | 6 | **29,4** | 19,6 s | 4 |
| Lapras Lv.55 | 55 | 42,5 | 13,9 s | 6 |
| Blastoise Lv.70 | 108 | 47,5 | 12,5 s | 7 |
| Starmie Lv.99 | 232 | **57,5** | 10,3 s | 8 |

**⚠️ O 29,4 DO PIOR CASO É EXATAMENTE O PARCEIRO MAIS LENTO DO PROTÓTIPO (29)**, e isso não foi
ajustado: caiu da fórmula. É o que dá confiança de que a escala do mapa continua sendo a que o
protótipo foi desenhado pra ter.

**E O NÍVEL SE VÊ:** um Lapras vai de **31,3 px/s no Lv.5 a 48,4 no Lv.99** -- 1,55×.

### ⚠️ "OS POKEMONS QUE TEM SURF": É QUEM **APRENDE**, E A LEITURA LITERAL DEIXARIA A TELA VAZIA

O pedido diz *"uma lista com os pokemons que tem surf entre todos dos times do treinador"*. A
leitura ao pé da letra seria *carregar o golpe `surf` no `ataques`* -- e isso só acontece pra quem
**fechou as 17 espécies da Zona de Safári** e ganhou o HM03. Pra todo o resto a tela abriria vazia,
e o modo não existiria.

A lista é a `SURFISTAS` (**65 espécies**), a MESMA que o HM03 usa pra decidir a quem ensinar -- e
a mesma que o pedido nomeia pro adversário (*"na lista dos que aprendem surf"*). Os dois lados
saem da mesma lista, que é o que faz a disputa ser simétrica.

- **A ORIGEM É O `towerEligiblePokemon`**, o mesmo da Torre, da Corrida e do Ginásio da Cidade: ele
  varre TODOS os saves (mais os aposentados) e já traz a régua das **8 insígnias**.
- **⚠️ QUEM VALIDA É A AÇÃO**, nunca a tela: um slot forjado no console não vira parceiro.

### ⚠️ TODO MUNDO LEVA DOIS -- e isso muda o que a escolha significa

No protótipo a capacidade era o **preço da velocidade**: o Lapras levava 3 e nadava a 29, o
Gyarados levava 1 e nadava a 43. Com ela fixa em 2 (o pedido), **a única coisa que separa um
parceiro do outro é a velocidade** -- e é por isso que a lista de escolha é uma lista de
velocidades.

**⚠️ E ELA É UMA CONSTANTE, não um campo do parceiro.** Como campo, a mecânica do protótipo
voltaria pela porta dos fundos no dia em que alguém quisesse "só um Lapras especial". Há trava.

A carga continua freando: **100% / 88% / 76%** (12% por passageiro, o do protótipo), e ela freia
**no motor** e não só no rótulo -- medido, 47,5 px/s vazio contra 36,1 cheio.

### O ADVERSÁRIO

Lv.60, sorteado entre os surfistas, **menos duas coisas**:

- **os INTOCÁVEIS** -- o **Lugia está em `SURFISTAS`**, e ele é um pokémon que o jogador não tem
  como ter. É a mesma exclusão que a Pescaria faz;
- **a espécie do jogador** -- dois sprites idênticos no mesmo mar, separados só pela etiqueta, é
  uma tela que se lê errado.

Sobram **64 espécies**, e a velocidade delas no Lv.60 vai de **34,6** (Slowpoke) a **50,3**
(Sneasel) -- **1,46×**. Ou seja a dificuldade do rival varia de partida pra partida, e isso é o
pedido ("deixe aleatório"). **Se um dia incomodar**, a régua é parear como a Pescaria faz
(`npcParaOSpeed`) -- mas lá o pareamento foi pedido DEPOIS, e aqui o pedido diz aleatório.

### O QUE ISSO VALE, MEDIDO

**A CURVA DE HABILIDADE** (Blastoise Lv.70 dos dois lados, 60 duelos por linha; o jogador é
modelado pelo ATRASO de reação e pela chance de escolher o ponto errado):

| quem joga | eu | rival | resgates | vence |
|---|---|---|---|---|
| domina (reage na hora, nunca erra) | 208 | 169 | 7,8 | **85%** |
| joga bem (0,4 s, 10% de erro) | 200 | 175 | 8,0 | 77% |
| **mediano (0,9 s, 25%)** | 185 | 185 | 8,2 | **43%** |
| distraído (2,0 s, 45%) | 179 | 195 | 8,8 | 30% |

**O mediano empata** -- que é onde um minijogo contra NPC tem que ficar.

**E O PARCEIRO DECIDE MUITO** (mesmo jogador "joga bem", rival Blastoise Lv.60):

| parceiro | eu | rival | vence |
|---|---|---|---|
| **Starmie Lv.99** | 245 | 165 | **92%** |
| Gyarados Lv.70 | 204 | 172 | 75% |
| Blastoise Lv.70 | 200 | 177 | 75% |
| **Lapras Lv.55** | 156 | 196 | **8%** |
| Slowbro Lv.30 | 131 | 200 | 3% |
| Slowbro Lv.5 | 104 | 201 | **0%** |

⚠️ **A queda entre o Blastoise Lv.70 (75%) e o Lapras Lv.55 (8%) é de NÍVEL**, não de espécie: são
5 px/s de diferença, e em 90 s isso é uma viagem inteira. É exatamente o que o pedido pede pra
existir.

### O QUE ELE CUSTA AO JOGO: NADA, e está conferido

As duas impressões -- **MOTOR** e **DIÁRIO** -- são **idênticas** em 900 batalhas semeadas
(`25d909ef2d79` / `c35ba4008568`), antes e depois. O Resgate é apresentação mais um chamador novo
do `createInstance`: **nada vai pro Firestore, nenhuma Cloud Function nova, e o time do save fica
byte a byte igual** depois de uma prova inteira (há trava).

### ⚠️ OS SPRITES: O PMD PASSOU A TER OITO DIREÇÕES

A Corrida desenha SEMPRE de costas (`PMD_LINHA_COSTAS`, a quinta linha da folha); aqui o parceiro
**vira pra onde está indo**. O `pmdCaixas` ganhou a **linha como parâmetro COM PADRÃO** -- a
Corrida continua chamando sem ela, byte a byte como antes -- e as caixas de cada linha são
calculadas na primeira vez que ela é pedida (`caixasPorLinha`).

- **A conta da linha é a do protótipo, e ela CASA com a da Corrida**: rumo pra cima devolve
  exatamente o `PMD_LINHA_COSTAS`. Há trava nas quatro direções cardeais -- se as duas telas
  discordassem sobre a mesma folha, uma delas desenharia o bicho virado pro lado errado.
- **⚠️ E O ÍNDICE É APARADO PELO NÚMERO DE LINHAS DA FOLHA**, lido da IMAGEM: `drawImage` com o
  retângulo de origem fora da imagem **não desenha NADA e não dá erro** -- o sprite sumiria em
  silêncio numa espécie com menos direções.
- **A largada espera os DOIS sprites**, e se um falhar ela **não substitui**: a tela diz QUAL
  faltou, pelo nome. É a regra da Corrida.

### ⚠️ O MAR PODIA TRAVAR O JOGO, e foi a trava que pegou

O `resgateMarPlano` lia o **raio** do redemoinho DE VOLTA do estado (`resgate.redemoinhos[i].r`) e
sorteava o próximo lugar de uma lista que podia sair **vazia**. Nos dois casos o resultado não é
um erro na hora: é um `undefined` na lista, que estoura **três quadros depois, dentro do laço** --
e aí a tela congela com o mar no meio de uma mudança.

Hoje os raios são **constante** (`RESGATE_REDEMOINHO_RAIOS` -- o estado diz ONDE eles estão, o
tamanho é do jogo) e, se nenhum lugar servir, **o redemoinho fica onde está**.

### ⚠️ E O BOTÃO NOVO OCUPA A LINHA INTEIRA

A fileira de modos da home é de **duas colunas**, e três botões administrativos deixam o terceiro
sozinho com uma célula vazia do lado -- medido a 320px, um buraco de 137px. O Resgate usa o
`home-btn-largo`, como o Boss de Domingo. **Não é hierarquia: é a linha fechando.**

**Medido a 320px, no navegador, nas cinco telas:** **nenhuma rola pro lado**; o mapa em
**243×263px** com os seis pontos e a praia DENTRO dele, a tela do jogo em **876px**, o picker em
**1.025px** sem um nome truncado, e o botão da home em **281px**.

### AS QUATRO LIÇÕES DE TESTE QUE SAÍRAM DAQUI

1. **⚠️ UMA TRAVA DA CORRIDA ACUSOU O RESGATE.** Ela procurava a fase `correndo` pelo nome curto, no arquivo
   INTEIRO -- e o Resgate também tem uma fase chamada `correndo`. Ancorada em `corrida.fase`, ela
   volta a medir o laço dela. É a armadilha do padrão largo demais, que este projeto já pagou nas
   regex do `mlog-mais` e do `matchup-row`.
2. **⚠️ E UM COMENTÁRIO MEU ACUSOU A SI MESMO -- a OITAVA vez.** O cabeçalho do pintor escrevia a
   chamada de redesenho por extenso pra dizer que ela NÃO acontece ali, e a trava que cobra isso
   varre o texto do laço: ela apontou o comentário. A regra da casa é essa, e ela vale também pro
   que a varredura procura **não** achar.
3. **⚠️ O HARNESS DA PRÉVIA MEDIU CAIXAS VAZIAS.** A carga e os seis pontos são preenchidos pelo
   PINTOR, não pelo render -- a primeira medição olhou círculos sem nada dentro e disse que estava
   tudo bem. Foi só depois de a prévia fazer o que o pintor faz que apareceu o texto "Resgatando"
   **estourando** pra fora do círculo (57px num espaço de 50).
4. **⚠️ E AS SEIS TELAS NUMA PÁGINA SÓ INVENTARAM UM DEFEITO.** O jogo tem **UM** `#app`; seis
   irmãos com o mesmo id se espremem lado a lado, e a medição saiu com o mapa em 149px e dois
   pontos "fora dele". Uma tela por arquivo, e o problema não existe. É a mesma família do
   `.app-shell` inventado que a Pescaria já tinha pago.

**O ponto continua dizendo QUANTO VALE mesmo enquanto é resgatado** -- a palavra que estava ali
dizia o que a BARRA e a borda tracejada já dizem, e o que não se descobre de outro jeito é o valor
do ponto, que é justamente a decisão do jogador. Quem está resgatando se lê pela **cor da barra**.

### AS QUATRO DO RESGATE (20/09/2026)

#### ⚠️ O MAPA JÁ MOSTRA QUEM ESTÁ LÁ, DESDE O SETUP

Reportado: *"logo quando eu abro a tela nao esta exibindo o map, só esta exibindo depois que eu
clico em 'Começar resgate'"*.

**São DUAS coisas faltando, e as duas vêm da mesma origem -- o estado do jogo só nascia no
`resgateComecar`:**

1. **os OCUPANTES**: o protótipo cria as seis pessoas no `reset()` e desenha desde o modo `ready`;
   aqui as ilhotas do setup mostravam só um número, sem ninguém;
2. **o CANVAS**: quem o desenha é o `resgatePintar`, que só roda dentro do laço -- então o mar era
   um retângulo azul chapado, **sem ilhas, sem ondas e sem os redemoinhos**.

Hoje os ocupantes nascem no `resgateZerar` e o `abrirResgate` pinta o mapa **uma vez**, depois do
`render()` (que é quem cria o `<canvas>`). Medido: **2.370 operações de desenho** na abertura.

⚠️ **E com o valor vindo do BICHO, mostrar quem está lá deixou de ser enfeite:** é ELE que diz
quanto aquela viagem vale.

#### ⚠️ O VALOR SAIU DA ILHOTA E FOI PRO POKÉMON

Pedido: *"troque os pokemons que vao ser resgatados por [os 23] ... e os pontos que eles dao devem
ser de acordo com o bst deles, o bst dividido por 5"*.

**Isto muda a mecânica, não só a tabela.** A escada do protótipo era **10 perto / 20 no meio / 30
no alto**, e era ela que criava a decisão (*"ir buscar 30 custa ~3x a distância de um 10"*). Hoje:

| | antes | agora |
|---|---|---|
| o que decide o valor | a ILHOTA (a distância) | o **BICHO** que caiu nela |
| faixa | 10 a 30 (**3,0×**) | **41 a 87** (2,1×) |
| a pergunta do mapa | "vale a pena ir longe?" (sempre a mesma) | "**o que** está longe vale a viagem?" (muda a cada partida) |

- **⚠️ O VALOR É DERIVADO** (`round(bstOf(id) / 5)`), nunca uma tabela à mão -- ela envelheceria no
  dia em que o `GEN2_SPECIAL` mudasse. Há trava que mede isso pela derivação, não pelos números.
- **⚠️ MAS ELE FICA GRAVADO NO OCUPANTE**, e não é recalculado na entrega: ele viaja no `bag` e no
  histórico, e lendo a espécie de volta uma mudança no divisor **renomearia pontos já entregues**.
- **Medido: de 41 (Pichu, BST 205) a 87 (Tangela, 435)**, com a maioria entre 55 e 66. A faixa mais
  estreita é de propósito -- a distância continua sendo o custo, e nenhum bicho torna a viagem longa
  obrigatória nem inútil.
- **São 23 e não 22:** o pedido diz *"nidorans"*, no plural, então os dois entram.
- **O DUELO CONTINUA EQUILIBRADO, medido** (40 duelos por perfil, Blastoise Lv.70 dos dois lados):
  **"joga bem" vence 60%** e **"mediano" 43%** -- o mediano quase empata, que é onde um minijogo
  contra NPC tem que ficar. Os placares sobem (de ~200 pra ~550 pts), o que é aritmética.
- **A LEGENDA VELHA SAIU** (*"10 pts perto · 20 no meio · 30 no alto"*): texto fixo que descreve uma
  régua envelhece quando a régua muda -- a mesma família do *"Golpe repete entre 2-5x"* e do
  *"Revezamento · 900 m"*. Hoje ela diz a REGRA, que não tem número pra envelhecer.

#### ⚠️ O CÍRCULO É TRANSPARENTE, COMO NO PROTÓTIPO

Pedido: *"tente manter os sprites o mais parecido possivel com o prototipo ... os circulos do
prototipo estavam mais transparentes que essa que voce colocou"*.

**No protótipo o `.point` é literalmente `background:transparent;border:0;box-shadow:none`** -- ele
tem duas declarações e a segunda desfaz a primeira. O que se vê é o **SPRITE** (58×51px com
drop-shadow) e a etiqueta numa faixa **abaixo** dele. O disco opaco que estava aqui escondia metade
da ilha desenhada no canvas.

- **`overflow:visible`**: a etiqueta e a barra vivem FORA do círculo.
- **O ponto VAZIO vira um tracejado** (o `.point.empty` do protótipo) em vez de um disco apagado.
- **⚠️ E A ETIQUETA PRECISOU DE CLASSE PRÓPRIA.** Com `.resg-ponto > span` ela pegava também o
  **`.sprite-wrap`**, que É um `<span>` filho direto -- o sprite saía **dentro de uma etiqueta creme
  de 66px**, estourando o ponto de 56. Só a medição no navegador pegou: **seletor de TIPO pega o que
  não devia assim que o HTML tem dois daquele tipo.**

#### A BARRA SAIU DO MEIO DO CÍRCULO

Pedido: *"a barra que carrega quando ta resgatando deixa ela mais bonita, hoje ela ta ficando no
meio do circulo e ta feia"*.

São as medidas do `.rescue-meter` do protótipo: **acima do ponto** (`top:-12px`), **62×13px**, com o
**percentual escrito por cima** (um `<b>` centralizado com sombra). Ela ficava no rodapé de dentro
do círculo, com 5px de altura e sem número.

- **O número não é enfeite:** encher sem dizer quanto falta é metade da conta, e ele é o que o
  protótipo mostra.
- A cor continua separando os dois lados (verde eu, laranja o rival).
- **Medido a 320px:** os seis pontos com etiqueta e barra ficam **todos dentro do mapa**, nenhum se
  sobrepõe, e a tela não rola pro lado.

#### O QUE ISSO CUSTOU

**Nada no motor:** `MOTOR 25d909ef2d79 / DIARIO c35ba4008568`, idêntico em 900 batalhas semeadas.
O Resgate continua sem tocar o save e sem uma operação de backend.

#### ⚠️ E O SANDBOX GANHOU UM CONTEXTO 2D

`cv.getContext('2d')` era um **TypeError** no dublê, e o `abrirResgate` -- que agora pinta o mapa ao
abrir a tela -- derrubava o `test-resgate` na PRIMEIRA linha. Ele existe pela mesma razão do
`classList` de verdade (19/09) e do `getAttribute` (18/09): **o dublê tem que fazer o que o de
verdade faz.**

E ele **anota as chamadas** (`__ops`), como o `__timers` e o `__recargas`: assim a trava afirma *"o
mapa FOI desenhado, com 2.370 operações, e ele desenhou ELIPSES"* em vez de só não quebrar.

### O QUE FICA EM ABERTO

- **Não há ranking** -- o pedido não pediu, e é por isso que o modo continua sem uma única
  operação de backend. Quando houver, é aí que nasce a terceira checagem de permissão (a Pescaria
  já tem o molde: `fishingRanking` com `allow write: if false`).
- **A Liga Laranja**, as insígnias e as recompensas continuam fora de escopo, como na Corrida e na
  Pescaria. Os pontos de mexer no dia em que ela existir são a **porta** (hoje `admin`), o **nível**
  **do adversário** (`RESGATE_NPC_NIVEL`) e a **duração** (`RESGATE_DURACAO`).
- **Se ficar fácil ou difícil demais**, as réguas medidas são: a **duração** (é ela que decide
  quantas viagens cabem), o **`RESGATE_VEL_FATOR`** (o quanto o nível se vê) e a **capacidade** --
  e esta última desfaria o pedido.

### AS TRÊS DO RESGATE (20/09/2026) -- a escada, o mapa que sumia e os sprites

#### ⚠️ CADA ALTURA DE ILHOTA TEM A SUA FAIXA DE PONTOS

Pedida assim: *"as ilhas mais proximas, vao aparecer os pokemons que dão menos de 50 pontos, os da
ilha centrais, são os pokemons que dao menos de 70 pontos, e os mais alto, sao os de 70 ou mais
pontos"*.

**⚠️ ATÉ AQUI O BICHO ERA SORTEADO DA LISTA INTEIRA EM QUALQUER ILHOTA**, então o 87 da Tangela
podia cair na ilhota colada na praia e o 41 do Pichu lá no alto. Ou seja a **distância não dizia
nada sobre o prêmio**, e a decisão do mapa virava sorte. É o outro lado da moeda de 20/09/2026,
quando o valor saiu da ILHOTA e foi pro BICHO: aquilo tirou a escada das posições e não pôs nada
no lugar. Agora ela volta, e pelo bicho.

- **⚠️ AS TRÊS SÃO BANDAS, e não três filtros soltos:** perto **< 50**, centro **50 a 69**, alto
  **70 pra cima**. As duas leituras do texto do pedido dão o mesmo resultado no centro ("dão menos
  de 70" vale nos dois casos); o que a banda acrescenta é **tirar os baratos do meio do mapa** --
  sem isso um Pichu de 41 pts podia nascer numa ilhota central, que é uma viagem mais longa pelo
  MESMO prêmio da de baixo, e a escada deixaria de existir onde ela mais decide.
- **⚠️ A FAIXA SAI DA POSIÇÃO DA ILHOTA, nunca de índices escritos à mão:** as posições **são** o
  mapa, e mover uma ilhota tem que mover a faixa dela junto. O ranking é por Y, com a praia
  embaixo (y=342) -- as duas de Y maior são as de PERTO, as duas do meio o CENTRO, as duas de topo
  as ALTAS. Há trava cobrando a ORDEM, não os índices.
- **E O BOLO DE CADA FAIXA CAI DAS DUAS COISAS ACIMA** -- ele não é uma quarta lista pra manter em
  dia. Um bicho novo no `RESGATE_RESGATADOS` entra na faixa dele sozinho, e um ajuste no divisor
  redistribui os 23 sem tocar em nada.
- **⚠️ FAIXA SEM NINGUÉM CAI NA LISTA INTEIRA**, e há trava pra a rede NÃO precisar ser usada:
  sortear de uma lista vazia devolve `undefined`, que **não dá erro na hora** -- ele estoura
  quadros depois, dentro do laço, e aí a tela congela. É a mesma rede do `resgateMarPlano`.

**⚠️ O QUE ISSO CUSTA, E ELE É VISÍVEL NA TELA: a faixa ALTA tem DUAS espécies.** Medido nos 23:

| faixa | espécies | pts |
|---|---|---|
| perto (< 50) | **4** | 41 a 49 (Pichu, Igglybuff, Cleffa, Togepi) |
| centro (50-69) | **17** | 55 a 66 |
| **alto (≥ 70)** | **2** | **Elekid 72 e Tangela 87** |

Ou seja **as duas ilhotas mais valiosas mostram Elekid ou Tangela quase sempre** -- conferido no
navegador, a primeira tela já saiu com 87 nas duas. A regra está certa; o que falta é gente na
faixa de cima.
**A RÉGUA É A LISTA, e ela é uma linha:** acrescentar ao `RESGATE_RESGATADOS` qualquer espécie de
BST ≥ 350 povoa a faixa alta. Medidos, os candidatos naturais (todos já no `SPECIES`):
**Growlithe 70 · Farfetch'd 70 · Aipom 72 · Magby 73 · Onix 77 · Lickitung 77 · Porygon 79 ·
Murkrow 81 · Ponyta 82 · Marowak 85 · Gligar 86 · Sneasel 86 · Misdreavus 87**. A da faixa de
baixo (4 espécies) tem o mesmo problema, menor: ali os candidatos são de BST < 250.

- **A LEGENDA DA TELA SAI DAS CONSTANTES** (`Perto: até 49 pts · Centro: até 69 · Alto: 70+`),
  nunca escrita à mão -- ela envelheceria no primeiro ajuste de faixa, que é o defeito que o
  rótulo de metragem do revezamento da Corrida teve. **Medido a 320px:** os três cabem numa linha
  só (243x11px), e a tela vai de 970 pra **990px**, sem rolagem lateral.

#### ⚠️ O MAPA SUMIA DEPOIS DE ESCOLHER O PARCEIRO

Reportado: *"depois que eu escolho meu parceiro, o desenho do mapa some e fica somente aquela toda
azul com os pokemons"*.

**A CAUSA É `app.innerHTML = html`: ele cria um `<canvas>` NOVO e VAZIO.** Quem o pinta no jogo é o
`resgatePintar`, que só roda dentro do laço -- e na tela de setup não há laço. A chamada de desenho
morava no `abrirResgate` e cobria só a ABERTURA: **qualquer outra ação da tela apagava o mapa**.

- **⚠️ O GANCHO FOI PRO `render()`, e não pra cada ação do Resgate:** são **oito** portas que
  redesenham aquela tela (escolher parceiro, abrir e fechar o picker, paginar, reiniciar, o aviso
  de sprite que falhou, a fase `carregando`), e uma lista à mão envelheceria na nona -- a nona
  nasceria com o mapa em branco e ninguém veria. É a mesma decisão do `abrirConfronto` da Corrida,
  que nasceu depois de o conserto do golpe fantasma ter ficado pela metade em 09/09/2026.
- **Fora da tela do Resgate não há canvas** e a função volta sem desenhar -- é isso que faz o
  gancho custar nada nas outras 126 telas.
- **⚠️ E A TRAVA TEM DUAS METADES, porque o `render` do sandbox é um NO-OP** (o epílogo o
  substitui): um caso de comportamento **nunca alcançaria o gancho**. Quem prova que ele existe é
  a leitura do código; quem prova que o desenho funciona é o dublê de canvas.

**Medido no navegador, a 320px:** o `<canvas>` depois de escolher o parceiro é um elemento NOVO e
tem **exatamente os mesmos 619.534 bytes** de imagem que antes da escolha -- contra **18.818** de
um canvas em branco do mesmo tamanho (**33x**).

#### ⚠️ O SQUIRTLE ERA DO TAMANHO DA LUGIA

Reportado com print: *"os sprites estao estranhos, o squirtle que é um pokemon pequeno ta muito
grande, e a lugia que é um pokemon grande ta muito pequeno, ajuste para que fique mais
proporcional"*.

**A conta era `Math.min(46 / sw, 46 / sh)`** -- ou seja **TODO mundo saía com 46px de maior lado**.
Não é aproximadamente o mesmo tamanho: é o MESMO tamanho, por construção.

- **⚠️ E ELA NÃO PODE SER LINEAR, pelo mesmo motivo que a VELOCIDADE daqui não pode:** medido no
  navegador nos **65 surfistas** (baixando as folhas e varrendo os pixels), a caixa do sprite vai
  de **17px** (Qwilfish) a **73px** (Lugia) -- **4,3x**. Numa escala linear que caiba o maior no
  mapa, o menor sai com 13px.
- **COM A RAIZ a razão cai pra 2,1x e os dois extremos aparecem:** medido, **28px** o menor e
  **58px** o maior, com a maioria entre 30 e 37. É a mesma forma -- e a mesma razão -- do
  `resgateVelocidade`, que já resolve exatamente este problema com os Speeds do jogo.
- **⚠️ E O TAMANHO É POR ESPÉCIE, nunca por quadro nem por direção:** lido do QUADRO (que é o que a
  conta velha fazia), a escala mudava a cada passo da animação e **o bicho respirava**; lido da
  LINHA, ele mudava de tamanho ao virar. As `dados.caixas` são sempre as do norte e já vêm
  calculadas do carregamento, então isto não custa uma varredura de pixel a mais.
- **A SOMBRA ACOMPANHA**, com teto e piso: ela era 17px fixos, e um Lugia de 58px boiando sobre a
  mesma elipse de um Qwilfish desfazia na sombra a proporção que o sprite acabou de ganhar.

**Conferido no navegador, lado a lado:** com a conta velha o Squirtle sai quase do tamanho do
Lugia; com a nova o Lugia é o dobro dele.

**Se um dia incomodar**, a régua é o `RESGATE_SPRITE_K` (6,8): ele é o tamanho de um sprite de
caixa 1px, então o desenhado é `K × √caixa` -- subi-lo cresce todo mundo na mesma proporção.

#### O QUE ISSO CUSTOU

**Nada no motor:** `MOTOR 4e1b30e2729d / DIARIO 603f5c7e563f`, idêntico em 900 batalhas semeadas.
O Resgate continua sem tocar o save e sem uma operação de backend.

`tools/test-resgate.js` tranca **118 pontas**: o acesso nos 10 estados do campo, o parceiro (só
surfista, de todos os saves, as 8 insígnias, a ordem, e a AÇÃO recusando), a velocidade escalando
e cabendo no mapa, a capacidade e a carga freando no motor, o adversário (Lv.60, da lista, sem
intocável, sem a minha espécie, variando, e sem a minha especialidade), os pontos só contando na
praia, um ponto por resgatador, a corrente e o redemoinho medidos por razão, o mar avisado batendo
com o que chega, o retorno automático, o duelo inteiro terminando, o save intacto, o laço parando
quando a tela muda, as oito direções do sprite e as cinco telas.
**Conferido que ele acusa: 17 de 17 defeitos religados** derrubam pelo menos uma trava.

### AS DUAS DO RESGATE (21/09/2026) -- o (i) da ilhota e os 2s da descarga

#### ⚠️ O SETUP MOSTRAVA UM BICHO QUE O JOGADOR NUNCA IA ENCONTRAR

Pedido assim: *"antes de começar, aparece o mapa e as ilhas e um pokemon em cada ilha, tire esse
pokemon que exibe e adicione um i de informações, e quando clicar, vai exibir quais pokemons sao
possiveis de aparecer em cada ilha, assim como acontece na pescaria"*.

**⚠️ E O BICHO DO SETUP ERA DESCARTÁVEL E ENGANOSO -- isso é pior do que o pedido diz.** Os
ocupantes nascem no `resgateZerar` (é o que faz o mapa da abertura mostrar alguém) e são sorteados
**DE NOVO** no `resgateComecar`. Ou seja: a tela prometia UM pokémon e a corrida entregava outro.

- **NO LUGAR DELE A ILHOTA MOSTRA A FAIXA** (`até 49 pts` / `50–69 pts` / `70+ pts`) e um **(i)**.
  A faixa fica porque seis ilhotas vazias se leriam **iguais** -- e é justamente a ESCADA que o
  mapa tem a dizer antes da largada. O rótulo sai das constantes, como a legenda embaixo dele.
- **⚠️ O (i) É IRMÃO DO PONTO, nunca filho.** No jogo o ponto é um `<button>`, e `<button>` dentro
  de `<button>` é HTML inválido -- o navegador fecha o de fora e o clique de dentro se perde, com a
  tela continuando a PARECER certa. No setup ele é um `<span>`, mas a estrutura é a mesma nos dois
  modos de propósito: é a armadilha que a lupa do encontro selvagem já custou duas vezes.
- **A CAIXA É A DA ZONA DA PESCARIA**, linha por linha (`.rota-mon`), e ela abre a MESMA ficha da
  Pokédex -- é a mesma pergunta (*"esse cobre o tipo que falta no meu time?"*), e um desenho
  próprio obrigaria a reaprender a ler.
- **⚠️ E ELA PODE MOSTRAR A LISTA EXATA**, não uma aproximação: aqui a espécie sai DIRETO do bolo
  (o `resgateNovoOcupante` sorteia um id e pronto), sem a conversão de espécie-por-nível que o
  encontro selvagem precisa. É a mesma propriedade da lista de zona da Pescaria.
- **⚠️ A CHANCE SAIU DA LINHA E FOI PRA DICA**, e por dois motivos: dentro de uma faixa ela é
  **idêntica em todas as linhas** (o sorteio é uniforme), então a coluna repetia o mesmo número 17
  vezes -- ruído puro; e ela custava largura: medido a 320px, `87 pts · 50%` espremia o nome e o
  **"Charmander" truncava por 3px**. O que decide ali é o VALOR, que é o que a ilhota paga.

**Medido a 320px, no navegador:** seis ilhotas, seis (i) de 24px **todos dentro do mapa**, ZERO
sprites no mapa do setup, a caixa da ilhota do meio em **265x544px** (cabe numa tela de 568,
rolando por dentro) com os 17 em ordem de valor e **nenhum nome truncando**; a página do setup vai
de 990 pra **1.032px**, sem rolagem lateral.

#### ⚠️ CHEGAR NA PRAIA DEIXOU DE SER ENTREGAR

Pedido: *"coloque tambem um timer de 2s para descarregar os pokemons resgatados na praia"*. Antes
o desembarque era instantâneo -- encostar na areia já pontuava.

- **ELE TEM A MESMA FORMA DO RESGATE NA ILHOTA:** chegar ABRE a descarga, o ator fica parado
  enquanto ela corre, e só então os pontos entram.
- **⚠️ SAIR NO MEIO DELA CANCELA**, e leva a carga de volta pro mar (o `resgateIrPara` a zera). É o
  que faz os 2s serem um **custo** e não uma espera decorativa -- e é a mesma regra da ilhota.
- **⚠️ E NINGUÉM FICA COM CARGA SEM PAGAR:** o retorno automático dos 90s passou a esperar a
  descarga, e o `resgateTerminar` entrega o que sobrou. Sem isso um desembarque feito aos 89s
  valeria **zero**. É a mesma rede do `pescariaTerminar`, e é por isso que a entrega virou uma
  função só (`resgateEntregar`): ela tem DUAS portas, e escrita nas duas elas divergiriam.
- **O NPC TAMBÉM ESPERA** -- sem a guarda, o planejador dele mandaria o parceiro embora no quadro
  seguinte e ele nunca entregaria nada.
- **A PRAIA GANHOU A BARRA DA ILHOTA** (o mesmo `.resg-medidor`): sem ela os 2s viram uma espera
  sem explicação -- o parceiro para na areia e nada acontece.
  **⚠️ E O `[hidden]` DELA PRECISOU DE REGRA PRÓPRIA:** o medidor é `display:block`, e QUALQUER
  `display` do autor anula o `hidden` da folha do navegador, que tem a menor prioridade que existe.
  É o defeito do modal da contagem da Corrida, que custou dois relatos.

**⚠️ O QUE ELE MUDA NA DECISÃO, MEDIDO** (60 duelos por célula, Lapras Lv.60 dos dois lados, o bot
voltando quando tem N a bordo):

| o bot volta com | sem a descarga | com a descarga | |
|---|---|---|---|
| **1 a bordo** | 459,8 pts · 8,6 resgates | 401,1 pts · 7,5 | **−12,8%** |
| **2 a bordo (cheio)** | 578,0 pts · 10,1 resgates | 536,1 pts · 9,5 | **−7,3%** |

**Os 2s custam o mesmo com um ou com dois a bordo**, então encher a carga ficou relativamente mais
barato -- a pergunta *"volto agora ou busco mais um?"* ganhou um peso a favor de buscar, e é isso
que o timer acrescenta de jogo. A vitória não piora (62% → 67% com o bot que enche): o NPC paga a
mesma taxa, e ele às vezes volta com um só.

- **Se um dia incomodar**, a régua é o `RESGATE_DESCARGA`.

**No motor, nada:** `MOTOR 4e1b30e2729d / DIARIO 603f5c7e563f`, idêntico em 900 batalhas semeadas.

⚠️ **E UMA TRAVA DO DUELO PRECISOU APRENDER A REGRA:** o bot dela tocava noutro ponto assim que o
parceiro ficava sem alvo -- o que agora **cancela a descarga**, e ele nunca entregava. Ele passou a
esperar (`a.descarga <= 0`). É a mesma família dos fixtures que este arquivo já registra: **o bot
do teste é um jogador, e ele precisa conhecer a regra nova como um jogador conhece.**

### AS FAIXAS DE PERTO E DE ALTO ESTAVAM PEQUENAS (21/09/2026)

Pedido assim: *"veja quais outros pokemons nao aquaticos e voador que podemos adicionar no resgate
pokemon nas ilhas mais proximas e nas mais distantes, porque o pool de pokemons que pode aparecer
nelas ficou pequena"*. A lista foi de **23 para 40**.

**⚠️ E A MEDIÇÃO MUDOU A PERGUNTA: o filtro que esvaziou as faixas não era Água/Voador — era que os
23 eram TODOS forma BASE** (23 de 23), uma regra que ninguém tinha escrito. É ela que explica a
faixa alta nascer com duas espécies: formas base de BST ≥ 350 são poucas, e quase todas são bicho
adulto e grande. **Hoje ela está escrita, e o teste a cobra** — o próximo acréscimo que puser um
Charizard na lista fica barulhento.

**⚠️ E O DODUO JÁ ESTAVA LÁ, E É Normal/VOADOR.** Ele entrou antes de a regra existir, e ficou (no
original ele não voa). Ele é **NOMEADO** na trava de propósito: sem isso, o próximo Voador entraria
de carona na exceção dele.

| | perto (<50) | centro | alto (70+) |
|---|---|---|---|
| antes | **4** espécies, média 44,0 | 17 | **2** espécies, média 79,5 |
| depois | **9**, média 41,7 | 17 (intocado) | **14**, média 81,8 |
| chance de cada um na caixa do (i) | 25% → **11%** | 6% | **50% → 7%** |

**Entraram:** Sunkern, Caterpie, Weedle, Tyrogue e Sentret (perto); Growlithe, Aipom, Magby,
Lickitung, Wobbuffet, Ponyta, Dunsparce, Sneasel, Misdreavus, Chansey, Mr. Mime e Stantler (alto).

**⚠️ O QUE FICOU DE FORA, e por quê:**

- **Raikou, Entei (116) e Mewtwo (136)** — lendário. A Vigília já exclui lendário do sorteio dela,
  e um Raikou resgatado por um Lapras desfaz o que o modo é.
- **Tauros, Kangaskhan, Miltank, Pinsir, Heracross, Shuckle, Snorlax e as quatro evoluções do**
  **Eevee** (98 a 108) — são adultos, e com eles o teto ia a 108: a ilhota longe passaria a pagar
  **2,6×** a de perto, quase a escada velha de 3× que foi estreitada de propósito em 20/09.
- **Porygon (79)** — é artificial, não naufraga. E **Onix, Sudowoodo e Girafarig** saíram da lista
  proposta a pedido.

**⚠️ O CUSTO MEDIDO, e ele é o argumento a favor: a escada quase não se move.** O que a ilhota longe
paga a mais vai de **1,81× para 1,96×** — variedade sem inflação, que é o que a faixa estreita de
20/09 comprou. O leque de pontos vai de 41-87 para **36-93** (2,58×, ainda abaixo dos 3× da escada
velha). **Nenhum sorteio cai fora da faixa da ilhota** (0 de 3.600).

⚠️ **E O FILTRO ÁGUA/VOADOR INVALIDOU METADE DA LISTA DE CANDIDATOS QUE ESTE ARQUIVO GUARDAVA:** dos
13 que a seção da escada nomeava, **Farfetchd, Murkrow e Gligar são Voador** e caíram. O filtro
tirou **18 formas base** da faixa alta no total — entre elas Lapras, Scyther, Aerodactyl, Suicune e
as três aves.

⚠️ **E DUAS TRAVAS FIXAVAM OS NÚMEROS DA LISTA VELHA** (*a faixa fica entre 41 e 87*, *são os 23
resgatados*) e caíram de uma vez, **sem nada estar errado**. É a mesma lição das cinco que caíram
quando o trecho da Corrida virou 150 m. Hoje elas cobram a REGRA: a razão ficando **abaixo dos 3×**
da escada velha, e **nenhuma faixa com menos de `MINIMO_POR_FAIXA` (5) espécies** — um PISO, que
sobrevive ao próximo acréscimo e cai no dia em que alguém esvaziar uma faixa.

**Medido a 320px, no navegador:** o setup em **986px** sem rolagem lateral, os seis (i) dentro do
mapa, e a caixa de cada ilhota em **265×483px** (cabe numa tela de 568, rolando por dentro) com
**9 / 17 / 14** linhas de 42px e **nenhum nome truncado**.

**No motor, nada:** `MOTOR 385943f3e1fa / DIARIO 850af0fd1763`, idêntico em 900 batalhas semeadas.

⚠️ **DESDE 20/09/2026 ELE TEM 178**, e as novas cobrem a escada (a faixa saindo da POSIÇÃO, as três
bandas medidas pelo VALOR, os três bolos sendo a lista inteira sem repetir, nenhum vazio, 3.600
sorteios sem ninguém fora da faixa da ilhota, e a escada ESTRITA -- o pior de cima vale mais que o
melhor de baixo), o mapa (o desenho de verdade + o gancho no `render`, lido do código) e a escala
do sprite (maior caixa = maior desenho, os dois extremos cabendo, a razão sendo REAL e não linear,
uma escala por espécie, e a caixa de 46px não voltando).
⚠️ **E 201 DESDE 21/09/2026**, com o (i) da ilhota (o setup sem bicho, os seis botões, a faixa, o
(i) sendo IRMÃO do ponto, a caixa listando o bolo inteiro e ninguém de outra faixa) e a descarga
(ela abre em vez de entregar, dura o que a constante diz, sair cancela, o fim da prova paga o que
sobrou, o retorno espera, o NPC espera, e o `[hidden]` da barra vence o display).
⚠️ **E 203 DESDE 21/09/2026**, com a lista de 40: a razão abaixo dos 3×, o piso de 5 por faixa,
**todo resgatado sendo forma BASE** e **ninguém de Água nem Voador fora o Doduo herdado** -- e as
duas travas que fixavam 41-87 e 23 saíram, porque elas mediam o NÚMERO e não a regra.
**Conferido que ele acusa: 17 de 17 defeitos novos religados**.
## QUEIMADA POKÉMON: O JOGO DA ILHA PUMMELO (21/09/2026)

Pedida com o `queimada-pokemon.html` da raiz como referência, e com seis coisas mudadas em relação
a ele: o pokémon sai da **lista da Corrida individual** (paginada de 10), a **velocidade** e o
**HP** saem dos atributos do jogo **com o nível**, o botão ATACAR recebe o **nome do golpe que o
`melhorAtaque` escolhe** (e o especial é ele ×1,5), o **RECEBER** dura conforme a **Defesa
Especial**, e quando um acerta o outro a tela **diz quanto de HP saiu**.

Com ela o arquipélago fechou: são as **cinco** ilhas com jogo.

### ⚠️ OS QUATRO ATRIBUTOS CHEGAM DO MOTOR -- e dois precisaram de compressão

O que é reuso puro e o que precisou de conta própria:

| | de onde vem | precisou de quê |
|---|---|---|
| **HP** | `calcMaxHp` do jogo | nada |
| **Defesa Especial** | `effectiveSpDef` | nada -- a fórmula do protótipo entra **VERBATIM** |
| **golpe e dano** | `melhorAtaque` + `calcDamageNew` | **compressão do dano** |
| **velocidade** | `speedDaCorrida` (o `effectiveSpeed`) | **compressão da faixa** |

- **⚠️ O ESCUDO PÔDE SER VERBATIM porque a ENTRADA está na mesma escala.** O `effectiveSpDef` é a
  Defesa Especial **BASE** da espécie -- conferido: ele **não escala com o nível** (só a velocidade
  e o HP escalam) --, exatamente como o campo `spd` do protótipo. Medido nas 250: **20 a 230**,
  mediana 65, contra os 20 a 125 dele. O clamp (`0,22 a 0,44 s`) é o dele, e é o que impede o
  Shuckle (230) de ficar com meio segundo de escudo enquanto o Caterpie fica com quase nada --
  **os dois extremos batem no clamp**, e há trava pros dois lados.
- **⚠️ E O HP VARIA MENOS DO QUE PARECE: o NÍVEL pesa mais que a espécie.** O `calcMaxHp` é
  `30 + nível×5 + HP base`, então no Lv.60 os 330 do nível são comuns a todo mundo e só o HP base
  separa os extremos -- Shuckle (20) e Chansey (250) ficam em **350 contra 580, 1,66×**. É a
  ESCOLHA DO NÍVEL que decide quanto o pokémon aguenta; a espécie afina. (O protótipo tinha 100
  fixo pra todo mundo.)

### ⚠️ A VELOCIDADE: A FAIXA CRUA DO JOGO NÃO CABE NUMA QUADRA

Medido nas 250 espécies em três níveis, o `speedDaCorrida` vai de **5** (Shuckle Lv.5) a **282**
(Electrode Lv.99) -- **56×**. O protótipo trabalha entre **85 e 160 px/s (1,9×)**, e é isso que faz
os dois caberem no mesmo campo: linear, o mais lento levaria 18 s pra atravessar o lado dele e o
mais rápido meio segundo.

**A COMPRESSÃO É A RAIZ**, a mesma do `velocidadeNormal` da Corrida e do `RESGATE_SPRITE_K`:

```
px/s = 72 + 48 × √(speed / 100)
```

⚠️ **E AS DUAS CONSTANTES NÃO FORAM ESCOLHIDAS NO GOSTO:** em Speed 100 ela devolve **120 px/s
exatos**, que é o que o `baseSpeed` do protótipo devolve ali -- ou seja ela passa pelo **ponto de
ancoragem** dele. A faixa fica em **83 a 153 px/s (1,85×)**, contra 1,88× dele.

**E o nível se vê:** um Jolteon vai de **107 px/s no Lv.5 a 148 no Lv.99**.

### ⚠️ O DANO É COMPRIMIDO, E ESSE É O ÚNICO DESVIO DESTA TELA EM RELAÇÃO AO MOTOR

Medido **antes de escrever**, porque era o risco real da feature. Com o dano CRU, 1.200 pares
sorteados no Lv.60 dão:

| | |
|---|---|
| mediana | **2,0 golpes** pra derrubar |
| p10 / p90 | 0,7 / 6,9 |
| pior caso | **81** |
| **one-shot** | **15,5% dos pares** |

Ou seja: o Snorlax mata um Alakazam num golpe e um Magikarp precisa de 60 num Dragonite. Numa
queimada de 120 s decidida por **3 eliminações**, o primeiro caso acaba a partida em três
arremessos e o segundo nunca move a barra.

**⚠️ E PAREAR O ADVERSÁRIO NÃO RESOLVE SOZINHO:** com o NPC pareado por BST o one-shot cai de
15,5% pra **9,0%**, e a cauda continua em **135 golpes**. Ele ajuda, e está lá -- mas a trava é
esta:

> **Uma eliminação nunca leva menos de 2 nem mais de 8 golpes.**

O dano do motor vale **INTEIRO dentro dessa faixa** -- é lá que a escolha do pokémon decide --, e
só os extremos são aparados. Medido em 9.000 pares (5 níveis × NPC pareado): **55,4% caem dentro**,
34,5% no piso e 10,1% no teto.

- **⚠️ É A MESMA FORMA DO `MORIBUNDO_TETO_NO_CHEIO` e do `CHEIO_TETO_*`** do motor: um teto
  expresso em **FRAÇÃO DA BARRA** do alvo, e não um número solto.
- **⚠️ O RNG É FIXO NO MEIO DA FAIXA** (`() => 0.5`), e `semCritico`: este número vai no **RÓTULO
  do botão** e no cálculo do especial, então ele precisa ser o mesmo do começo ao fim da partida.
  Sorteado a cada arremesso, o botão prometeria um dano e a barra mostraria outro -- e um crítico
  dobraria o número sem a tela poder avisar.
- **OS DOIS GOLPES SÃO CALCULADOS UMA VEZ**, na largada, pelo mesmo motivo.
- **⚠️ E A TRAVA DA FAIXA É SOBRE O DANO, não sobre o quociente:** o número de golpes derrapa
  alguns centésimos por **arredondamento** (`round(305/8)` é 38, e 305/38 dá 8,03) -- a mesma cauda
  que a suavização do log já registra. Medir o quociente com uma folga inventada seria medir o
  arredondamento.

### ⚠️ OS DOIS CASOS DA JORNADA CONTINUAM SENDO OS DOIS CASOS AQUI

O golpe é o **`melhorAtaque(a, b)`**, a MESMA função que decide o golpe numa batalha de jornada --
é ela que olha poder × tipo × STAB × (ataque/defesa) e devolve o que tira mais dano **daquele**
adversário. **Sem golpe escolhido** ela devolve null, o `calcDamageNew` cai no motor de TIPO e o
nome sai do `nomeDoGolpe`, que é o mesmo caminho do log.

**⚠️ E O `towerEligiblePokemon` NÃO DEVOLVE OS GOLPES ESCOLHIDOS** -- ele traz espécie, nível e
shiny e mais nada. Sem a volta ao save (`queimadaOriginalDoSave`), o pokémon do jogador entraria
**SEM `ataques`** e o botão ATACAR mostraria o nome genérico do TIPO em vez do golpe que ele
escolheu, que é o contrário do pedido.

### O ADVERSÁRIO: PAREADO POR BST, NO MESMO NÍVEL

- **⚠️ AQUI O QUE DECIDE NÃO É UM ATRIBUTO SÓ:** o HP decide quanto ele aguenta, o Speed o quanto
  ele desvia, a Defesa Especial o escudo e o ataque o dano. O **BST** é o único número que cobre os
  quatro -- e é a mesma régua que a líder da Seleção já usa.
- **NUNCA A MESMA ESPÉCIE DO JOGADOR**: dois sprites idênticos na mesma quadra, separados só pela
  etiqueta, é uma tela que se lê errado -- a mesma razão do Resgate. Com 14 vizinhos por BST,
  excluir uma não custa nada.
- **ELE LEVA O MOVESET DA ESPÉCIE** (`equiparNpc`): sem ele o adversário cairia no motor de tipo
  com o poder implícito de 60, e o pareamento por BST seria uma promessa que o ataque não cumpre.
- **⚠️ E A ESPECIALIDADE E OS ITENS VALEM SÓ PRO POKÉMON DO JOGADOR** -- ela é conquista da CONTA,
  e um adversário de tipo Elétrico não pode ganhar 1,05× porque o JOGADOR é especialista em
  Elétrico. O `ehDoJogador` **não tem padrão**, pela mesma razão do `corridaInstancia`: com `true`
  implícito, a próxima chamada esquecida daria o buff ao adversário em silêncio.

### AS SEIS DE 21/09/2026 -- a leva do relato

#### ⚠️ O TOQUE MARCA UM DESTINO, ELE NÃO ARRASTA

Reportado: *"quando eu clico na arena com o mouse, ele fica seguindo o rastro do mouse, ele deve ir
até onde foi clicado e só trocar a direção caso o usuário toque novamente em outro canto"*.

**⚠️ E ISSO NÃO É SÓ TIRAR O `pointermove`:** com o arrasto, o alvo era reescrito **60 vezes por
segundo** e o pokémon **nunca CHEGAVA** -- ele perseguia o cursor. Marcando o destino uma vez, ele
anda até lá e **PARA**, que é o que devolve a mão do jogador pros botões.

Medido no navegador: um toque em (90, 297) marca o destino; mexer o ponteiro não o move; o pokémon
**para exatamente em (90, 297)**; um segundo toque leva pra (288, 306).

#### AS SETAS DE ESQUERDA/DIREITA SAÍRAM

E elas saíram **inteiras**, não só da tela: um estado que ninguém escreve é a forma mais silenciosa
de código morto que existe -- ele ficaria no `queimadaZerar` e nas duas pausas esperando alguém
tentar mexer nele de novo.

**⚠️ E A TRAVA PEGOU LETRA MORTA QUE EU TINHA DEIXADO:** o `queimadaPintarHud` continuava chamando
`queimadaLigar('queimadaBtEsq', ...)` -- escrevendo num botão que não existe mais.

#### ⚠️ UM SPRITE POR TIPO, E A COR DO GOLPE É A DO TIPO

Pedidos juntos, e eles viraram **UMA** coisa só: os 17 desenhos são feitos em **`currentColor`**,
então quem define a cor é o `color` de fora -- e lá ela sai do **`TYPE_COLORS`**, a MESMA tabela
que pinta o selo de tipo do jogo inteiro. Com a cor dentro do desenho seriam **17 tabelas de cor**
pra manter em dia com aquela. É a técnica do disco do TM; o que muda é cada tipo ter forma própria.

- **ELES SÃO CHAPADOS**, sem o volume translúcido do disco: a lição do galão do terreno
  (20/09/2026) é que num símbolo FINO o brilho pinta metade do desenho de branco. Quem define a
  forma é o **contorno preto**, que toda a pixel art da casa já tem.
- **⚠️ O `fogo` CUSTOU TRÊS VERSÕES, e a razão vale guardar:** a chama e a gota da Água são a
  **mesma silhueta** (base redonda, ponta em cima). As ondinhas da primeira versão **sumiram na
  grade de 24** e as duas ficaram idênticas. O que as separa hoje é um **entalhe em V de 9px** na
  base da chama -- grande o bastante pra sobreviver à redução pra 16px, que é a regra dos ~3px.
- **A TABELA `SELO_DO_TIPO` cita cada nome como VALOR**, que é o que a trava de "todo desenho tem
  chamador" pede. Tipo desconhecido sai **VAZIO**, nunca com um símbolo genérico: um ícone errado
  ao lado do nome de um golpe é pior que ícone nenhum.
- **O TEXTO DO BOTÃO É BRANCO COM SOMBRA**, a MESMA convenção do `.type-pill`: as 17 cores vão de
  um Gelo quase branco a um Dragão escuro, e um preto/branco escolhido por luminância daria duas
  leituras diferentes na mesma fileira. E é o branco que faz o selo aparecer -- ele é
  `currentColor`, então sai **por cima** da cor do tipo em vez de sumir nela.
- **⚠️ E O `gerar-selos.js` PRECISOU CITAR AS CHAVES:** `tipo-fogo` tem hífen e não é
  identificador, então sem aspas a tabela **não compila** -- o mesmo cuidado que o `--paleta` já
  tinha pro `*`.

#### ⚠️ O RECEBER: DUAS RODADAS, E A SEGUNDA É A LIÇÃO

Ele saiu do **amarelo da casa** porque com um golpe **ELÉTRICO** ele ficava em `rgb(255,203,5)` ao
lado de um ATACAR em `rgb(248,208,48)` -- **a mesma cor, a olho** --, e os três botões viravam uma
fileira amarela. **Cor de tipo ele não pode ser**: são 17, e qualquer uma colide com o golpe de
alguém.

**⚠️ O SUBSTITUTO FOI UM CINZA-ARDÓSIA, E ELE FOI REPORTADO NO MESMO DIA: *"parece que tá
desabilitado"*.** E aqui está o número que importa: **ele NÃO era cor de tipo nenhuma** -- ele
passava na trava que existia -- e mesmo assim lia como desabilitado, porque o que diz "dá pra
apertar" **não é a matiz, é a SATURAÇÃO**:

| | saturação |
|---|---|
| o `:disabled` da casa (`#e2e2e2`) | **0%** |
| o cinza-ardósia que foi reportado (`#4a5460`) | **13%** |
| média dos 17 tipos | **59%** |
| o verde-azulado de hoje (`#0e7a6e`) | **79%** |

E ele fica a **ΔE 38** do tipo mais próximo (Gelo) -- **2,5× a distância entre os DOIS tipos mais
parecidos do jogo entre si** (Pedra × Terra, ΔE 15), e ΔE 61 do Planta, que é o caso mais comum na
tela. **O vermelho da casa foi medido e reprovado**: ΔE **12** do Lutador, ou seja mais perto do que
aqueles dois -- ele colidiria.

**⚠️ E A TRAVA GANHOU A METADE QUE FALTAVA:** ela cobrava "não é cor de tipo" e o defeito relatado
passava por ela. Hoje ela cobra também que a saturação seja **pelo menos a do tipo menos saturado do
jogo** (20%, o Aço) -- um piso DERIVADO da tabela, não um número escrito nela.

**O ESPECIAL fica na MESMA cor do ATACAR** -- ele é o mesmo golpe ×1,5 --, e o que o separa é a
**moldura branca por dentro**: um roxo ali diria que é outro ataque.

#### O PLACAR OCUPA O CARD, E OS BOTÕES COLARAM NA QUADRA

- **⚠️ A CAUSA DO PLACAR ERA O `.pesc-lado-info` NÃO TER LARGURA:** ele é uma coluna flex
  dimensionada pelo **CONTEÚDO**, e o conteúdo mais largo era o `"400/400 HP"` -- as barras
  herdavam essa largura e sobrava metade do card vazia ao lado. Medido: a barra vai de **~55% para
  88%** do card.
  **A regra é ESCOPADA no `.q-placar`**: o `.pesc-lado` é da **PESCARIA**, onde o lado do card é
  ocupado por um sprite e a informação fica mesmo à direita dele.
- **OS BOTÕES MORAM DENTRO DA CAIXA DA QUADRA** (a pedido: *"se não fica longe para movimentar o
  pokémon e clicar nos botões ao mesmo tempo"*). Numa caixa própria eles ficavam a ~40px do campo;
  hoje são **19px**. O recado desceu pra BAIXO deles pelo mesmo motivo -- e o que ele diz já
  aparece flutuando na quadra, no `−189 HP`.
- **⚠️ E O CARTAZ TEVE QUE SER ANCORADO NO CAMPO, não na caixa:** com os botões dentro dela, o
  `top:44%` passou a medir uma caixa 25% mais alta e ele descia pra cima dos botões. Nasceu o
  `.q-campo{position:relative}`.
- **A FONTE DO NOME FOI DE ~10,5 PRA 12,2px E CENTROU**, e ela **só coube porque o par de setas
  saiu**: com cinco botões a coluna tinha ~75px, e nenhum nome de golpe cabia em nada legível.

**Medido a 320px, no navegador:** documento em **305px** (sem rolagem lateral), botões de
**86×62px**, card do placar 118px com a barra em 104, e a tela de jogo em **935px**.

### ⚠️ O QUE VOA NA ARENA É O DESENHO DO TIPO (21/09/2026)

Pedido em duas etapas, e a segunda corrigiu a primeira: *"os ataques que quero que fique da cor do
ataque do pokemon é os que são animados que aparecem na arena indo na direção do oponente"* e, com
a bola já colorida, *"não coloque somente uma bolinha com a cor do tipo do ataque, coloque alguma
referência -- ataque de grama sair umas folhas, de fogo umas chamas, de água umas gotas, voador
umas rajadas de vento"*.

**⚠️ A RESPOSTA JÁ ESTAVA PRONTA E FOI POR ISSO QUE ELA CABE: são os 17 SELOS DE TIPO** que tinham
nascido horas antes pros botões. **A folha que se aperta é a folha que voa** -- um desenho só serve
os dois lugares, e um tipo novo ganha os dois de graça. Um segundo desenho aqui divergiria do
primeiro no dia em que qualquer um dos dois fosse ajustado.

- **⚠️ ELE É ASSADO UMA VEZ POR TIPO E POR TAMANHO**, num canvas fora de tela. A grade é 24×24, ou
  seja **228 células pintadas** por desenho -- medido no navegador, **assar custa 100 µs e desenhar
  custa 1,7 µs: 58×**. Pintado célula a célula a cada quadro, com três bolas a 60fps, seriam
  **18,1 ms por segundo de pintura**; assado, **0,31**. O quadro inteiro com três bolas fica em
  **0,34 ms**, contra os 16,7 de orçamento a 60fps.
- **⚠️ A COR NÃO MORA NO DESENHO:** ele é `currentColor`, e é isso que faz UM desenho servir aos 17.
  Com a cor dentro seriam 17 tabelas pra manter em dia com o `TYPE_COLORS`. É a técnica do disco do
  TM, e é ela que fez os dois pedidos virarem uma coisa só.
- **⚠️ E O CONTORNO VEM DE DENTRO DO DESENHO** (o `k` da paleta), o que resolve de graça um problema
  medido: a quadra é **areia clara**, e **10 dos 17 tipos somem nela** sem contorno -- o Elétrico dá
  **1,09:1**, o Gelo 1,17 e o Terra 1,29. Os outros 7 são escuros e se leem pelo próprio
  preenchimento. **Nenhum tipo fica sem leitura**, e é esse o par que a trava cobra.
- **⚠️ E ELE GIRA PRA ONDE VAI.** O desenho tem um "em cima" (a ponta da chama, o bico da gota), e
  sem girar ele atravessa a quadra como um adesivo parado em vez de um golpe arremessado.
- **⚠️ O TAMANHO DO DESENHO NÃO É O ALCANCE DO ACERTO**: quem decide se a bola pegou é o
  `QUEIMADA_RAIO`, e ele é outro. Mexer no que se vê não mexe na mecânica -- e há trava, senão a
  próxima mudança de tamanho mudaria a dificuldade sem ninguém notar.
- **O especial é maior e ganha um halo**; na tela o botão dele diz a mesma coisa com a moldura
  branca. A devolvida também é maior: ela bate mais.

#### ⚠️ E A COR SOZINHA NÃO PODIA DIZER DE QUEM A BOLA É

Antes disto a cor da bola dizia o **DONO** (azul minha, laranja dele). Passando a dizer o TIPO, essa
leitura -- que é a mais importante da tela numa queimada -- ficaria sem dono. **Medido: os dois
lados escolhem golpe do MESMO tipo em 8,9% dos pares**, ou seja quase uma partida em onze com os
dois desenhos iguais voando.

**⚠️ E A SAÍDA ÓBVIA FOI MEDIDA E REPROVADA: um ANEL da cor do dono não funciona.** Um anel tem que
contrastar com o PREENCHIMENTO, e nenhum tom consegue isso com os 17 ao mesmo tempo -- as cores das
plaquinhas de nome dão **1,11:1** contra o Sombrio e **1,30:1** contra o Veneno, e mesmo o tom mais
escuro que se testou ainda dá **2,3:1** contra o Sombrio, que é ele próprio um marrom escuro.

Quem diz de quem ela é passou a ser a **CAUDA**, nas MESMAS cores das plaquinhas de nome embaixo de
cada pokémon -- é o que liga a bola a quem a jogou.

- **⚠️ ELA É OPACA, e o alpha que estava ali era herdado** de quando o rastro tinha a cor da própria
  bola: ali ele era decoração. Medido na tela, com alpha **um rastro contra o outro cai de 1,70 para
  1,44:1** e o dele cai a 2,27:1 contra a areia -- e é justamente a discriminação entre os dois que
  carrega a informação.
- **⚠️ E ELA AFINA.** Um traço RETO de 5px atrás de um símbolo vira um **cabinho**, e a folha do
  Planta passa a se ler como uma flor num talo -- foi o que a primeira captura mostrou. Larga junto
  do desenho (e **começando atrás do centro**, escondida sob a borda de baixo dele) e em ponta atrás,
  ela lê como movimento. Continua sendo um preenchimento só.

#### ⚠️ E O DUBLÊ DE CANVAS PRECISOU ANOTAR A TINTA

O `__ops` do sandbox guardava só o NOME da chamada, e com ele a trava consegue dizer *"algo foi
desenhado"* e nada mais -- ela não distingue uma bola pintada na cor do golpe de uma pintada em
qualquer outra. Ele ganhou o **`__tintas`**, que guarda o que estava no pincel em cada verbo que
PINTA, e é isso que deixa a trava **AFIRMAR** a cor. (E o `strokeText`, que faltava e derrubava o
pintor inteiro no primeiro "−N HP".)

**⚠️ E TRÊS ARMADILHAS CONHECIDAS APARECERAM DE NOVO:**

1. **`const` NÃO VIRA GLOBAL** -- as constantes novas voltavam `undefined` e a trava media o nada.
   É a mesma lição que o `queimada` já tinha custado no dia em que o modo nasceu.
2. **`${...}` NUM `<style>` ESTÁTICO NÃO INTERPOLA** -- o comentário que eu pus ao lado da regra do
   RECEBER sairia **literal no CSS**. É o defeito da faixa de update de 18/09 entrando por outra
   porta, e o conserto é o comentário CSS de verdade.
3. **A TRAVA MEDIA A COR DE ORIGEM, não a que aparece** -- com alpha, source e rendered são coisas
   diferentes. Hoje a cauda é opaca, então as duas coincidem **por construção**, e a trava cobra a
   igualdade exata (o que exclui qualquer alpha).

**E a conferência de acusação pegou um furo de verdade**: a trava do carimbo do tipo cobrava o
CAMPO e pintava só uma bola NOVA -- um pintor que lesse o tipo do DONO passava por ela em branco.
Hoje ela **pinta a bola DEVOLVIDA** e compara o sprite, **com o par de tipos forçado a ser
diferente**: sem isso ela seria um flake nos 8,9% em que os dois lados escolhem o mesmo tipo.
**E foi a própria trava que pegou o tamanho:** a devolvida é desenhada maior, e o sprite é assado
POR TAMANHO -- ela comparava com o do tamanho comum.

**Medido a 320px, no navegador:** os 17 desenhos giram e se leem na quadra, a página fica em
**305×935px** sem rolagem lateral, e os botões continuam em 86×62.

### AS CINCO DE 21/09/2026 -- a munição, o nome e o (i) das ilhas

#### ⚠️ O ATACAR GANHOU UM PENTE DE 10, E ELE É A RÉGUA MAIS PESADA DESTE MODO

Pedido assim: *"o usuário pode usar o atacar 10x seguidas, depois ele precisa recarregar, esperando
10s para recarregar os ataques novamente"*.

⚠️ **ELE É DIFERENTE DO `QUEIMADA_TIRO_RECARGA`, que já existia**: aquele é a CADÊNCIA entre dois
tiros (0,85 s); este é um pente que ACABA. E os dois se multiplicam — é daí que sai o número que
importa:

| | |
|---|---|
| o pente inteiro, na cadência | 10 × 0,85 s = **8,5 s de fogo** |
| a recarga | **5 s** |
| ou seja, o jogador atira no máximo | **63% do tempo** |

**⚠️ A RECARGA NASCEU EM 10 s E FOI A 5 NO MESMO DIA, a pedido — e a diferença é grande**, porque o
ciclo é a razão entre os dois números:

| ritmo do jogador | recarregando (10 s) | recarregando (5 s) | vitória (10 s) | vitória (5 s) |
|---|---|---|---|---|
| martelando o botão | 49% | **33%** | 98% | **95%** |
| um tiro a cada 0,85 s | 50% | **33%** | 90% | **98%** |
| um tiro a cada 1,2 s | 42% | **26%** | 80% | **88%** |
| um tiro a cada 2 s | 31% | **18%** | 60% | **45%** |

Com 10 s ele passava **metade do duelo** sem poder atirar e perdia 10 a 20 pontos de vitória; com
5 s ele passa **um quarto** e perde de 2 a 15. A régua continua existindo — ela só deixou de ser a
coisa mais pesada do modo.

- **⚠️ ELE VALE PROS DOIS LADOS, por construção:** o NPC atira pelo MESMO `queimadaAtacar`. Valendo
  só pro jogador ele seria uma desvantagem de um lado só, que é o que este projeto evita em todos
  os minigames.
- **⚠️ O ESPECIAL NÃO GASTA MUNIÇÃO, e isso é decisão:** ele já tem a recarga de 45 s, muito mais
  apertada que um pente de 10, e cobrar as duas coisas o puniria duas vezes. Em troca ele vira o
  **botão de emergência** — a recarga do ATACAR deixa de ser um bloqueio total.
- **⚠️ O PENTE ATRAVESSA A ELIMINAÇÃO**, como a recarga do especial: medido, uma rodada leva **~4
  tiros** — recarregado a cada queda, o limite de 10 quase nunca morderia e a mecânica seria
  enfeite.
- **⚠️ A RECARGA É RESOLVIDA PELO PASSO, nunca dentro do `queimadaAtacar`:** posta lá ela só
  aconteceria quando alguém TENTASSE atirar, e o HUD — que lê o número a cada quadro — mostraria o
  pente vazio até o primeiro toque depois de ela ter acabado.
- **NA TELA o pente vem PRIMEIRO na dica** (`8/10 · 117 de dano`), porque é ele que muda: o dano é
  fixo a partida inteira. Com o pente vazio a recarga ocupa a linha sozinha (`Recarregando 7 s`) e
  o botão desliga — a tela não pode convidar pra uma ação que a AÇÃO recusa.
  Medido a 320px: a dica fica em **71px** num botão de 86, sem cortar.
- **Se um dia incomodar**, as réguas são `QUEIMADA_MUNICAO` e `QUEIMADA_RECARGA` — e a conta do
  ciclo é a razão entre os dois: `(municao × 0,85) / (municao × 0,85 + recarga)`. É ela que diz o
  quanto do duelo o jogador passa podendo atirar, e é o número a olhar antes de mexer em qualquer
  um dos dois.

#### O NOME DA TELA É "ARENA 1X1"

Trocado a pedido. **⚠️ O que NÃO mudou foram os nomes de CÓDIGO** — as funções, as constantes e o
selo continuam com o nome antigo: renomeá-los seria churn em ~200 referências pra trocar uma
palavra que só aparece na tela. Há trava pras duas metades (a tela diz o nome novo, o código
continua respondendo pelo antigo).

#### A TELA DE FIM MOSTRA OS DOIS QUE SE ENFRENTARAM

*"Deixe ele mais bonito, coloque as sprites dos pokemons que se enfrentaram, e pode retirar o
texto: HP final"*.

- **Eles se OLHAM**: o da esquerda é espelhado, que é o que a batalha da jornada já faz — dois
  sprites virados pro mesmo lado se leem como uma fila, não como um duelo.
- **A MEDALHA É A DO PÓDIO DA CORRIDA**, não um desenho novo: é o mesmo ouro que o jogo já usa pra
  dizer "este ganhou". **No empate não sai nenhuma** — ali não houve vencedor.
  ⚠️ E o empate exige **HP igual também**: com pontos iguais o `queimadaVencedor` desempata pela
  vida. O fixture da trava não caía no caso que ele dizia medir, e foi a própria trava que mostrou.
- **⚠️ A CAIXA DA MEDALHA TEM ALTURA FIXA mesmo vazia** — sem ela o lado sem medalha sobe e os dois
  deixam de alinhar, que é justamente onde o olho compara. É a mesma nota da célula vazia do pódio
  da Corrida.
- **A LINHA DA VIDA RESTANTE SAIU, e a razão é que ela não dizia nada:** o duelo é decidido por
  ELIMINAÇÕES, e o perdedor termina **sempre em zero**. O que ficou é a única linha que conta COMO
  se jogou — as devoluções.
- **Medido a 320px:** os dois lados em **114×159px**, iguais, sem rolagem lateral.

#### O CARD DA SELEÇÃO MOSTRA 3 GOLPES -- e o que ele esconde foi medido ANTES

*"Na ilha kumquat, quando exibir os pokemons, tem que exibir somente 3 ataques que ele possui ...
os que tem mais poder de acordo com o level"*.

**⚠️ O CARD É A SUPERFÍCIE DE DECISÃO DO DRAFT, então cortar informação dele precisava de número.**
Medido em 1.135 pares nas três faixas de nível:

| | |
|---|---|
| golpes por pokémon | **4,08** em média |
| quantos passam de três | **62%** |
| **o motor escolhe um golpe FORA dos 3 mais fortes** | **2,0%** |

Ou seja: o motor escolhe pelo DANO, então o golpe fraco quase nunca sai — **o card continua
contando a decisão em 98% dos casos**.

- **⚠️ E A BATALHA NÃO FOI TOCADA:** o `equiparNpc` continua dando o moveset inteiro aos dois lados.
  Cortar lá seria mexer no balanceamento da ilha, que não foi o que se pediu; se um dia for, é o
  mesmo `slice` aplicado no `selecaoFecharDraft`. **Há trava cobrando que o time continue inteiro.**
- **A legenda da tela diz que são os 3 mais fortes**, em vez de uma etiqueta "+2" em cada card —
  que seria mostrar MAIS de três coisas justamente onde se pediu três.
- **O ganho não é altura** (medido, ~4px por card num bolo típico): é o card se ler de uma vez.

#### O (i) DE CADA ILHA, E A CLASSE QUE NÃO EXISTIA

*"No mapa da ilha laranja, adicione um i no canto de cada ilha explicando como é o jogo, não precisa
entrar nada técnico"*.

- **⚠️ O TEXTO MORA NA TABELA** (`ILHAS_COMO`), ao lado do nome e do líder: uma segunda lista
  indexada por id divergiria dela no dia em que uma ilha nascesse ou trocasse de jogo. E é por isso
  que a ilha SEM jogo não precisa de entrada — ali o (i) não aparece, porque não há o que explicar.
- **⚠️ E ELE É SOBRE O QUE SE FAZ, nunca sobre como está feito:** nada de nome de atributo, de
  fórmula ou de constante. Quem quer o número abre a tela do jogo, que já os mostra.
- **⚠️ O (i) É IRMÃO DO PINO, nunca filho:** `<button>` dentro de `<button>` é HTML inválido — o
  navegador fecha o de fora e o clique de dentro se perde, com a tela continuando a PARECER certa.
  É a armadilha que a lupa do encontro selvagem e a do montador já custaram.
- **⚠️ E ELE SAI DO MESMO `left/top` DO PINO**, com o deslocamento no `transform`: mover uma ilha na
  tabela move os dois juntos. Com posição própria ele ficaria boiando no mar no primeiro ajuste.
- **⚠️ E A CAIXA NASCEU COM UMA CLASSE FANTASMA.** Eu usei `modal-backdrop`, que **não existe na
  folha** — e classe que não existe não dá erro: ela só não faz nada. A caixa renderizava **no
  FLUXO**, embaixo do botão de voltar, em vez de sobrepor. **Só a captura de tela pega**, e é a
  mesma família do `--cream` que já deixou uma aba ilegível e do `--yellow-soft` que não realçava.
  A classe da casa é `modal-overlay`, e hoje há trava cobrando que a regra dela exista no CSS.
- **Medido a 320px:** o (i) em **22×22px** no canto do pino, os cinco DENTRO do mapa, e a caixa em
  **280×487px** — cabe numa tela de 568 sem rolar.

#### ⚠️ E UMA FATIA POR OFFSET ENVELHECEU, de novo

A trava do `QUEIMADA_ESPECIAL_MULT` fatiava **1400 caracteres fixos** a partir do `queimadaAtacar`
— e o bloco da munição empurrou a constante pra fora da janela: **ela caiu com o código certo**.

É a terceira vez desta família no projeto (a fatia vazia do `tentarGolpeEspecial`, o prefixo do
`pescariaPintar`). Hoje ela vai **até o fim da função**, com um `ok` cobrando que a fatia tem o que
ler — que é a outra metade da armadilha: uma fatia que não lê nada e passa em branco.

**E o comentário do conserto reproduzia o literal que a trava procura** ("HP final"), o que a faria
acusar a si mesma — a **nona** vez dessa armadilha aqui. Ele foi reescrito sem citá-lo.

### ⚠️ A CAUDA VIROU A COR DO PRÓPRIO GOLPE (21/09/2026)

Reportado com print: *"por que que tanto o ataque de raio quanto o ataque de inseto tem um rabinho
de outra cor? no raio tem um negócio azul e no inseto tem um negócio marrom"*.

**Era a CAUDA, e ela estava fazendo o trabalho que lhe foi dado** — dizer de quem é a bola (azul
minha, marrom dele). Só que **um matiz diferente atrás de um símbolo não se lê como rastro: se lê
como um pedaço solto grudado nele**, e foi exatamente isso que o print mostrou.

**⚠️ O QUE ELA RESOLVIA FOI MEDIDO ANTES DE SAIR**, porque ela existia por uma razão medida (8,9%
dos pares escolhem golpe do mesmo tipo). A pergunta certa é outra: **com que frequência a
ambiguidade aparece de fato na tela?** Ela precisa de duas bolas no ar, de donos diferentes **E do
mesmo tipo** — medido em 30 duelos, 45.862 quadros:

| | |
|---|---|
| quadros com alguma bola no ar | **90,4%** |
| com bola dos DOIS lados | 49,9% |
| **... e do MESMO tipo** | **3,15%** |

Ou seja: **a cauda colorida aparecia em 90% dos quadros pra resolver 3%**. Nos outros 46,7% em que
há bola dos dois lados, o DESENHO já separa sozinho — e a **direção do voo** diz o resto, porque o
que desce é dele e o que sobe é meu.

Hoje ela é **a cor do próprio golpe, num tom mais fundo**, e a bola inteira lê como um objeto só.

- **⚠️ O TOM É MAIS ESCURO, nunca mais claro, e isso é medido:** a quadra é areia clara. Uma cauda
  30% mais clara **some em 11 dos 17 tipos** e a cor crua some em 5. A 45% rumo ao preto do contorno
  o pior caso (Elétrico) fica em **2,81:1** e **nenhum tipo some**.
- **E ela é assada uma vez por tipo**, como o sprite: é uma conta de mistura por cor, não por quadro.
- **As constantes de cor de dono morreram** — elas não tinham outro leitor.

#### ⚠️ E TRÊS DESENHOS FORAM REFEITOS: eles sumiam no tamanho em que voam

O mesmo pedido dizia *"deixe mais bonito esses sprites de ataques"*, e a prévia a 20px mostrou
quais não se sustentavam:

| | o que estava errado |
|---|---|
| **Elétrico** | o raio era um polígono FINO, e com o contorno de 2px comendo os dois lados sobrava um risco. Hoje ele é montado como **duas faixas grossas que se cruzam** — a de cima reta e larga, a de baixo afinando em ponta |
| **Inseto** | ia **de ponta a ponta da grade** (as antenas chegavam nas bordas) e virava uma massa escura. As antenas encolheram pra dentro, o corpo ficou mais redondo e a linha do meio afinou |
| **Sombrio** | o crescente era fino e sobrava quase só contorno. O círculo que o morde saiu mais pra fora e encolheu |

**Medido depois: os três ficaram com 54% a 58% de COR** (o resto é contorno), que é a mesma faixa
dos que já estavam bons — a Folha tem 49% e a Chama 62%. É esse número que diz se um desenho de
24×24 sobrevive à redução: abaixo de ~45% o contorno domina e o tipo deixa de se reconhecer.

### ⚠️ A BOLA FICOU 50% MAIS RÁPIDA E O ESCUDO DOBROU (21/09/2026)

Pedidos juntos, e eles puxam pra lados opostos — **o que importa é a RAZÃO entre os dois**, não
cada um isolado.

| | antes | hoje |
|---|---|---|
| a bola comum | 170 px/s | **255** |
| o voo numa travessia de 300px | 1,76 s | **1,18 s** |
| o escudo de um Jolteon | 330 ms | **660 ms** |
| **quanto do voo o escudo cobre** | **19%** | **56%** |

E em quatro corpos diferentes, que é o que mostra que a mudança vale pro bestiário inteiro:

| | antes | hoje |
|---|---|---|
| Shuckle (Sp.Def 230) | 25% do voo | **75%** |
| Snorlax (110) | 20% | **61%** |
| Jolteon (95) | 19% | **56%** |
| Caterpie (20) | 12% | **37%** |

**⚠️ Ou seja: apesar de a bola ficar 50% mais rápida, DEFENDER ficou cerca de 3× mais fácil.** A
bola rápida tirou tempo de reação e o escudo dobrado devolveu muito mais do que ela tirou.
Medido no duelo, **usar o RECEBER passou a valer 12 a 20 pontos de vitória** (68% sem receber
contra 80–88% recebendo) — antes ele era quase um luxo.

- **⚠️ O QUE DOBROU FOI A FÓRMULA INTEIRA** (base, fator e os dois limites), e não só o teto:
  dobrando só o teto, quem já batia nele ganharia o dobro e o resto ganharia menos. O pedido diz
  "dobrar o valor que tá exibindo", e isso tem que valer pra TODO pokémon — conferido em cinco
  Sp.Def diferentes, todos exatamente 2×.
- **⚠️ E ISSO SAIU DO CLAMP DO PROTÓTIPO** (0,22 a 0,44 s), que era o último número dele que este
  modo ainda usava cru.
- **⚠️ O ESPECIAL NÃO SUBIU JUNTO**, porque o pedido fala do *ataque principal* — e a consequência é
  conhecida: a vantagem de VELOCIDADE dele quase some (**255 contra 280**). O que o separa passa a
  ser o que ele já tinha de próprio: perseguir o alvo e atravessar o RECEBER. Se um dia isso
  incomodar, é uma linha (`QUEIMADA_BOLA_V_ESP`).
- **E o texto técnico saiu da primeira tela** (*"O HP vem da fórmula do jogo..."*): ele explicava de
  ONDE os três números vêm, e os três já estão logo acima dele, com o nome de cada um.

### AS SEIS DE 21/09/2026 -- a recarga que freia, o anúncio e as prévias do draft

#### ⚠️ RECARREGAR PASSOU A CUSTAR MOBILIDADE

Pedido assim: *"enquanto o pokémon tá carregando o ataque principal, a velocidade de movimento dele
cai em 50%. E coloque uma barra embaixo do desenho do pokémon carregando o ataque principal, tanto
para o adversário quanto para o usuário"*.

**⚠️ ATÉ AQUI A RECARGA ERA SÓ UMA ESPERA:** o pente acabava, o pokémon continuava fugindo no mesmo
ritmo, e o que ele perdia era só o tiro. Com o freio ela vira uma **JANELA** — o momento em que o
outro lado consegue alcançar. Medido, o que ele custa em chão de quadra:

| durante os 5 s de recarga | |
|---|---|
| antes | **665 px** (a quadra tem 300 de lado — ele a atravessava duas vezes) |
| hoje | **332 px** |

- **⚠️ O FREIO ENTRA NA VELOCIDADE, nunca no passo**, e isso não é detalhe: o gasto de fôlego é
  `passo / vel`, então freando os dois ele continua o mesmo **POR SEGUNDO**. Aplicado só no passo,
  a recarga seria **duas punições de uma vez** — andar menos E cansar mais. Há trava medindo o
  fôlego por segundo nos dois estados.
- **ELE VALE PROS DOIS LADOS por construção**, como o pente: o laço anda os dois pelo MESMO
  `queimadaAndar`.

**A BARRA SÓ EXISTE ENQUANTO ELE RECARREGA.** Cheia e parada o tempo todo ela diria *"o pente está
cheio"*, que é o estado comum e não precisa de aviso — é a mesma decisão da barra do RECEBER na
praia do Resgate.

- **⚠️ ELA MORA NO ATOR, não no HUD, e é por isso que ela vale pros DOIS lados:** o HUD é do
  jogador, e a do adversário não teria onde caber ali. **E é justamente a dele que conta a janela**
  — é ela que diz quando dá pra avançar.
- Ela fica no **vão entre o sprite e a etiqueta do nome** (y+19 a y+24 do centro), que é o único
  espaço livre ali; fora dele ela cobriria um dos dois. Trilho escuro e enchimento âmbar, porque a
  quadra é areia clara.
- **Medido no navegador:** com 4,0 s restando ela sai com **20% de enchimento** e com 1,0 s
  restando, **80%** — exato, nos dois lados.

#### ⚠️ A DEVOLVIDA SAI 50% MAIS RÁPIDA

*"Quando um ataque é recebido, a devolução dele sai 50% mais rápido"*: 180 → **270 px/s**.

Ela já voltava mais **FORTE** (×1,25 de dano, com teto); agora ela volta mais **DEPRESSA** também,
e é isso que transforma a defesa perfeita num contra-ataque de verdade em vez de um empurrão.

| | antes | hoje |
|---|---|---|
| a devolvida cruza a quadra em | 1,67 s | **1,11 s** (−33% de tempo de reação) |
| e o escudo cobre | 40% do voo dela | **59%** |

**⚠️ OS DOIS NÚMEROS ANDAM PRA LADOS OPOSTOS, e é isso que a torna difícil de devolver de volta:**
a FRAÇÃO que o escudo cobre subiu (o voo encurtou e a janela é a mesma), mas o TEMPO ABSOLUTO pra
reagir caiu um terço. Quem acerta a primeira defesa leva vantagem de verdade.

- **⚠️ ELA CONTINUA ABAIXO DO ESPECIAL** (270 contra 280): se passasse, a devolvida seria o golpe
  mais rápido do modo e o especial deixaria de ter o que o separa. Há trava.

**O PREÇO DAS DUAS JUNTAS NO DUELO: NADA.** **77,67% → 83,67%**, **+6,0 pontos, 1,7σ** (12 blocos
de 25 duelos de cada lado, o MESMO bot contra duas cópias congeladas, desvio tirado de ENTRE os
blocos). Dentro do ruído, e pela razão de sempre neste projeto: **as duas caem dos DOIS lados** —
o NPC também recarrega e também devolve.

#### ⚠️ A PARTIDA TERMINA NUM ANÚNCIO, E ELE É UMA FASE PRÓPRIA

*"No fim da batalha, antes de ir para a última tela, exiba um modal 'Vitória Raichu!' e quando o
usuário clicar em Ok, fecha o modal e abre a última tela"*.

- **⚠️ A FASE É PRÓPRIA (`anuncio`), e não um sinalizador sobre a `fim`** — a diferença é o que se
  vê: com o sinalizador a tela de **resultado ficaria desenhada atrás do modal**, que é exatamente o
  que o pedido tira. Aqui a quadra **congela no último quadro** e o modal vem por cima dela.
- **E ELA PARA O JOGO SOZINHA:** o laço, o `queimadaPasso` e o `queimadaAtiva` já guardam em
  `=== 'jogando'`, então nenhum deles roda com a fase nova. Não foi preciso uma segunda guarda.
- **⚠️ O `render()` RECRIA O `<canvas>` EM BRANCO** e o laço que o pintava acabou de ser cancelado
  — sem uma pintura a quadra do anúncio sairia vazia. É o mesmo cuidado do mapa do Resgate.
- **⚠️ E O HUD VAI JUNTO, por um motivo que só o navegador mostrou:** o ponto que ENCERRA a partida
  é contado **dentro** do `queimadaPasso`, ou seja depois do último quadro pintado — sem repintar,
  o placar do anúncio mostrava **2/3 numa partida que acabou em 3/3**. O laço ainda repinta por
  acidente (ele chama os dois pintores depois do passo), e é dessa dependência que a linha tira.
- **O anúncio nomeia o POKÉMON**, não o treinador: é ele que estava na quadra. **No empate ele diz
  "Empate!"** e não desenha sprite nenhum — ali não houve vencedor.

#### E A TELA DE RESULTADO FICOU SENDO SÓ A CLASSIFICAÇÃO

Saiu a linha *"N devoluções suas — cada uma volta mais forte"*, a pedido. Com ela vai embora a
**última** linha de texto daquela tela (a da vida restante já tinha saído horas antes): o que ela
conta está todo dentro dos dois cards — sprite, medalha, KOs, treinador e pokémon.

#### ⚠️ AS DUAS PRÉVIAS DO DRAFT SÃO O CARD DE TIME DA CASA

Pedidas em duas etapas no mesmo dia: *"na tela que exibe os 12 pokémons, vai montando 2 linhas com
os times que estão se formando, conforme a escolha dos treinadores em tempo real"* e, com elas na
tela, *"coloque o card que vai exibir a prévia do time igual os cards que tem na tela home e os
cards para selecionar o time que vai ser inscrito nas ligas"*.

**⚠️ A SEGUNDA METADE OBRIGOU O CARD DA CASA A RECEBER O TIME EM VEZ DO SLOT.** Ele lia
`game.saveSlots[slot]` — e o time do draft **não é de save nenhum**: ele sai do bolo, carta a
carta. Um card próprio ali seria a **QUINTA cópia** do mesmo desenho (home, ligas, Pescaria,
Corrida), e é por ele ser o mesmo em todo lugar que o jogador reconhece um time sem reaprender a
ler. Hoje o `cardDeTimeHtml` recebe o time e o `pescariaCardDoTime` é um invólucro que lê o save.

- **⚠️ ELAS SAEM DO `pool`, nunca de uma lista à parte:** o `selecao.meu`/`selecao.dele` só são
  montados no **FIM** do draft (`selecaoFecharDraft`), então durante ele a única fonte de verdade é
  o campo `dono` de cada carta — e derivar é o que faz as prévias não terem como ficar velhas.
- **⚠️ SEM AÇÃO O CARD É UMA `<div>`, nunca um `<button>` apagado:** aqui ele é uma PRÉVIA, e um
  botão que não faz nada convida um toque que não responde — a mesma decisão da ilhota do setup do
  Resgate e da ilha sem jogo do mapa das Laranja.
- **⚠️ AS VAGAS VAZIAS SÃO PEDIDAS PELO CHAMADOR, e só o draft as pede:** a fileira é uma grade de
  6 colunas, então um time de 2 já deixa 4 células em branco — o que basta pra quem olha um time
  **PRONTO**. Num time que está sendo **MONTADO**, o branco se lê como *"acabou"* e o tracejado se
  lê como *"faltam 4"*, que é a informação que a linha de texto dava.

**E A LINHA DE TEXTO SAIU** (*"Escolha 2. Você tem 0 de 6, ela tem 1. Faixa Lv.35–45."*), a pedido.
Os dois cards contam as três coisas melhor: a contagem está no nome (`Buzzo · 2/6`), o nível está
em cada sprite e a média na estrela. **O que sobrou no título é a VEZ**, que é a única coisa da
frase que as prévias não contam.

**Medido a 320px, no navegador:** os dois cards em **243×116px**, iguais, com a estrela da média
(56 e 57), nenhum nome truncado e **sem rolagem lateral**. O modal do anúncio fica em **265×256px**.

#### O QUE ISSO CUSTOU AO JOGO: NADA

`MOTOR 2bc051b58136 / DIARIO 51dc1030cf1e`, idêntico em 900 batalhas semeadas.

#### ⚠️ E TRÊS TRAVAS MINHAS PASSARAM EM BRANCO — só a conferência de acusação pegou

As três estavam VERDES com o código certo e continuaram verdes com o defeito religado, que é o
pior tipo de trava que existe. Elas ficam registradas porque as três causas já têm precedente aqui:

| trava | por que ela não media nada |
|---|---|
| *"quem recarrega anda pela metade"* | ela comparava a razão medida **com a própria constante** — desligando o freio (`1`), a razão também vira 1 e ela passa. É a lição do *"trava que pergunta à função que ela mede não é trava"*. Hoje ela cobra **as duas coisas**: que a constante é menor que 1 e que a razão bate |
| *"o terminar pinta a quadra"* | um `[\s\S]*?` **sem limite atravessa a função** e acha o `queimadaPintar()` do LAÇO, centenas de linhas abaixo. É a armadilha do `mlog-mais` e do `matchup-row`. Hoje ela **fatia a função primeiro**, com um `ok` cobrando que a fatia tem o que ler |
| *"a prévia é uma `<div>`"* | ela simplesmente **não existia** — eu tinha a decisão escrita no comentário e nenhuma asserção sobre ela |

#### ⚠️ E O `process.argv[1]` MORDEU DE NOVO, no mesmo dia

Escrevendo o script de acusação desta leva, usei `process.argv[1]` pro primeiro argumento — e com
o script vindo do **stdin** (`node - <<EOF`) ele vale **`-`**. O erro foi barulhento desta vez
(`ENOENT: open '.../-/acusar-leva5.js'`), ao contrário da vez em que ele apagou a tabela de
desenhos. **Com stdin o argumento é `argv[2]`.**

#### ⚠️ E O HEREDOC COME AS BARRAS DUPLAS

Três vezes nesta sessão: um `\\n` escrito dentro de um `node - <<'EOF'` chega no node como `\n` e
vira uma **quebra de linha de verdade** na string — a âncora deixa de casar, ou pior, o arquivo
sai com a linha partida no meio. O mesmo vale pro `\\(` de uma regex.
**Pra texto literal com escape, o caminho é a ferramenta de edição de arquivo**, não o heredoc — e
o sintoma é sempre o mesmo: uma âncora certa que não encontra nada.

#### ⚠️ E UM `process.argv[1]` QUASE APAGOU A TABELA DE DESENHOS

Aplicando a tabela regerada, escrevi `process.argv[1]` onde queria o primeiro ARGUMENTO — e
`argv[1]` é o **próprio script**. O patch escreveu o próprio código por cima do `DESENHOS`:
**55.642 caracteres viraram 472**.

**⚠️ E O `node --check` PASSOU**, porque o que foi escrito no lugar era JavaScript válido. O que
pegou foi **ler o número** que o próprio patch imprimiu — "tabela trocada: 55642 -> 472".

A trava que existe pra isso (*o GERADOR e a TABELA concordam*, nascida de um `git checkout`
acidental em 18/09) teria pego na bateria seguinte. **Verificação de sintaxe não é verificação de
conteúdo**, e um patch que imprime o tamanho do que trocou é o que transforma uma corrupção
silenciosa numa linha que dá pra ler.

### O QUE ISSO CUSTOU AO JOGO: NADA

As duas impressões -- **MOTOR** e **DIÁRIO** -- são **idênticas** em 900 batalhas semeadas
(`2bc051b58136 / 51dc1030cf1e`). A Queimada é apresentação mais um **chamador novo** do motor:
nada vai pro save, nenhuma Cloud Function, e o time do save fica byte a byte igual depois de uma
partida inteira.

### ⚠️ E O SANDBOX PRECISOU APRENDER DUAS COISAS

1. **`const` NÃO VIRA PROPRIEDADE GLOBAL.** Declaração de **FUNÇÃO** no topo de um script vira
   sozinha; `const`/`let` ficam no escopo lexical. Foi assim que `queimadaVelocidade` respondia
   enquanto `queimada` (o **ESTADO**) vinha `undefined` -- e a suíte mediria o nada.
2. **`window.scrollTo` ANOTADO, não executado** (`__rolagens`), pela razão do `location.reload()`:
   a largada dos minigames manda a página pro topo, e sem ele qualquer teste que dirija uma largada
   de verdade morre com um TypeError que não tem nada a ver com o que estava sendo testado.

`tools/test-queimada.js` tranca **157 pontas**: o acesso nos 10 estados do campo, as quatro
fórmulas (com o clamp mordendo nos dois extremos e o ponto de ancoragem dos 120 px/s), a compressão
do dano (**com o painel tendo one-shot cru pra aparar** -- sem isso ela daria verde medindo pares
que nunca precisaram de aparo), o adversário, o picker, os golpes voltando do save, o RECEBER
devolvendo e o especial atravessando, a mensagem de dano **nos dois lados**, a eliminação e o fim,
o laço parando quando a tela muda, o toque que não arrasta, os 17 selos e a tela (lendo o CSS).

**⚠️ E A CONFERÊNCIA DE ACUSAÇÃO PEGOU DUAS ÂNCORAS ERRADAS NO PRÓPRIO SCRIPT DE ACUSAÇÃO** -- os
defeitos nunca foram religados, e isso se lê como *"a trava passou em branco"*. Hoje ele confere
que a troca **mudou o arquivo** antes de rodar o teste. Com isso, **os 12 defeitos acusam** -- e um
deles (o selo tirado de UM dos dois botões) só foi pego porque a trava passou a **contar** os dois
em vez de usar `indexOf`.


### A ARENA DA SEMANA (24/09/2026) — a Arena 1x1 virou progressão

Pedida assim: *"toda semana sera sorteado um pokemon acima do bst 500, e durante a semana todo mundo
enfrenta esse pokemon, e cada vez que o treinador vence esse pokemon, ele sobe 1 nivel, e o pokemon
da arena sobe 3 levels a cada nivel. Entao voce vai criar um ranking mostrando os treinadores que
chegaram no nivel mais alto durante a semana. O nivel 1 começa com o pokemon adversário no level
60"*.

**⚠️ É O MESMO DESENHO DA TORRE DOS TREINADORES, e é ele que explica por que o nível não tem teto:**
*"o que ela mede é até onde cada um chega, não quem termina"*. O adversário sobe 3 por nível e passa
do `NIVEL_MAXIMO` (99) no nível **14** — e os 99 são o teto do **JOGADOR**, não do motor (o Mew da
raide é Lv.4999).

| nível | 1 | 5 | 8 | 14 | 20 | 30 | 100 |
|---|---|---|---|---|---|---|---|
| **o adversário** | **Lv.60** | 72 | 81 | **99** | 117 | 147 | 357 |

### ⚠️ ATÉ ONDE DÁ PRA CHEGAR, MEDIDO — e a curva desce de verdade

| | n1 | n5 | n8 | n11 | n14 | n18 | n24 | n30 |
|---|---|---|---|---|---|---|---|---|
| Jolteon **Lv.70** × Dragonite | 95% | 93% | 38% | 25% | 8% | 8% | 0% | 0% |
| Jolteon **Lv.99** × Dragonite | 100% | 100% | 70% | 73% | 73% | 40% | 8% | 13% |
| Snorlax Lv.70 × Dragonite | 100% | 78% | 53% | 40% | 23% | 15% | 5% | 0% |
| **Shuckle** Lv.70 × Dragonite | **0%** | 0% | 0% | 0% | 0% | 0% | 0% | 0% |

Um time normal (Lv.70) para entre o **8 e o 14**; um Lv.99 chega a **18–24**. O Shuckle não vence
nem o nível 1, que é o certo — ele é o pior corpo do jogo.

**⚠️ E O MELHOR CASO POSSÍVEL MORRE POR VOLTA DO 40:** Mewtwo Lv.99 contra a Ninetales (a mais fraca
da lista), com mira alta — **n20=80%, n30=35%, n40=10%, n50=0%**. É esse número que calibra o teto
de gravação.

### ⚠️ O SORTEIO É SEMEADO PELA SEMANA, E O `semanaId` VEM DO SERVIDOR

Não há documento pra ler nem cron pra escrever: `arenaDaSemana(semanaId)` é determinístico, o molde
do `torre-<data>` e do bolo da Liga Pro.

- **⚠️ E A SEMANA NÃO PODE VIR DO RELÓGIO DO CELULAR.** Ela chega na resposta do ranking. Calculada
  no cliente, dois jogadores em fusos diferentes enfrentariam **bichos diferentes** na virada — e o
  sorteio é COMPARTILHADO (*"durante a semana todo mundo enfrenta esse pokemon"*). É a mesma razão do
  `agoraServidor` da batalha online, e o oposto do relógio do Espeon/Umbreon (que é uma preferência
  pessoal, não um sorteio comum).
  **Consequência: sem o ranking carregado a Arena NÃO larga** — não se sabe nem quem é o adversário
  nem em que nível. A tela diz o motivo e oferece "Tentar de novo", que é a regra do sprite que falta.
- **⚠️ A LISTA VAI ORDENADA**, e não na ordem do `Object.keys`: sortear por índice numa lista que
  depende da ordem de declaração amarra o sorteio ao arquivo — a lição do `POOL_METRONOMO`.
- **⚠️ E ELE É INDISTINGUÍVEL DO `Math.random`, medido em 2.000 semanas** (χ² **33,4** contra 44,8 do
  controle, crítico a 5% = 49,8; 58 repetições em semanas seguidas contra ~55,5 esperadas). Nas 12
  PRIMEIRAS semanas o Entei sai **três vezes seguidas** — e isso é sorte da amostra pequena, não
  viés: é a lição do *"amostra única não é medição"*.
  **Se um dia repetir incomodar**, a saída é não repetir o da semana passada — e a régua está aqui.

### ⚠️ SÃO 36 CANDIDATOS, E EXCLUIR OS QUATRO INTOCÁVEIS É O QUE SEGURA A VARIEDADE

Os 40 de BST > 500 menos o Mewtwo, o Lugia, o Ho-Oh e o Celebi — **e eles são justamente o TOPO da
faixa** (680, 680, 680 e 600). Com eles o teto seria **1,35× o do Tyranitar**, e uma semana em nove
seria contra um corpo que nenhuma outra alcança. Sem eles a faixa fica em **505 (Ninetales) a 600
(Tyranitar)**, com média 539.

**⚠️ E OS SEIS LENDÁRIOS CAPTURÁVEIS FICAM** (as três aves e as três bestas, todos BST 580): o
precedente do **ADVERSÁRIO** é o da Pescaria, que exclui só os quatro — a Liga Pro exclui lendário
porque lá o bolo vira o **TIME** do jogador, e aqui ele não ganha nada. Uma semana contra o Zapdos é
um evento, não um problema.

### ⚠️ A SEMANA É JOGÁVEL, E A ESCOLHA DO POKÉMON VIROU DECISIVA

O adversário deixou de ser **pareado por BST**, então a dificuldade do nível 1 passou a depender de
duas coisas: a espécie da semana e quem o jogador leva. Medido com um time campeão típico
(Venusaur 62, Charizard 60, Gyarados 63, Arcanine 59, Alakazam 61, Snorlax 64), nas 12 primeiras
semanas:

| | |
|---|---|
| dos seis, quantos vencem o nível 1 | **3 a 6** (média 4,6) |
| o **melhor** do time, média das 12 semanas | **99%** |
| semanas em que NENHUM do time passa de 25% | **0 de 12** |

**⚠️ E A SEMANA MUDA QUEM VALE A PENA LEVAR, que é a decisão inteira:** contra o **Entei** o Venusaur
faz **0%** e o Gyarados **100%**; contra o **Exeggutor** o Venusaur faz 7% e o Charizard **97%**. Não
é só BST — na Queimada quem decide é o HP (aguenta), o Speed (desvia), a Sp.Def (escudo) e o ataque
(dano), e é por isso que o Arcanine faz 95% contra a Ninetales (505) e 7% contra o Gyarados (540).

### ⚠️ A PROGRESSÃO NÃO VALE NA TRAVESSIA DAS ILHAS — a única decisão que o pedido obrigou a tomar

Na travessia o time é o da **JORNADA** (Lv.~55-65) e o desafio é **OBRIGATÓRIO** pra o prêmio de +3
níveis. Medido, **com o nível valendo lá** (time de jornada, as 2 chances do pedido):

| nível | adversário | uma chance | com 2 chances |
|---|---|---|---|
| 1 | Lv.60 | 75% | **94%** |
| 4 | Lv.69 | 22% | 39% |
| 8 | Lv.81 | 10% | **19%** |
| 12 | Lv.93 | 0% | **0%** |
| 16 | Lv.105 | 0% | 0% |

Ou seja **o jogador seria PUNIDO por jogar a Arena**, e a travessia ficaria **impossível a partir do
nível 12**.

**⚠️ E MESMO O NÍVEL 1 SOZINHO JÁ A ENDURECE — e de forma muito desigual:**

| time de fim de jornada | pareado (hoje) | n1 × Ninetales | × Gyarados | × Dragonite |
|---|---|---|---|---|
| Venusaur Lv.60 | 40% | **2%** | 7% | **0%** |
| Charizard Lv.58 | 53% | 62% | 10% | 10% |
| Gyarados Lv.61 | 88% | 100% | 70% | 62% |
| Arcanine Lv.57 | 48% | **95%** | **7%** | 25% |

Por isso **a travessia continua com o adversário PAREADO POR BST, exatamente como hoje**: o custo
dela é **ZERO por construção**, e o `queimadaSortearNpc` não virou letra morta — ele é o adversário
de lá.

- **⚠️ A GUARDA MORA ONDE O ADVERSÁRIO É MONTADO** (`arenaValeAqui`), e não nos chamadores: é o
  precedente do `registrarSketch`, que só vale na jornada pela mesma razão — **dois modos usam a
  MESMA tela**.
- **E ela vale nas duas pontas**: na travessia o adversário é pareado **e** vencer lá não sobe nível.

### O RANKING: O DOCUMENTO DA SEMANA É O PRÓPRIO RANKING

`arenaRankingWeekly/<segunda>/players/<uid>` guarda o **nível**, e é ele que o top 10 ordena. O nível
é monotônico (só sobe) e já é por semana, então **não há uma segunda coleção a manter** — e o
`orderBy` fica de **UM campo só**, ou seja índice de campo único, que o Firestore cria sozinho. O
primeiro composto que este projeto precisou **nasceu quebrado** (o da Seleção, 21/09).

- **⚠️ NÃO HÁ ABA "DE SEMPRE", ao contrário dos outros três jogos das Ilhas, e a razão é que ela
  compararia coisas DIFERENTES:** o adversário muda de espécie toda semana, e nível 8 contra a
  Ninetales não é nível 8 contra o Dragonite — medido, um Jolteon Lv.99 faz **93%** no nível 8 contra
  o Kingdra e **70%** contra o Dragonite. Nos outros a mecânica é a mesma toda semana, e lá as duas
  abas comparam a mesma coisa.
- **⚠️ NÃO HÁ RESET, pelo mesmo desenho dos outros:** semana nova é **subcoleção nova**, então o
  nível da semana passada simplesmente não está na de hoje. É o molde do
  `trainerTowerDays/{dia}/players/{uid}` da Torre.
- **⚠️ E ELE NÃO ENTRA NO `RANKS_SEMANAIS`: prêmio não foi pedido.** Aquela lista é a do que o cron
  **FECHA E PAGA**, e acrescentá-lo abriria uma torneira de Doce Raro que ninguém pediu — é **uma
  linha** no dia em que for. Sem prêmio não há o que fechar: a subcoleção da semana passada fica onde
  está, como histórico.
- **O MEU NÍVEL VOLTA SEMPRE, e não só quando estou fora do top:** ele não é enfeite de tela — é ele
  que decide o **NÍVEL DO ADVERSÁRIO**, ou seja a partida não existe sem ele.

### ⚠️ QUEM SOMA É O SERVIDOR, E O QUE CHEGA É UM BOOLEANO

Aceitar o `nivel` do cliente seria deixá-lo escrever o próprio lugar no ranking por outro caminho.
É a mesma regra do `venceu` da Seleção — e, como lá, **o duelo NÃO dá pra validar**: a Arena é um
minigame de tempo real, não uma batalha do motor.

- **A transação é OBRIGATÓRIA aqui, e não conveniência:** o que se escreve **depende do que se leu**.
  Nos rankings de placar ela protege um empate; aqui ela protege a **CONTAGEM** — duas abas
  terminando ao mesmo tempo somariam uma vitória só.
- **`venceu` é lido como booleano ESTRITO** (`=== true`): um `'sim'` seria truthy num campo que o
  servidor não controla. Há caso de teste pros seis truthy.
- **⚠️ PERDER NÃO DESCE E NEM CRIA DOCUMENTO** — o pedido fala só da vitória, e um jogador que só
  perdeu seria uma linha de "nível 1" no ranking que não diz nada.
- **⚠️ O TETO É `ARENA_NIVEL_MAX = 100`, e ele recusa o ABSURDO, não a forja:** um cliente forjado
  chama a callable N vezes e sobe N níveis, que é a **mesma superfície dos outros quatro rankings**.
  Ele é 2,5× o melhor caso medido (nível 40), ou seja não recusa nenhuma partida possível — é a régua
  dos 100.000 pontos do `pontosDeRankingValidos`.
  **Pra escala:** uma partida dura **31,3 s de mediana** (min 11,2, max 84,4), então 50 vitórias
  legítimas são ~26 minutos de jogo.

### NA TELA

- **A caixa do Pokémon da semana** (sprite, nome, tipos e o **Lv. que o meu nível manda**) e a do
  **ranking**, nas DUAS telas: o setup e o FIM — é no fim que o nível novo existe, e mandar o jogador
  voltar ao setup pra ver o próprio nível seria esconder o resultado da jogada.
- **⚠️ O ADVERSÁRIO DEIXOU DE SER SURPRESA, e isso é a feature:** é ele que o jogador estuda pra
  escolher quem levar — a mesma razão do (i) das ilhotas do Resgate.
- **⚠️ E NENHUMA DAS DUAS APARECE NA TRAVESSIA:** lá o adversário é pareado e continua sendo surpresa.
  Prometer um bicho que aquela partida não usa é pior que não prometer nada.
- **Os números da frase saem das CONSTANTES** (`ARENA_NIVEL_PASSO`), nunca escritos — a família do
  *"Golpe repete entre 2-5x"*.

**Medido a 320px, no navegador, nas cinco telas** (nível 1, 7 e 30, o erro de rede e a travessia):
**documento em 305 de 320 nas cinco — sem rolagem lateral — e zero textos cortados.**

| | |
|---|---|
| a caixa da semana | **281×271px** (184 no erro) |
| a caixa do ranking | 133px vazia, **238** com 5 linhas, 291 com 6 |
| a página | 1.053 a **1.269px** (676 na travessia, que não tem nenhuma das duas) |

**⚠️ O `<h2>` "Pokémon da semana" CAI EM DUAS LINHAS, e ele está a 4px de não cair:** o título tem
**243px**, o selo come **18**, e o texto precisa de **218** — o espaço entre os dois consome a folga.
O artigo foi tirado por isso (de *"O Pokémon da semana"*, que media 243 exatos), e duas linhas é o
comportamento desta tela: **o `<h2>` vizinho — o `Ilha Pummelo · Drake`, que já existia — também tem
duas.** Se um dia incomodar, a régua é o texto, e ele está medido.

### O QUE ISSO CUSTOU AO MOTOR: NADA

`MOTOR e6cd16d15e0f / DIARIO 1e9b7214c627`, **idêntico** ao build anterior em 900 batalhas semeadas —
e o instrumento é sensível (com o `CRIT_BASE` em 1/8 os dois hashes mudam). A Arena é apresentação
mais um chamador novo do `createInstance`.

`tools/test-arena.js` e `tools/test-arena-rank.js` trancam **77 pontas**: os candidatos (o corte
estrito, os quatro fora, os lendários dentro, a lista ordenada), o sorteio (mesma semana = mesmo
bicho, independente do treinador, sem a semana devolve null, e **o cliente não calcula a semana**), a
escada (nível 1 = 60, o passo, passando do 99, o nível ausente valendo 1, e ela sendo **derivada**),
a instância (o moveset, a vida cheia, sem a especialidade do jogador), **a travessia continuando
pareada nas duas pontas**, a partida não largando sem a semana (e largando na travessia), o envio (o
booleano, só na vitória, nunca na travessia, sem login nem tentando), a tela nos cinco estados, a
abertura relendo, e o servidor (a transação, o teto, o `venceu` estrito, perder não criando, o top
ordenado, o meu nível voltando, a semana sendo subcoleção, **não existir coleção de sempre**, e as
regras fechando a escrita pra todos).
**Conferido que os 24 defeitos religados acusam** (1 a 10 falhas cada) — um deles **MATA** o
`test-arena-rank`, que é a acusação mais forte que existe: o `fake-firestore` recusa a query sem
índice **exatamente como a produção**.

### ⚠️ E ELE CUSTOU QUATRO LIÇÕES

1. **⚠️ O MEU COMENTÁRIO ACUSOU A SI MESMO — a DÉCIMA vez desta família.** Eu citei o literal
   *"Revezamento · 900 m"* ao explicar por que a frase da Arena é derivada, e a trava do
   `test-corrida` **varre o arquivo inteiro** procurando exatamente esse texto. Ela acusou o
   comentário. **Comentário não reproduz o literal que uma trava proíbe.**
2. **⚠️ A TRAVA DA COBERTURA DE CALLABLES PEGOU AS DUAS NOVAS, pelo nome** — é o que ela existe pra
   fazer. As duas foram classificadas como **protegidas**: elas são chamadas só de dentro da tela da
   Arena, que é um modo das Ilhas, e o convidado não joga as Ilhas.
3. **⚠️ MEDI O TÍTULO SEM O SELO QUE ESTÁ AO LADO DELE** — o `textContent` do clone apagava o `<svg>`,
   e a medição disse que ele cabia em uma linha. **Medir um elemento sem o vizinho que divide a linha
   com ele mede outra coisa.**
4. **⚠️ E UMA TRAVA MINHA MEDIU A TELA ERRADA:** o bloco anterior tinha terminado uma partida, e o
   `queimadaTerminar` deixa a fase em `anuncio` — o `contaDeTeste` mexe no `game`, não no estado da
   partida, então o render caía no ramo da QUADRA. **Seis asserções falharam com o código certo.**

- **Se um dia incomodar**, as réguas são o `ARENA_NIVEL_PASSO` (3 — é ele que decide quantas semanas
  um jogador aguenta), o `ARENA_NIVEL_BASE` (60) e o `ARENA_BST_MIN` (500, que decide o elenco).


#### O LÍDER DA SEMANA GANHA DOCE RARO, E O SPRITE FICOU GRANDE (24/09/2026)

Pedido assim: *"pode adicionar que o lider da semana ganha rare candy tambem, e na tela principal da
arena 1x1, exiba um sprite grande de qual o pokemon da semana e em qual nivel o treinador esta"*.

**⚠️ ISSO REVERTE A DECISÃO DA SEÇÃO ACIMA**, que era *"ele NÃO entra no `RANKS_SEMANAIS`: prêmio
não foi pedido"* — e ela mesma dizia que voltar atrás **é uma linha**. Foi.

#### ⚠️ O PRÊMIO É O DOS OUTROS TRÊS, e ele coube numa entrada de tabela

O `RANK_SEMANAL_PREMIOS` já existe e já paga **2 doces ao líder, 1 ao vice e 🪙 50 ao terceiro** —
"também" quer dizer igual aos outros, e reusar a tabela é o que impede o quinto ranking de ter uma
escada própria. **O fechamento, o pódio de placar distinto, a trava de "já pago" por treinador e a
varredura das 4 últimas semanas serviram à Arena de graça**: o cron só pergunta o CAMPO e se maior
é melhor.

**⚠️ MAS UMA COISA NÃO SERVIA: A FRASE DA NOTIFICAÇÃO.** As outras quatro medem **PLACAR** (pontos
ou segundos) e a Arena mede um **CONTADOR** — o texto genérico diria *"com 12 pontos"* onde o certo
é *"no nível 12"*. Por isso a entrada dela declara a **`unidade`**, e ela viaja pela cadeia inteira
(cron → fechar → premiar):

| | a frase |
|---|---|
| Pescaria | *"...ficou em 1º no ranking de Pescaria, **com 550 pontos**."* |
| **Arena** | *"...ficou em 1º no ranking de Arena 1x1, **no nível 12**."* |

**⚠️ A UNIDADE TROCA A PREPOSIÇÃO JUNTO** (`'no nível 12'`, não `'com 12 nível'`), e sem ela o texto
dos quatro que já estão no ar teria que mudar — **há trava cobrando as DUAS metades**: a Arena
dizendo "no nível" **e** a Pescaria continuando a dizer "com 550 pontos". Sem a segunda, uma
mudança que trocasse a frase dos cinco passaria.

- **⚠️ E ELA NÃO ENTRA NA CÓPIA INICIAL**, que é a única parte do mecanismo semanal que não serve a
  ela: **a Arena não TEM coleção de sempre pra copiar** (é a mesma razão pela qual a tela dela não
  tem aba). Aquela lista é **escrita à mão** de propósito — derivada do `RANKS_SEMANAIS`, a Arena
  entraria e o cron marcaria `copiado: true` sobre uma coleção que não existe. Há trava.

#### ⚠️ E UM DEFEITO PASSOU EM BRANCO ATÉ A TRAVA DIRIGIR O CRON

A conferência de acusação achou **um mudo**: tirar o `r.unidade` da chamada do cron **não era
observável**, porque os casos chamavam o `fecharSemanaDoRanking` **direto**, passando a unidade na
mão. É a armadilha do *"os casos chamam a função na mão e passariam com a chamada órfã"*, que este
projeto registra meia dúzia de vezes.

Hoje há um caso que **prepara a semana e chama o `fecharSemanasPendentes()`** — a cadeia inteira —,
e cobra que a notificação que chega diga *"no nível 20"*. Com ele, os **12 defeitos religados
acusam**.

#### A TELA: O SPRITE FOI PRO `sprite-lg`, E O NÍVEL VIROU UM NÚMERO

| a 320px | antes | **depois** |
|---|---|---|
| o sprite do adversário | `sprite-sm` | **`sprite-lg` (110px)**, o maior da casa |
| o meu nível | `Seu nível: 7` a .82rem | **24px (1.5rem)**, com o rótulo em cima |
| a caixa | 271px | **371px** |
| a página | 1.269px | **1.331px** |
| documento / textos cortados | 305 de 320 / zero | **301 de 320 / zero** |

- **⚠️ A CAIXA CENTRALIZA POR CONTA PRÓPRIA** (`.arena-semana`), nunca pelo container: o `.box`
  **não** é `text-align:center`, e depender do contexto é a forma de defeito que o
  `corrida-retrato` já custou — ele centralizava no modal por acidente e saía encostado à esquerda
  na grade da classificação.
- **⚠️ E UM RISCO TRACEJADO SEPARA AS DUAS INFORMAÇÕES da caixa** — o ADVERSÁRIO em cima e EU
  embaixo. Sem ele o "SEU NÍVEL" se lê como continuação do card do bicho, e **isso não aparece em
  asserção de HTML nenhuma: foi a captura de tela que pegou**. É o mesmo risco que o card do
  parceiro usa logo abaixo, na mesma tela.
- **O número é o tamanho da colocação do pódio da Corrida**, e ele não é enfeite: **é ele que decide
  o nível do adversário**. Em .82rem ele se lia como legenda do sprite.
- **Contraste medido**: o número em **16,47:1** e a nota em **5,02:1**, contra o mínimo de 4,5 do AA.
- **⚠️ E O `<h2>` CONTINUA EM DUAS LINHAS**, o que já estava registrado: ele está a 4px de caber, e o
  vizinho (`Ilha Pummelo · Drake`) também tem duas.

#### ⚠️ A NOTA DO PRÊMIO VIROU UMA FUNÇÃO SÓ

A caixa do ranking dizia só *"Zera toda segunda-feira, com o Pokémon novo"* — e **uma tela que
esconde o prêmio não convida ninguém**. Hoje ela diz a **MESMA frase** dos outros três
(*"🏅 Lidere até o fim da semana e ganhe Doces Raros (Até 27/09)"*), com o "Pokémon novo" como
segunda linha: ele é o que ESTA Arena tem de diferente — **lá zera o placar, aqui zera o
ADVERSÁRIO**.

**⚠️ E ELA GANHOU O SEGUNDO LEITOR, então virou função** (`notaDoPremioSemanal`): escrita nos dois,
a segunda divergiria no primeiro ajuste — e o que ela promete é um **PRÊMIO**, ou seja uma tela
dizendo "Doces Raros" e a outra dizendo outra coisa manda o jogador procurar qual das duas vale.
**A trava conta: a frase existe UMA vez no arquivo.**

⚠️ **E A PRIMEIRA VERSÃO DELA ACUSOU A PRÓPRIA FUNÇÃO QUE ELA MEDE** — ela procurava a frase "fora"
da função, e a função a contém. É a armadilha do padrão largo demais, agora dentro da trava.

**E o vazio convida também**: a primeira semana de um jogador abriria uma caixa que só diz "ninguém
venceu", e é justamente ali que o prêmio é o argumento pra jogar.

#### ⚠️ E O QUE ISSO CUSTA DE DOCE RARO POR SEMANA

O teto sobe de 12 pra **14 doces + 🪙 200** (são cinco pódios agora, e o quinto paga 2+1 doces). Em
valor de loja, **🪙 4.400 — 63 jornadas completas**. A comparação que desarma isso continua sendo a
mesma: **a Torre paga 21 doces por semana no teto**, 1,5× o conjunto das Ilhas.

**Se um dia incomodar**, a régua é o `RANK_SEMANAL_PREMIOS` — e ela vale pros CINCO de uma vez, que
é o que a tabela única compra.

#### ⚠️ E O BASH COMEU DUAS PALAVRAS DE UM COMENTÁRIO

Escrevendo o patch por `node -e` dentro do Bash, as **crases** do comentário (\`unidade\`,
\`copiarGeralParaASemana\`) viraram **substituição de comando** — e o arquivo saiu com
*"ela declara a :"* e *"E ELA NAO ENTRA NA :"*. É a mesma família do heredoc que come as barras
duplas, só que pior: **a crase EXECUTA**. Pra texto com crase ou `${...}`, o caminho é a ferramenta
de edição de arquivo — e o sintoma é sempre uma palavra que sumiu sem erro nenhum.


## OS QUATRO RANKINGS DAS ILHAS (21/09/2026) -- o que não atualizava e o que nunca funcionou

Quatro pedidos numa leva, e dois deles eram defeito de verdade -- um relatado, outro **suspeitado**:

> *"os rankings que existem nos jogos das ilhas laranja não estão sendo atualizados em tempo real,
> tá precisando fechar o jogo e abrir de novo pra atualizar"*

> *"adicione o ranking de aproveitamento contra a Luana também na tela principal, **e verifique se
> ele está funcionando, porque acho que está com problemas**"*

### ⚠️ O DA LUANA NUNCA CARREGOU -- e a causa é um índice que o projeto não tinha

```
getSelecaoRanking:  .orderBy('aproveitamento','desc').orderBy('partidas','desc')
firebase firestore:indexes  ->  { "indexes": [], "fieldOverrides": [] }
```

**⚠️ DOIS `orderBy` EM CAMPOS DIFERENTES EXIGEM ÍNDICE COMPOSTO.** Sem ele a consulta morre com
`FAILED_PRECONDITION: The query requires an index`, o cliente cai no `catch` e a caixa mostra *"não
deu pra carregar o ranking"*. **Em toda abertura, desde o dia em que o ranking nasceu.**

- **⚠️ E O CLAUDE.md JÁ APONTAVA A ARMADILHA, em 19/09: *"não existe `firestore.indexes.json`, e o
  projeto tem ZERO índices compostos... é a mesma armadilha que as REGRAS já tiveram antes de
  30/08"*.** O que faltava era alguém precisar de um -- e o primeiro que precisou nasceu quebrado.
- **HOJE O ARQUIVO EXISTE** e o `firebase.json` o aponta (sem a linha ele é letra morta: o deploy não
  publica índice que ele não conhece). Ele entrou no `hosting.ignore` junto, pela razão do
  `firestore.rules` -- a raiz do repo é publicada, e ele não precisa ficar baixável.
- **⚠️ SÓ UMA QUERY DO PROJETO INTEIRO ENCADEIA DOIS `orderBy`**, e é essa. A outra (`lastSeenAt` do
  painel) usa `where` + `orderBy` no **MESMO** campo, que o índice de campo único já cobre.

**⚠️ E O TESTE PASSAVA, PORQUE O FAKE NÃO EXIGIA ÍNDICE.** É a **OITAVA** vez que o dublê é mais
permissivo que a produção (depois do `increment` em mapa, do ponto no `update`, do `getAll` da
transação, do `arrayUnion`, do `count()`, do `undefined` que matou as duas ligas e do `orderBy`
encadeado). Hoje ele **lê o próprio `firestore.indexes.json` do repo** e recusa igual:

```
9 FAILED_PRECONDITION: The query requires an index. Declare em firestore.indexes.json:
selecaoRanking (aproveitamento DESC, partidas DESC)
```

Reproduzido tirando o arquivo: o `test-selecao-rank.js` **morre na linha 5451**, que é exatamente a
linha que a produção executava.

- **⚠️ O QUE O FAKE NÃO COBRE, e fica dito:** `where` num campo mais `orderBy` em OUTRO também exige
  composto. **Nenhuma query do projeto faz isso hoje**, e implementar regra que não roda é o tipo de
  código que fica anos no arquivo sem ninguém saber que está morto -- a mesma decisão dos estágios
  2 a 4 do crítico.
- **E A TRAVA TEM DUAS METADES:** o fake pega a query que algum teste EXERCITA; a varredura do
  `test-selecao-rank` pega a que **nenhum teste toca** -- ela lê o servidor, acha todo
  `.orderBy(a).orderBy(b)` e cobra o índice de cada um.
  ⚠️ **A primeira versão dela achou ZERO queries** (a coleção quase nunca está colada na query --
  ela vem de um ajudante como o `selecaoRankCollRef()`), ou seja ela passaria em branco sobre o
  defeito que existe pra pegar. Quem denunciou foi o `ok` de *"a varredura achou o que ler"*.

**⚠️ E ELE ERA O ÚNICO DOS QUATRO RANKINGS SEM SAÍDA NO ERRO** -- mostrava a mensagem e parava ali.
Ou seja a tela dizia que deu errado e não oferecia nada, **justamente no estado em que o jogador
sempre a via**. Hoje ele tem o "Tentar de novo" dos outros três.

### ⚠️ E O CACHE DOS RANKINGS VALIA PRA SEMPRE DENTRO DA SESSÃO

A guarda era `if(lista && !forcar) return`, e a **única** coisa que invalidava era EU bater MEU
recorde. Então um recorde de outro jogador -- ou eu perder uma posição sem melhorar nada -- só
chegava depois de **recarregar a página**, que é o que zera o módulo. Era literalmente o relato.

Reproduzido nos três, com um servidor dublê que troca "Ana" por "Bruno" entre as aberturas:

| | pedidos ao servidor | o que a tela mostra |
|---|---|---|
| **antes** | 1 | **Ana** (não atualizou) |
| depois | 2 | Bruno |

**O CONSERTO SÃO TRÊS PEÇAS, e elas moram numa função só** (`rankVencido`/`rankInvalidar`) lida
pelos quatro -- três prazos escritos à mão divergiriam no primeiro ajuste, e aí um ranking
atualizaria num ritmo que os outros não:

1. **o cache tem IDADE** (`RANK_VALIDADE_MS`, 30 s);
2. **entrar no modo força a releitura** (o `abrirX` invalida) -- é o caso do relato, "fechar o jogo
   e abrir de novo" virou "entrar no modo";
3. **toda partida invalida**, e não só a que bate recorde: minha POSIÇÃO muda quando outro joga.

- **⚠️ INVALIDAR ZERA A IDADE, NUNCA A LISTA.** Apagando a lista, a caixa **pisca vazia** a cada
  abertura enquanto o novo não chega -- a tela continua mostrando o que tem até a resposta chegar.
- **⚠️ E O `rankInvalidar` FICA NA PRIMEIRA LINHA DO `abrirX`**, antes de qualquer guarda: ele só
  marca uma idade, não muda estado nenhum, e assim a releitura não depende da ordem das guardas.
- **O PRAZO É UM MEIO-TERMO, e a razão é que o `render()` não roda sozinho:** curto demais gasta uma
  chamada por toque na tela; longo demais não parece tempo real. Em 30 s, abrir o modo relê, tocar
  várias vezes seguidas não, e uma partida sempre relê -- o duelo da pescaria sozinho dura 90 s.

**O CUSTO MEDIDO, numa sessão de 10 partidas (com 3 toques na tela entre elas) mais 5 aberturas:**

| | chamadas | leituras |
|---|---|---|
| antes | 1 | **~11** |
| **depois** | **16** | **~176** |

São **16×** -- e em absoluto é pequeno: a tela da Liga Clássica faz ~1.400 leituras/hora sozinha
pelo polling de 5 s. O que segura é a validade: os **3 toques entre partidas não geram chamada
nenhuma**.

**⚠️ E O QUE ISSO NÃO FAZ, que é honesto dizer: parado na tela ele não atualiza.** O `render()` não
roda por conta própria, então o ranking só se refaz quando alguma coisa redesenha a tela -- entrar
no modo ou terminar uma partida. Um ranking **de verdade** em tempo real seria `onSnapshot` (as
regras já permitem: as quatro coleções são `read: if request.auth != null`), e o preço é outro --
uma assinatura viva por jogador com a tela aberta, e o `render()` no meio de uma animação, que é a
regra que este projeto mais protege.

### ⚠️ E O `Infinity` PASSAVA NO RANKING DA PESCARIA

Achado por um caso de teste que eu escrevi pro ranking NOVO do Resgate e que **acusou o da Pescaria
junto**: `Math.max(0, Math.floor(Number(x) || 0))` deixa `Infinity` passar (`Math.floor(Infinity)` é
`Infinity`, e `Infinity > 0`). Um cliente forjado gravava um recorde que **nenhuma partida supera** e
trancava o topo pra sempre.

A **Corrida já tratava** (ela tem `isFinite` e um teto desde 20/09); a Pescaria estava no ar sem
isso desde que nasceu. Hoje os dois passam pelo `pontosDeRankingValidos`, com teto folgado
(`RANK_PONTOS_MAX`, 100.000 -- um duelo rende 200 a 550, então ele não recusa nenhuma partida
possível e recusa qualquer absurdo).

## O RANKING DO RESGATE, O ANÚNCIO DA CORRIDA E OS DOIS BOTÕES (21/09/2026)

### O RESGATE GANHOU A PRIMEIRA OPERAÇÃO DE SERVIDOR DELE

Pedido: *"na página principal do resgate, adicione também um ranking com as maiores pontuações"*.

**⚠️ ELE ERA O ÚNICO DOS CINCO JOGOS SEM RANKING**, e o CLAUDE.md registrava isso como decisão em
aberto: *"não há ranking -- o pedido não pediu, e é por isso que o modo continua sem uma única
operação de backend. Quando houver, é aí que nasce a terceira checagem de permissão"*. É esse dia.

- **É O MOLDE DA PESCARIA, linha por linha** -- as duas métricas são a MESMA coisa (pontos, e melhor
  é MAIOR), então um desenho próprio divergiria dela no primeiro ajuste. O que muda é o segundo
  número: lá são capturas, aqui são RESGATES.
- **UM `orderBy` SÓ**, de propósito: índice de campo único, que o Firestore cria sozinho. É
  justamente o que o da Seleção não pôde fazer.
- **A caixa fica nas DUAS telas** -- a principal (onde o pedido a quer) e a de FIM, porque é ali que
  o "Recorde novo!" acabou de acontecer; mandar o jogador voltar ao setup pra ver a própria marca
  seria esconder o prêmio da jogada. É o que a Corrida já fazia.
- **⚠️ E ELE NÃO É PEDIDO DURANTE A PROVA**: ali o laço está pintando, e uma resposta de rede
  chamaria `render()` no meio da animação -- a regra da casa.

### ⚠️ A CORRIDA TERMINA NUM ANÚNCIO

Pedido: *"quando os 4 corredores cruzarem a linha final, exibir um modal com o pokémon/equipe
vencedora"*.

**"QUANDO OS 4 CRUZAREM" JÁ ERA A CONDIÇÃO** -- quem chama o `corridaTerminar` é o `corridaFisica`,
com `corredores.every(c => c.chegada !== null)`. O que faltava era o modal.

- **⚠️ A FASE É PRÓPRIA (`anuncio`), como na Arena 1x1**, e não um sinalizador sobre a `fim`: com o
  sinalizador a **classificação ficaria desenhada atrás do modal**, que é exatamente o que o pedido
  tira. Aqui a pista congela no último quadro e o modal vem por cima dela.
- **E ELA PARA O LAÇO SOZINHA**: a guarda dele é `!== 'correndo' && !== 'contagem'`, então não foi
  preciso guarda nova -- a mesma propriedade que a Arena aproveitou.
- **⚠️ E O `corridaTerminar` REPINTA DEPOIS DO `render()`**: ele recria o `<canvas>` em branco e o
  laço que o pintava acabou de parar. Sem a pintura a pista sairia vazia **e o placar mostraria
  "0 / 300 m"** -- que é o defeito que o CLAUDE.md já registra na tela de fim ("eles não estavam só
  sobrando: estavam mostrando dado errado"). Uma chamada cobre os dois, porque o `corridaPintar`
  termina no `corridaPintarHud`.
- **⚠️ O QUE O TÍTULO NOMEIA MUDA COM A MODALIDADE**, e é o pedido ao pé da letra ("o pokémon/equipe
  vencedora"): no revezamento quem ganha é a EQUIPE, então vale o **treinador** -- nomear um dos seis
  seria escolher um por acaso, que é o defeito que a classificação já teve em 20/09. No individual
  vale o **pokémon**, que é quem correu. O retrato acompanha: a fileira dos seis ou o sprite grande.
- **Empate exato de tempo não é tratado**, e não precisa: as chegadas são `float` interpolado no
  quadro.

**Medido a 320px:** modal de **265×311px** numa tela de 568 (cabe sem rolar), overlay `fixed`, a
pista atrás e o setup **fora**.

### OS DOIS BOTÕES DE MODALIDADE: DE 32 PARA 81px

Pedido: *"deixe mais evidente os botões de modalidade individual e revezamento na corrida, acho que
eles estão pequenos, coloque símbolos nos dois também"*.

| | antes | depois |
|---|---|---|
| tamanho | **130×32px** | **130×81px** |
| selo | nenhum | **24px, desenhado** |
| o ativo | só o fundo amarelo | fundo **+ moldura escura** |

- **⚠️ O SELO SOBE, NÃO FICA EM LINHA**: é a lição das prateleiras da loja -- num botão de ~118px o
  ícone e o padding comem metade e o rótulo fica com o que sobra ("Revezamento" não caberia).
  Empilhado, o texto fica com a largura toda.
- **A BANDEIRA no individual** (a linha de chegada de quem corre sozinho) e o **`amigos` no
  revezamento** (a equipe que se reveza) -- os selos da casa, não emoji. Conferidos no navegador,
  porque **desenho não se julga por medição**.
- **⚠️ O ATIVO GANHOU MOLDURA, e não só o fundo**: era ele sozinho, e num par de botões claros isso
  se lê como *"os dois são iguais, um está mais claro"*.
- **A METRAGEM CONTINUA DERIVADA** do `corridaTotalDo` -- ela já envelheceu uma vez (o botão dizia
  "900 m" quando a prova virou 1.800).

### O RANKING DA LUANA NA TELA PRINCIPAL

- **⚠️ E O REDESENHO TEVE QUE APRENDER A SEGUNDA TELA.** O carregamento é assíncrono e o
  `selecaoCarregarRank` só chamava `render()` na tela do RESULTADO -- na principal a caixa ficaria
  em **"Carregando…" pra sempre**, porque nada mais a redesenha. Vale nos DOIS caminhos (o que dá
  certo e o `catch`), senão um erro de rede deixaria a tela sem a mensagem.
- **Ela continua no resultado**: a principal é onde MAIS uma, não no lugar da outra -- depois da
  partida é ali que a posição nova aparece.

### O QUE ISSO CUSTOU AO JOGO: NADA

**`MOTOR 079861051846 / DIARIO cfedb1fdcab2`, idêntico ao HEAD** em 900 batalhas semeadas -- e o
instrumento é sensível (com o `CRIT_BASE` em 1/8 os dois hashes mudam).

**Medido a 320px, no navegador, nas sete telas:** **nenhuma rola pro lado**, nenhum nome truncado
(inclusive "TreinadorNomeComprido"), linhas de ranking uniformes em 23-24px.

**⚠️ E OS 14 DEFEITOS ACUSAM**, religados um a um (1 a 7 falhas cada, e o do índice **mata** o teste,
que é a acusação mais forte que existe). Duas lições de teste saíram daí:

1. **⚠️ UMA TRAVA MINHA LIA ONDE DEVIA EXECUTAR.** A do fake procurava `function exigeIndice(` no
   arquivo -- e desligando só a CHAMADA (a função continua declarada) ela **passava em branco** com
   o dublê permissivo de volta. Hoje ela FAZ a query numa coleção sem índice e cobra a recusa.
2. **⚠️ E TRÊS TRAVAS DA CORRIDA MEDIAM A FORMA, NÃO A REGRA:** duas liam o texto do botão
   (`"Individual · 300 m"`, que virou `<b>/<small>`) e uma cobrava *"tem lista ⇒ não relê"*, que era
   a regra do cache ANTES da idade. **É a terceira vez que essa família envelhece aqui** -- as
   outras duas foram quando o trecho da Corrida virou 150 m e quando a lista do Resgate cresceu.

### ⚠️ O RETRATO DE UM TIME NUM MODAL: UM SÓ NÃO CABE NUMA GRADE DE SEIS (21/09/2026)

Reportado com print do modal do ranking **individual**: *"aumente o sprite do pokémon que o treinador
usou e centralize, está ficando na esquerda com muito espaço em branco na direita"*.

**⚠️ A CAUSA É A `save-slot-team-row.spread` SER UMA GRADE DE 6 COLUNAS** (`repeat(6, 1fr)`) — ela
existe pra mostrar um TIME, e o modal a usava nos dois modos. Com um pokémon ele ocupa **1/6 da
largura** e as outras cinco colunas ficam vazias. Medido a 320px:

| | antes | depois |
|---|---|---|
| colunas da grade | **6 de 37,2px** | — |
| o `<img>` | 48px | **110px** (`sprite-lg`) |
| distância do centro da caixa | **95px à esquerda** | **ZERO** |
| altura do modal | 241px | 301px (cabe nos 568) |
| rolagem lateral | nenhuma | nenhuma |

**⚠️ E A REGRA JÁ EXISTIA NO JOGO, escrita à mão no ANÚNCIO DE VITÓRIA** — lá a fileira é do
revezamento e o sprite grande é do individual, com a razão registrada no comentário dele desde
21/09. O modal do ranking nasceu sem ela. Duas cópias da mesma decisão divergiriam no primeiro
ajuste, então as duas telas passaram a ler o **`corridaRetratoDoTime`**, e o anúncio saiu do jeito
que ele já saía.

- **⚠️ A DECISÃO É PELA QUANTIDADE, não pela modalidade.** É mais honesta e cobre um caso que a
  antiga errava: um revezamento com um pokémon só cairia na grade de seis do mesmo jeito.
- **⚠️ O `filter(Boolean)` NÃO É ZELO:** um buraco na lista contaria como segundo pokémon e mandaria
  a tela pra fileira — com **um sprite e cinco colunas vazias**, que é exatamente o defeito relatado
  entrando por outra porta.
- **A classe do retrato é a `modal-icon` que já existe**, e ela **já centraliza** (o `.modal-box` é
  `text-align:center`). O `font-size:2rem` dela não é enfeite: quando o sprite não carrega, o
  fallback é **TEXTO** (o emoji da espécie), e é ele que dá tamanho a esse caso.
- **⚠️ O NÍVEL É OPCIONAL, e só o RANKING o pede:** lá ele diz **com o que aquele tempo foi feito**,
  e a velocidade da Corrida **escala com o nível** — ou seja ele é o que separa um recorde de outro.
  No anúncio, que é sobre quem ganhou agora, ele seria ruído.

#### ⚠️ E O TAMANHO APARENTE É DA ESPÉCIE, NÃO DO CSS — medido

O sprite do PokeAPI é sempre um quadro de **96×96**, e o bicho ocupa uma fração dele que **varia por
espécie**. Medido no navegador (decodificando o PNG servido do mesmo origin — o do CDN deixa o
canvas *tainted*):

| espécie | o bicho ocupa do quadro | a 48px | **a 110px** |
|---|---|---|---|
| **Nidoran♀** (o do print) | **35%** | 17px | **39px** |
| Jolteon | 51% | 25px | 56px |
| Blastoise | 69% | 33px | 76px |
| Snorlax | 70% | 34px | **77px** |

**⚠️ E ISSO É FIEL, não é defeito: a margem guarda a PROPORÇÃO ENTRE AS ESPÉCIES.** Um Nidoran♀ é
pequeno e um Snorlax é grande, e o jogo inteiro usa esse quadro fixo (a Pokédex, a fileira de time,
a batalha). Recortar a margem aqui faria o Nidoran♀ aparecer do tamanho de um Snorlax — um desenho
próprio só desta tela, destoando de todas as outras.

O `sprite-lg` (110px) é o **maior tamanho que a casa tem**, e é o que o anúncio já usava. Se um dia
110 parecer pouco, a régua é ele — e a conta está aqui: o que se vê é `110 × a fração da espécie`.

**⚠️ E O MEU PRIMEIRO INSTRUMENTO MENTIU:** escrevi um decodificador de PNG à mão e ele devolveu
**100% do quadro** pro Nidoran♀ — quatro vezes o valor real. Foi o **navegador** que deu o número
certo. Escrever um decodificador é inventar um instrumento; servir o arquivo do mesmo origin e usar
o `getImageData` é medir com o que já funciona.


#### ⚠️ E A CLASSIFICAÇÃO ERA A TERCEIRA TELA COM O MESMO DEFEITO (23/09/2026)

Reportado assim: *"na tela de resultado da corrida individual, no quadro que aparece o 1, 2, 3 e 4
lugares, como só tem um pokémon, pode exibir esse único pokémon centralizado e com a sprite maior"*.

**⚠️ É O MESMO DEFEITO QUE O MODAL DO RANKING TEVE DOIS DIAS ANTES, e pela mesma causa:** a linha
cravava a `save-slot-team-row spread`, que é uma **GRADE de 6 colunas** — com um pokémon só ele
ocupa **1/6 da largura**, encostado à esquerda, com cinco colunas vazias. Medido a 320px antes de
mexer: sprite de **48px** com o centro em **24 de 171** (o centro da fileira é 86).

| a 320px | antes | **depois** |
|---|---|---|
| sprite | 48px | **110px** (`sprite-lg`) |
| desvio do centro | **−91px** | **0** |
| altura da linha | 124px | 185px |
| a caixa da classificação | 694px | **938px** (+35%) |
| a página | 1.015px | 1.259px, **sem rolagem lateral** |
| **o revezamento** | — | **idêntico em tudo** |

**A REGRA JÁ EXISTIA — o que faltava era esta tela usá-la.** O `corridaRetratoDoTime` (21/09)
decide pela QUANTIDADE: vários ⇒ a fileira do card de time; um ⇒ o retrato grande e centrado. Ele
já servia o modal do ranking e o anúncio de vitória, e a classificação era o terceiro chamador
que ainda montava o HTML à mão.

**⚠️ E O RETRATO PASSOU A CENTRALIZAR POR CONTA PRÓPRIA (`corrida-retrato`), que é a parte que
valia consertar:** o `modal-icon` centralizava por **ACIDENTE do container** — o `.modal-box` é
`text-align:center` —, e a classificação é uma GRADE. Uma função com três chamadores que depende
do contexto de cada um é a forma de defeito que este projeto mais paga: ela funciona em dois
lugares e **quebra no terceiro, em silêncio**. Conferido: o modal e o anúncio saem **visualmente
idênticos** (110×110, desvio 0, página nos mesmos 800px) — a classe é redundante lá, e é ela que
torna a função independente do lugar.

**⚠️ E O NÍVEL CONTINUA NA TELA.** A primeira versão passou `comNivel:false` e o "Lv.60" sumiu da
individual — o antes o mostrava (a fileira o traz em cada sprite). Ele diz **com o que aquele tempo
foi feito**, e a velocidade da Corrida **escala com o nível**: tirá-lo seria regressão em silêncio,
pelo mesmo argumento que o pôs no modal do ranking.

**⚠️ E O REVEZAMENTO CRESCEU 20px SEM NADA TER SIDO PEDIDO — a armadilha da margem que passou a
SOMAR.** Antes o `.resultTime` **ERA** a fileira (as duas classes no MESMO elemento), e ali o
`margin-top:2px` do primeiro **ganhava** do `margin:5px 0` da segunda por especificidade. Com o
retrato no meio elas viraram **dois elementos**, e as margens passaram a se somar: **+5px por
linha, 20px numa classificação de quatro**. Uma linha de CSS (`.resultTime > .save-slot-team-row`)
devolve o revezamento ao que era — conferido medida a medida.

**⚠️ E AS DUAS TRAVAS QUE CAÍRAM MEDIAM A REGRA ANTIGA** (*"é a mesma fileira, com um sprite só"*)
— a **quinta** vez que essa família envelhece na Corrida. Elas não foram afrouxadas: passaram a
cobrar o par (no revezamento é a fileira e ela é FILHA do `.resultTime`; na individual **não** é a
fileira, é o retrato), mais o nível, a classe que centraliza e a margem que não soma — as três
**lidas do CSS**, porque nada disso aparece em asserção de HTML.

**No motor, nada:** `MOTOR 5481ce57abca / DIARIO a4c6725aa4aa`, idêntico. **Os 6 defeitos religados
acusam.**

#### ⚠️ E A CLASSE DO ANÚNCIO ERA FANTASMA

A `corrida-anuncio-time` tinha **1 uso no HTML e ZERO regras no CSS** — ela não fazia nada desde que
nasceu, em 21/09. Saiu junto.

**E uma trava media JUSTAMENTE ela** (*"com a fileira dos seis"*, procurando o nome da classe), ou
seja ela media uma classe morta em vez da fileira de verdade. Hoje ela cobra a
`save-slot-team-row spread`. É a **quarta** vez que essa família envelhece aqui — as outras foram o
texto do botão de modalidade, o *"tem lista ⇒ não relê"* do cache e as cinco que fixavam a metragem
do revezamento.

**CONFERIDO QUE NÃO É MOTOR:** `MOTOR 079861051846 / DIARIO cfedb1fdcab2`, idêntico. **Os 8 defeitos
religados acusam** (2 a 9 falhas, e um **mata** o teste).

## O ADVERSÁRIO DO RESGATE TEM NOME, E O SAIR DA PESCARIA DESCEU (21/09/2026)

Três pedidos de tela: *"no jogo o resgate, aumente o botão PRAIA que tem na ilha. Troque também
tudo onde tá escrito RIVAL pelo nome de um líder da ilha Mikan, Cissy"* e *"na primeira tela da
pescaria, coloque o botão de Sair depois do ranking de Melhores Pescarias"*.

### ⚠️ O NOME SAI DA TABELA DAS ILHAS, e não escrito em seis lugares

A **Cissy é a líder da Mikan**, que é justamente onde o Resgate acontece -- e ela já existia no
jogo, no `ILHAS_LARANJA` e nos adversários da Corrida. Derivar dali é o que impede o dia em que ela
mudar de nome no mapa e o minigame continuar chamando outra pessoa. É o mesmo desenho do
`PESCARIA_NPC_NOME`, só que **sem a cópia**.

- **⚠️ E É FUNÇÃO, não `const` derivada.** A `ILHAS_LARANJA` vem antes no arquivo hoje, mas `const`
  tem zona morta temporal e este projeto já pagou isso **três vezes** (as quatro telas de revelação
  em 09/09, o aviso de versão em 13/09, o `cycleTime` da liga em 18/09). Função é imune à ordem.
- **O FALLBACK É O NOME CERTO, e não a palavra genérica:** se a ilha sumir da tabela, ter o nome de
  verdade é melhor que ter de volta exatamente a palavra que o pedido acabou de tirar.

**São SEIS pontos de tela** -- a tag do topo (`Matheus × CISSY`), o placar do duelo, a legenda do
mapa, o placar do fim, o título do fim e o nome que o pintor escreve.

### ⚠️ E A SEXTA SÓ APARECEU NO NAVEGADOR: a varredura tem que ignorar a CAIXA

A legenda do mapa dizia **`Laranja: rival`** em MINÚSCULA, e a varredura que eu tinha feito no
arquivo procurava a palavra em maiúscula. Ela passou limpa pelo `grep` e foi o **navegador** que a
achou, lendo o texto da tela renderizada.

**Varredura de texto de TELA se faz sem distinguir maiúsculas** -- e a trava faz assim.

### ⚠️ E O NOME DE CÓDIGO CONTINUA, de propósito

`const rival = resgate.atores[1]` e um comentário JS seguem dizendo a palavra, e **devem seguir**:
renomear código interno é churn pra trocar uma palavra que só aparece na tela. É a mesma decisão
que a Arena 1x1 tomou quando ela mudou de nome (*"renomeá-los seria churn em ~200 referências pra
trocar uma palavra que só aparece na tela"*).

Por isso a trava varre a **TELA RENDERIZADA**, nunca o arquivo -- varrendo o arquivo ela pegaria os
três e obrigaria o churn que a decisão evita.

### O BOTÃO DA PRAIA

| | antes | depois |
|---|---|---|
| tamanho | *(padding 4px 8px, fonte .58rem)* | **83×32px** |
| fonte | .58rem (~9px) | **.78rem (12,5px)** |
| relevo | nenhum | sombrinha de 2px |

- **⚠️ ELE CONTINUA RETANGULAR**, e isso é o desenho: *"ela não é um ponto de resgate, é o lugar pra
  onde se VOLTA -- forma diferente, leitura diferente"*. Crescer não podia virar um sétimo ponto.
- **Medido a 320px, no navegador:** ele fica **dentro do mapa** e **não encosta em nenhum dos seis
  pontos** -- que era o risco de aumentá-lo, já que ele vive sobre o mesmo retângulo que eles.

### O SAIR DA PESCARIA FECHA A TELA

Ele estava **DENTRO da caixa** do setup, o que punha o ranking **abaixo do botão de sair** -- e um
botão de saída no meio da tela corta a leitura: quem chega nele para de rolar e não vê o que vem
depois. Fora da caixa ele fecha a tela, que é onde um "Sair" pertence, e é o que a **Corrida**, o
**Resgate** e a **Arena** já faziam.

**Medido a 320px:** Começar o duelo (y=771) → Melhores pescarias (y=887) → **Sair (y=1060)**, ele é
o último elemento da tela, 304×52px, sem rolagem lateral.

- **⚠️ E ELE CONTINUA LÁ COM O RANKING VAZIO OU EM ERRO:** ele é da TELA, não da caixa -- se
  dependesse dela, um erro de rede deixaria o jogador **sem saída**. Há caso de teste pros dois.

**No motor, nada:** `MOTOR 079861051846 / DIARIO cfedb1fdcab2`, idêntico. **Os 8 defeitos religados
acusam** (2 a 7 falhas cada).

## O RANKING SEMANAL DOS TRÊS JOGOS DAS ILHAS (23/09/2026)

Pedido assim: *"crie um ranking semanal para os jogos pescaria, corrida e resgate das ilhas
laranjas. O lider de cada semana ganha 2 rare candy, o vice lider ganha 1 rare candy e o terceiro
colocado ganha 50 moedas, reseta toda segunda feira meia noite, e mantem o rank de sempre, serao 2
rankings, coloque 2 abas no ranking que existe hoje, e pode copiar os dois igual, porque como
começou antes de ontem, só teve essa semana"*.

### ⚠️ NÃO EXISTE "RESETAR" — cada semana é uma SUBCOLEÇÃO própria

`<base>Weekly/<segunda>/players/<uid>`. Semana nova é **outra subcoleção**, então **não há o que
apagar** — e isso resolve três coisas de uma vez:

| | |
|---|---|
| o reset | não acontece: a semana velha fica onde está |
| o **índice** | a consulta continua sendo um `orderBy` de **um campo só** — filtrar por semana dentro do mesmo documento exigiria composto, e o primeiro que este projeto precisou **nasceu quebrado** (o da Luana, 21/09) |
| o histórico | fica de graça, e é dele que o fechamento paga |

**⚠️ E O MOLDE JÁ EXISTIA NO JOGO: é o `trainerTowerDays/{dateId}/players/{uid}` da Torre**, com o
fechamento no cron e a trava de "já pago" por treinador. **Nada aqui é caminho novo.**

### A SEMANA: segunda a domingo, no FUSO DO JOGO

`semanaDoRanking(ts)` devolve a data da **segunda** daquela semana, e ela é o id.

- **⚠️ A CONTA REUSA O `trainersLeagueDateStrFromTime` / `trainersLeagueTimeOnDate`:** uma segunda
  regra de data (a minha, em UTC) discordaria da do jogo em algum fuso, e a virada aconteceria numa
  hora que o jogador não reconhece. Medido: **23:59 de domingo (SP) ainda é a semana velha e 00:01
  de segunda já é a nova** — que é o *"reseta toda segunda feira meia noite"* do pedido.
- **⚠️ E ELA É CALCULADA AO MEIO-DIA**, como o `trainersLeagueDateStrPlusDays` já faz: é o que evita
  a borda do horário de verão.

### ⚠️ O GERAL E O SEMANAL SÃO INDEPENDENTES, e é isso que faz a aba nova existir

As duas leituras acontecem na **MESMA transação** (o Firestore exige todas as leituras antes das
escritas) e **cada uma decide sozinha**. Medido: um placar de **350** não bate o recorde de sempre
(400) e **É** o recorde da semana.

Sem isso a aba da semana mostraria os mesmos números da de sempre e a feature não teria acontecido.

- **A Corrida tem o mesmo desenho com MENOR é melhor**, e com **merge**: as duas modalidades vivem
  no mesmo documento, e sem ele a segunda apagaria a primeira — quem correu as duas perderia uma.

### OS PRÊMIOS, E O PÓDIO É DE PLACAR DISTINTO

| | |
|---|---|
| **1º** | 2 Doces Raros |
| **2º** | 1 Doce Raro |
| **3º** | 🪙 50 moedas |

- **⚠️ O PÓDIO É DE PLACAR, NÃO DE PESSOA** — a regra que a Torre já pratica: com dois empatados no
  topo, os **DOIS** são líderes e o 2º degrau é o próximo placar que teve alguém. Medido: cinco
  jogadores com 900/900/700/500/100 pagam **quatro** prêmios.
- **A notificação diz a posição, o que ele ganhou e que a posição foi DIVIDIDA** — prêmio que o
  jogador não vê é o erro da especialidade de novo (ela valia 1%, não tinha selo, e a conclusão foi
  *"não mudou nada"*).

**⚠️ SÃO QUATRO PÓDIOS, e não três: a Corrida tem DOIS rankings** (individual e revezamento), e eles
são coisas diferentes — não dá pra somar tempo de um com o do outro.

**⚠️ E POR ISSO A TRAVA DE "JÁ PAGO" LEVA O RANKING NA CHAVE** (`pago_<base>_<campo>_<semana>`), e
não só a semana: o mesmo treinador pode estar no pódio das duas modalidades, e com a chave só da
semana **a segunda não seria paga**. Há trava.

**O CUSTO POR SEMANA, no teto** (exige 3 placares distintos nos quatro pódios):

| | |
|---|---|
| | **12 Doces Raros + 🪙 200** |
| em valor de loja (o doce custa 300) | **🪙 3.800** |
| em renda de jogo (a jornada paga 70) | **54,3 jornadas completas** |
| por ano | 624 doces |

**⚠️ E O NÚMERO QUE DESARMA ISSO É A COMPARAÇÃO COM A TORRE: ela já paga 1 doce por dia a cada um
dos três degraus, ou seja 21 doces por semana no teto — 1,8× o que o semanal das Ilhas paga.** Não é
uma torneira de escala nova; é uma segunda da mesma ordem.
**Se um dia incomodar**, a régua é o `RANK_SEMANAL_PREMIOS`, e a conta está aqui: 1 doce é +1 nível,
que sozinho vale **+0,54 ponto** de vitória (dentro do ruído) — o que ele compra é ACÚMULO (+5
níveis valem +4,25 e +10 valem +8,19).

### O FECHAMENTO É O DA TORRE, LINHA POR LINHA — inclusive a ORDEM

- **⚠️ A MARCA `awarded` VAI POR ÚLTIMO.** Marcar a semana como paga **antes** de pagar faria um erro
  no meio do laço **apagar o resto do pódio pra sempre**, porque a volta seguinte do cron veria a
  marca e iria embora. Pagar duas vezes **não** é o risco — quem trava isso é a chave por treinador,
  dentro da transação.
  **⚠️ E A TRAVA DISSO PASSOU EM BRANCO NA PRIMEIRA VERSÃO:** ela media a **ÚLTIMA** ocorrência da
  marca, e o defeito religado acrescenta uma **ANTES** sem tirar a de depois. Hoje ela mede a
  primeira ocorrência **depois do pódio** — e a fatia começa ali de propósito, porque o ramo da
  semana **VAZIA** marca antes por desenho (não há o que pagar).
- **⚠️ O CRON FECHA A ANTERIOR, NUNCA A CORRENTE.** Fechando a corrente, o prêmio sairia no meio da
  semana e ela continuaria aceitando pontuação depois de paga — quem jogasse na quarta correria por
  nada. Há trava cobrando as duas metades.
- **Ele varre `RANK_SEMANAS_A_FECHAR` (4) semanas pra trás**, do mais VELHO pro mais novo, pelo mesmo
  motivo da Torre: uma semana que ficou pra fora se recupera sozinha em vez de esperar um relato.
- **A semana VAZIA fecha e fica MARCADA**, senão o cron voltaria nela de hora em hora pra sempre.

### ⚠️ A CÓPIA INICIAL, e ela roda UMA VEZ SÓ

Foi o pedido (*"pode copiar os dois igual, porque como começou antes de ontem, só teve essa
semana"*): os três jogos nasceram há poucos dias, então **todo recorde de sempre é também desta
semana** — e sem a cópia a aba da semana abriria **VAZIA pra todo mundo no dia do deploy**, o que se
leria como o ranking ter sido apagado.

- **⚠️ ELA SÓ PREENCHE QUEM FALTA.** Quem já jogou nesta semana tem placar próprio, e ele manda — o
  do geral pode ser de um dia anterior. **Reescrevendo, ela apagaria um recorde novo com o valor
  velho.** Medido: um jogador com 800 no geral e 300 na semana **fica com 300**.
- **⚠️ E A MARCA (`copiado`) É O QUE A FAZ RODAR UMA VEZ:** o cron passa de hora em hora, e sem ela
  cada volta **varreria as três coleções inteiras**.
  **⚠️ E ISSO CUSTOU UMA TRAVA MUDA, porque as duas guardas protegem o DADO igual** (a marca e o
  `if(ja.exists)`): com a marca removida, o teste continuava verde. O que **só** a marca garante é
  observável de outro jeito — **quem entra no geral DEPOIS da cópia não é copiado** —, e é isso que
  a trava passou a cobrar. (E não é buraco: quem faz um placar de sempre novo o fez **jogando**, e o
  envio grava nos dois.)
- **⚠️ E ELA SÓ COPIA A SEMANA CORRENTE.** Semana passada não tem o que copiar: o geral não guarda
  QUANDO cada recorde foi feito, então espalhar o de sempre pelas anteriores **inventaria um passado
  que não aconteceu — e pagaria prêmio por ele**.
- **A cópia vem ANTES do fechamento no cron**: ela só mexe na corrente e ele só nas anteriores, então
  os dois nunca se cruzam — mas invertida, uma semana que virasse no meio da passada teria o
  fechamento rodando sobre uma lista ainda vazia.

### AS DUAS ABAS

**"Da semana"** e **"De sempre"**, nas três telas, com a lista da semana como **padrão**: é ela que
muda, e é nela que ainda dá pra fazer alguma coisa hoje — o de sempre é histórico, e quem o procura
sabe onde ele está.

- **⚠️ A ABA É A `tower-rank-aba` DA TORRE, e não uma nova:** o jogo **já tinha** esse controle
  (Hoje/Histórico), e um próprio faria o jogador reaprender a ler o mesmo botão. O nome ficou com o
  prefixo de onde ela nasceu — renomeá-lo seria mexer numa tela que funciona e numa trava frágil pra
  trocar uma palavra que só aparece no CSS, a mesma decisão que a Arena 1x1 tomou.
- **⚠️ E A PRIMEIRA VERSÃO ERA UMA CLASSE PRÓPRIA QUE NASCEU INVISÍVEL:** a borda dela usava um nome
  de variável de cor que **não existe na paleta**, e o navegador **DESCARTA a declaração inteira** —
  a aba inativa saía com o **MESMO fundo da caixa e sem moldura nenhuma**. Em asserção de HTML ela
  passa; foi a **medição no navegador** que pegou. É a **nona** vez desta família aqui (`--cream`,
  `--yellow-soft`, `.section-title`, `.app-shell`, a variante do botão de fisgar, `mewtwo-loan-cta`,
  `corrida-anuncio-time`, `pesc-trocar`).
- **⚠️ AS DUAS LISTAS VÊM NA MESMA RESPOSTA do servidor**, então trocar de aba **não custa rede** — e
  é por isso que a troca é só um `render()`. Duas chamadas fariam a aba piscar *"Carregando…"* a cada
  toque, que é o oposto do que uma aba promete.
- **⚠️ QUAL LISTA DESENHAR SAI DE UMA FUNÇÃO SÓ** (`rankListaDaAba`), e não de um `if` em cada tela:
  três cópias divergiriam no primeiro ajuste, e o sintoma seria uma tela mostrando a aba certa e
  outra a errada.
- **A aba é POR JOGO** (`rankAba.pescaria` / `.corrida` / `.resgate`): as três são telas diferentes,
  e uma aba só faria a escolha de uma valer na outra. **É estado de TELA e não vai pro save** —
  ninguém volta amanhã querendo o ranking aberto numa aba específica.
- **⚠️ NA CORRIDA SÃO DOIS EIXOS** — a MODALIDADE e a ABA —, e os dois leitores (a tela e o **modal
  do time**) têm que olhar a **MESMA célula**. Lendo `corridaRank[formato]` direto, um toque na aba da
  semana abriria o time do ranking **de SEMPRE**, e o modal mostraria um time que não é o da linha.
  Por isso ela vive no `corridaRankDaAba`.
- **O VAZIO DA SEMANA DIZ OUTRA COISA** (*"ninguém pontuou NESTA SEMANA ainda"*): ali não é "nunca",
  e as abas continuam na tela pra dar pra voltar ao de sempre.
- **⚠️ E SEM A LISTA DA SEMANA ELE CAI NO DE SEMPRE em vez de estourar:** um cliente que leu antes do
  deploy — ou um erro de rede — tem `semanal` nulo.
- **A nota do prêmio (`🏅 Lidere a semana e ganhe Doces Raros`) só sai na aba da semana**, e ela
  **nomeia a segunda em que a semana começou**: no de sempre não há prêmio pra convidar, e ela
  mentiria.

**Medido a 320px, no navegador, nas cinco telas** (as três da semana, a de sempre e a semana vazia):
**nenhuma rola pro lado**, abas de **126×30px** em duas colunas, a nota em 14px, **nenhum nome
truncado** (nem "TreinadorNomeComprido") e as linhas uniformes em 23-24px. A caixa vai de **173 para
211px** (aba de sempre) e **231px** (aba da semana, com a nota) — **+33% no pior caso**, que é o
preço de a aba existir.


#### A NOTA DIZ O PRAZO, NÃO A ABERTURA (23/09/2026)

Pedido no mesmo dia em que ela nasceu: *"na mensagem do ranking da semana onde aparece escrito
'Lidere a semana e ganhe Doces Raros (desde 21/09)', coloque assim: 'Lidere até o fim da semana e
ganhe Doces Raros (Até 27/09)'"*.

**⚠️ A DATA TROCOU DE PONTA: era a SEGUNDA (quando a contagem abriu) e virou o DOMINGO (o prazo).**
O que decide se vale a pena jogar hoje é **quanto tempo ainda há**, não quando ela começou — e a
abertura é a informação que o jogador menos usa, porque ela já passou.

- **⚠️ O DOMINGO É DERIVADO do `trainersLeagueDateStrPlusDays(semanaId, 6)`**, e não de uma conta
  minha: o `semanaId` É a segunda, e essa é a **MESMA regra de data que o cron usa pra fechar a
  semana**. Uma segunda regra discordaria dele em algum fuso, e a tela anunciaria um prazo que o
  fechamento não pratica. É a lição que a própria conta da semana já registra.
- **A nota continua saindo SÓ na aba da semana**: no de sempre não há prêmio pra convidar.

**CUSTO MEDIDO a 320px, no navegador:** a nota vai de **14px (1 linha) para 29px (2 linhas)** —
**+15px** —, nas três telas, **sem rolagem lateral**.

### AS REGRAS, E O QUE ELAS PROTEGEM AQUI É MAIOR QUE ANTES

As três coleções semanais são `allow read: if request.auth != null` e **`allow write: if false`**,
inclusive pro dono — como as três de sempre.

**⚠️ E AGORA ISSO PESA MAIS: o prêmio é DOCE RARO, ou seja NÍVEL.** Nos rankings de sempre uma linha
no console poria um número bom no topo; aqui ela **compraria nível**. Há trava lendo as regras como
texto, nas seis portas (o documento da semana e a subcoleção `players` das três).

### O QUE ISSO CUSTOU AO MOTOR: NADA

`MOTOR 5481ce57abca / DIARIO a4c6725aa4aa`, **idêntico** em 900 batalhas semeadas.

`tools/test-rank-semanal.js` tranca **96 pontas**: a conta da semana (a virada na meia-noite do fuso
do jogo, o domingo ainda na semana velha), a independência do geral e do semanal, as duas listas na
mesma resposta **com números que DIFEREM de verdade**, a Corrida com as duas modalidades e o merge,
o pódio de placar distinto com empate, os três prêmios, a notificação, o fechamento idempotente
(inclusive **com a marca da semana apagada**), a chave por ranking, a semana vazia, o cron fechando a
anterior e não a corrente, a cópia inicial nas três formas, as regras lidas como texto, e as abas
(as duas, só uma acesa, a padrão, a nota só na semana, o vazio, o fallback e o modal do time da
Corrida lendo a mesma célula).
**Conferido que os 15 defeitos religados acusam** (1 a 7 falhas cada).

