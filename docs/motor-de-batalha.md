# Motor de batalha: golpes escolhidos, status e passivas

> ⚠️ **ESTE ARQUIVO SAIU DO `CLAUDE.md` EM 24/09/2026**, e o motivo é medido: ele tinha **249 KB**
> — 16% de um arquivo que é carregado INTEIRO em toda sessão. O `CLAUDE.md` tem a linha de índice
> que manda ler este capítulo, e o gatilho dela é o que importa: **antes de mexer em dano, golpe,
> status, passiva ou no log de batalha, leia isto primeiro.**
>
> Ele nasceu como a seção *"Os golpes do pokémon (escolhidos pelo jogador)"* e virou o registro do
> motor inteiro — o conteúdo abaixo é o dela, palavra por palavra, sem uma linha cortada.

---

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
  de Asa).
  **⚠️ A ÚLTIMA FRASE DESTE ITEM DIZIA "e fica como está", E ISSO CADUCOU EM 24/09/2026:** a forma
  evoluída passou a HERDAR o aprendizado da linha inteira, então o Raichu tem Trovão. Ver **A FORMA
  EVOLUÍDA HERDA O APRENDIZADO DA LINHA**, mais abaixo — foi um Cloyster de 3 golpes que trouxe a
  mudança, e o que a justificou é que o Raio Congelante dele era inalcançável pra a linha INTEIRA.
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

> **⚠️ ISTO É HISTÓRIA desde 24/09/2026: a PASSIVA acabou e a confusão virou STATUS POR ATAQUE** —
> ver **A CONFUSÃO VIROU STATUS POR ATAQUE**, logo abaixo. Nenhum pokémon tem mais passiva de
> confusão; quem confunde é o GOLPE, com a chance dele. O que continua valendo inteiro daqui é a
> **conta do auto-dano** (o espelho sem tipo e sem crítico, e a cauda de atributo que ela produz) e
> a **apresentação da marca velha** (`confusao`), que fica porque log velho não pode sumir.

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


### ⚠️ QUEM JÁ CAIU PERDIA O TURNO NA TELA (18/09/2026)

Reportado com print, **na Torre**: a Jynx matou o Primeape (o cabeçalho já mostrava `0/435`) e a
linha *"Primeape continua a dormir e não pode atacar"* saía **logo depois** do golpe que o derrubou.

```
Jynx atacou Primeape com Psíquico e tirou −391 de HP.
Jynx atacou Primeape com Psíquico e tirou −44 de HP.     ← ele morre aqui (391+44 = 435)
😴 Primeape continua a dormir e não pode atacar.          ← e perde o turno depois de morto
```

**⚠️ A CAUSA É A POSIÇÃO DA CHAMADA, e ela está certa:** o `dormeDe(second)` vem **depois** do golpe
do first — e tem que vir, porque a frase é sobre **o turno dele**, que acontece depois do golpe de
quem é mais rápido (foi assim que ela nasceu, em 16/09, justamente pra não sair na ordem invertida).
O que faltava é que **o golpe do first pode ter derrubado o second**.

Medido: a linha saía em **47% dos confrontos** em que o adormecido morre.

**A guarda mora DENTRO das três funções** (`geloDe`, `dormeDe`, `travadoDe`), não nas chamadas: as
do gelo rodam antes dos golpes e hoje estão seguras, **mas foi mover uma chamada que criou o
defeito** — dentro da função ela não se perde.

**É APRESENTAÇÃO PURA, e está conferido por DUAS impressões:** a do **MOTOR** (quem ganhou e com
quanto de HP) é **idêntica** em 900 batalhas semeadas; só a do **DIÁRIO** muda, que é o que um
conserto de log deve fazer. Medir as duas juntas teria dito que o motor mudou — ele não mudou.

#### ⚠️ E O PAINEL DA TRAVA DA PARALISIA ESTAVA MEDINDO O PRÓPRIO BUG

A trava *"achei um confronto com o turno perdido"* usava um **Magneton Lv.70 contra três de 68** — e
ali ele **mata o paralisado no golpe** (495 de 559 confrontos). Os 121 "turnos perdidos" que ela
achava eram, quase todos, **a linha saindo depois da queda**.

Consertado o defeito, o painel foi a **ZERO** e a trava falhou **sem nada estar errado**: ela não
tinha um só caso legítimo pra medir. Com o Magneton em **60 contra três duros de 70** ele sobrevive,
e a linha sai 45 vezes.

É a mesma armadilha do **painel forte demais** que este arquivo já registra na medição do Smeargle e
na do revide — só que aqui ela **escondia um bug** em vez de um zero.

### ⚠️ A TORRE SEGUE A MECÂNICA DA JORNADA — verificado (18/09/2026)

Perguntado junto com o relato acima: *"verifique se a torre de treinadores está seguindo a mecânica
de lutas da jornada, desconfio que tem coisa diferente"*.

**Não tem.** A Torre roda no **servidor** (`fightTrainerTowerFloor` → `simulateGymBattle`, **sem
opções**) e a jornada roda no **cliente** — e o defeito do print estava nos **dois** motores, igual.
A suspeita era razoável e o que a produziu foi o defeito, não a Torre.

A verificação virou trava: a MESMA batalha (mesmos times, mesma semente, o NPC com moveset como a
Torre faz) roda nos dois e compara o **diário inteiro, golpe a golpe** — não só quem ganhou.
Resultado: **0 divergências em 150 batalhas**, tocando em **25 mecânicas** (sono, gelo, queimadura,
veneno, paralisia, chuva, fúria, confusão, dreno, multi-tapa, Remoinho, as duas danças, explosão,
anulação, Recuperar, estágio, Fúria do Dragão…).

**⚠️ E ELA COBRA QUE TENHA TOCADO NAS MECÂNICAS:** sem essa segunda linha, a comparação daria verde
comparando 150 trocas de golpe comum — que é justamente o caso em que os dois motores nunca
divergiriam.

**O que a Torre tem de diferente é o CONTEXTO, não a mecânica:** o time vem de vários saves, não há
terreno, e o NPC é montado no servidor. A luta em si é a mesma.

### ⚠️ QUEM NÃO ATACOU APLICAVA STATUS (18/09/2026)

Reportado com print: o **Dewgong estava dormindo e mesmo assim congelou o Gengar**. O log da tela
dizia, em linhas seguidas:

```
😴 Dewgong continua a dormir e não pode atacar.
❄️ Gengar ficou congelado com RAIO CONGELANTE!
```

**⚠️ A CAUSA É O `lastMove`, e ela vale pros SEIS `tentar*`.** Eles leem o último golpe do atacante
pra saber a chance — e esse campo fica gravado da troca **ANTERIOR**, ou até de **outro confronto**
(a instância atravessa a batalha inteira). Quem dorme não chama o `golpesDaTroca`, então o
`lastMove` velho continua lá e o sorteio rodava em cima dele.

**⚠️ E NÃO ERA SÓ O SONO NEM SÓ O GELO.** Medido antes do conserto: os **TRÊS** estados que zeram o
golpe vazavam nos **QUATRO** status, cada um na chance cheia:

| quem não ataca | gelo | queimadura | veneno | paralisia |
|---|---|---|---|---|
| **dormindo** | 9,5% | 9,5% | 30,1% | 30,1% |
| **congelado** | 8,8% | 8,7% | 29,3% | 31,0% |
| **paralisado** | 10,1% | 9,9% | 30,6% | 30,3% |

Em 18.000 trocas, **1.208 aplicavam status sem um golpe ter saído**.

**⚠️ A GUARDA É O GOLPE TER SAÍDO, e não uma lista dos três estados:** `dmgByFirst` já é `[]` quando
ele não ataca, **seja por que for**. Assim o próximo estado que impedir um ataque nasce coberto —
uma lista de estados ali ficaria para trás no primeiro que entrasse.

**O CONSERTO É EXATO, e é isso que a medição prova:** os casos de status **sem** golpe vão de 1.208
para **ZERO**, e os **611 casos legítimos** (quem degelou, ou não travou pela paralisia, e atacou)
ficam **idênticos** — o conserto não tocou em nada que estava certo.

**⚠️ E ELE MUDA A SEMENTE, o que é esperado num conserto de mecânica:** os `tentar*` deixam de ler o
rng nesses casos. Medido: **1,2% das batalhas** de times sorteados mudam de resultado, e **45,8%**
num painel propício (soníferos de um lado, golpe de status do outro). A impressão de 900 batalhas
do painel geral **não mudou** — o caso é raro o bastante para não aparecer ali.

**O PREÇO NA JORNADA: nada. 53,23% contra 54,28% de conclusão** — **+1,05 ponto, 1,6σ** (8 blocos
de 800 jornadas de cada lado, **6.400 de cada**, o MESMO bot contra duas cópias congeladas, desvio
tirado de ENTRE os blocos, **5 de 8 blocos** pro lado do conserto). Ruído, e a direção é a esperada:
o que sumiu foi status aplicado **por quem não atacou**, e isso caía dos dois lados.

### A CONFUSÃO VIROU STATUS POR ATAQUE (24/09/2026)

Pedida assim, com a Bulbapedia como fonte: *"hoje ele é dano passivo que tem chance de acontecer no
início da batalha, agora você vai tirar esse passivo e vamos colocar ele para ter chance do oponente
ficar confuso de acordo com a chance que o ataque tem de causar confusão. É basicamente a mesma
mecânica que os ataques de fogo que deixam o oponente queimando ... tem uma chance de ao invés de
atacar o oponente, ele se ataca durante a confusão. Não esquece de colocar o * nos cards de ataques
falando que aquele ataque tem % de deixar o oponente confuso"*.

**⚠️ ELA É A QUINTA MECÂNICA POR ATAQUE — e a ÚNICA que entrou no lugar de uma PASSIVA.** As quatro
anteriores (gelo, queimadura, veneno, paralisia) nasceram do nada; esta **substituiu** a passiva de
10% por confronto que 82 espécies tinham desde 10/09/2026.

| | a passiva (até 23/09) | o status por ataque (hoje) |
|---|---|---|
| quem confunde | a **ESPÉCIE** (82 delas, `CONFUSAO`) | o **GOLPE** (6 deles, `GOLPES_QUE_CONFUNDEM`) |
| quando é sorteado | na **ABERTURA**, 1× por confronto | a cada **GOLPE que conecta** |
| a chance | **10%**, uma só | **10% a 100%**, por golpe |
| quanto dura | **um** auto-golpe e acabou | **2 a 5 turnos**, e ela ATRAVESSA confrontos |
| sai em | **5,7%** dos confrontos | **0,65%** |

**⚠️ ELA FICOU 8,8× MAIS RARA, e isso é o preço da fidelidade:** medido, ela sai em **0,65% dos
confrontos e 2,7% das batalhas 3x3** — entre o gelo (0,18%) e a queimadura (0,80%), quando **era a
mais comum de todo o bloco**. A causa é dupla: 82 espécies viraram **30 que LEVAM** um dos seis no
Lv.70, e a chance passou a ser do golpe.

#### OS SEIS GOLPES, com as chances oficiais da Gen 3

| golpe | poder | chance |
|---|---|---|
| **Soco Dinâmico** | 100 | **100%** |
| Pulso de Água | 60 | 20% |
| Soco Tonto | 70 | 20% |
| Confusão | 50 | 10% |
| Psicoraio | 65 | 10% |
| Feixe de Sinal | 75 | 10% |

**A lista saiu do dado** (Showdown, mod da Gen 3), o mesmo caminho das outras quatro.
**⚠️ E OS CINCO GOLPES DE STATUS QUE CONFUNDIAM FICARAM DE FORA** — Supersom, Raio Confuso, Bravata,
Beijo Doce e Bajulação são **poder 0**, e a base só cadastra dano. É a MESMA regra que tirou o Pó
Venenoso do veneno e o Will-O-Wisp da queimadura.

**⚠️ E É ELA QUE EXPLICA A QUEDA, não uma escolha — medido, pra onde foram os 82 donos da passiva:**

| | |
|---|---|
| **continuam confundindo** (levam um dos seis) | **28** |
| perderam porque o golpe deles era de **STATUS** | **48** |
| perderam porque **não LEVAM** o de dano no moveset | 6 (Exeggutor, Noctowl, Octillery…) |
| **confundem hoje e NÃO estavam na passiva** | **2** — Kabutops e **Mewtwo** |

Ou seja **48 dos 54 que perderam** é a regra do poder 0, e os outros 6 são o motor escolhendo outro
golpe. **28 + 2 = os 30 de hoje.**

#### ⚠️ O SOCO DINÂMICO É 100% E QUASE NUNCA SAI — o contrário do Canhão de Choque

O precedente exato é a paralisia: lá o **Canhão de Choque** (100%) vale **+24,7 pontos** num
Magneton, a maior alavanca individual daquela série. Aqui **não acontece**, e a razão é o moveset:
quem aprende o Soco Dinâmico é a linha do **Machop**, e ela também aprende o **GOLPE CRUZADO** —
mesmo poder 100, Lutador igual, **e crítico alto**. O `melhorAtaque` escolhe o Cruzado.

Medido, 1x1 contra um painel de 8 no Lv.50 (2.000 batalhas por célula):

| | leva | USA | sem | com | |
|---|---|---|---|---|---|
| **Golduck** | Confusão | **6/8** | 26,1% | **29,3%** | **+3,3** |
| **Venomoth** | Psicoraio, Confusão | 4/8 | 29,6% | 30,9% | +1,2 |
| Machop | **Soco Dinâmico (100%)** | **0/8** | 10,1% | 10,1% | **0,0** |
| Hypno | Confusão | 0/8 | 53,6% | 53,6% | 0,0 |
| Kangaskhan | Soco Tonto | 0/8 | 31,3% | 31,3% | 0,0 |

**⚠️ OS ZEROS SÃO EXATOS, e é isso que os explica: o rng nem é consumido** — o `tentarConfundir` sai
antes do `rng()` quando o golpe não está na tabela. O Hypno tem **Psíquico (90)** e o Kangaskhan tem
**Mega Soco (80)**: os dois preferem. É a mesma conclusão do Rolamento, dos golpes de prender e do
gelo — **o motor está certo em recusar**.

**Se um dia o Soco Dinâmico for pra valer, a régua não é a chance dele** (já é 100%): é tirar o
Golpe Cruzado do moveset da linha do Machop, que é mexer na base de golpes.

#### AS REGRAS DA GEN 3, uma a uma

- **2 a 5 turnos, uniforme** (`CONFUSAO_TURNOS_MIN/MAX`) — medido, média **3,50** em 20.000 sorteios.
- **50% por turno de se acertar** (`CHANCE_CONFUSAO_ACERTA`). **⚠️ Os 33% são da Gen 7**, e este jogo
  é Gen 3 — a mesma armadilha de geração que o Low Kick e o Tackle 35/95 já custaram.
- **O auto-golpe é um golpe SEM TIPO, FÍSICO, de poder 40, sem crítico e sem STAB** (`CONFUSAO_PODER`).
  **⚠️ O FÍSICO É NOVO**: a passiva usava a categoria do TIPO (a regra da Gen 1 deste motor), e o
  auto-golpe da Gen 3 é sempre físico. Medido: um **Alakazam** (Atk 50, Sp.Atk 135) se acerta com
  **16,1%** da barra; especial, ele se arrebentaria.
- **⚠️ NENHUM TIPO É IMUNE** — nem na Gen 3 nem em geração nenhuma. O que existe é a **imunidade do
  GOLPE** (o mesmo `golpeAfetaOAlvo` da paralisia): um Psicoraio não confunde um **Sombrio** que ele
  nem alcança, porque este motor sempre "conecta" (piso de 1 de dano e golpe teimoso).
- **NÃO ACUMULA**: quem já está confuso não é reconfundido — a marca seria reescrita e o contador
  voltaria ao começo a cada golpe.
- **⚠️ E ELA ATRAVESSA CONFRONTOS**, como a queimadura: o `_confuso` só é solto no `encerrarBatalha`.
  Sem soltar, um pokémon sairia da batalha confuso **pra sempre** — e como o campo começa com `_`,
  o save nem guardaria o motivo (ele voltaria são no F5 e confuso até lá). É o vazamento que o teto
  de HP da Fúria teve.

#### ⚠️ QUEM ESTÁ CONFUSO NÃO ATACA NAQUELA TROCA, e o contador anda na ENTRADA

O `confunde()` roda no começo do `doExchange`, ao lado da trava da paralisia, e ele decide **três**
coisas de uma vez: decrementa o contador, devolve `"saiu"` quando ele zera, e sorteia os 50%.

- **⚠️ ELE DECREMENTA ANTES DE SORTEAR**, e isso é o que faz *"2 a 5 turnos"* ser verdade: o turno
  conta tenha havido auto-golpe ou não. É a mesma regra do sono (*"o sono compra TURNOS, não
  golpes"*).
- **A guarda de quem não ataca é a mesma dos outros**: o `activeConfuso` entra ao lado da paralisia
  e do sono no `dmgToEnemy`/`dmgToActive`. Escrita em cada `tentar*`, o próximo estado nasceria sem.
- **⚠️ E O `tentarConfundir` PRECISA DA GUARDA DO GOLPE TER SAÍDO** (`!primeiroAtacou`) — é a lição
  de 18/09: o `lastMove` de quem não atacou fica da troca ANTERIOR, e sem ela um pokémon **dormindo**
  confundiria o adversário. **Os `tentar*` por lado foram de SEIS para SETE**, e a trava conta.

#### ⚠️ E ELA FUROU A FAIXA DE FOCO — o defeito que a trava genérica pegou

O auto-golpe é o **quinto** caminho que zera HP no `doExchange`, e ele precisou da Faixa como os
outros quatro. **Mas o caso duro não é o óbvio:** um pokémon que **já estava com 1 de HP** e se
acerta faz a Faixa vigiar e **SER GASTA**, e aí `antes - p.hp` dá **ZERO** — o `seAcertou` devolvia
`null` ali, o item saía do bolso **sem uma linha na tela**, e o golpe seguinte o matava sem Faixa.

**⚠️ ISSO FURA A PROMESSA DO ITEM** (*"quem carrega a Faixa nunca termina um confronto em 0 sem ela
ter disparado antes"*), que é exatamente o que aquela trava existe pra cobrar — e ela pegou. Medido:
ela o acha em **~1 rodada de 20** (são 6.000 batalhas por rodada, com `Math.random`), e o exemplo
trazia `confundiu` nas duas vezes.

Hoje a Faixa disparando **conta mesmo com dano zero**, e a **linha do auto-dano não sai** nesse caso
(dano zero não vira linha — a regra da casa). Quem explica o 1 na barra é a linha da FAIXA.
**⚠️ E A TRAVA NOVA É DETERMINÍSTICA**, porque a genérica é 1-em-20: ela monta o caso direto, e o
fixture precisou de **três** coisas — o alvo **já** confuso (o contador anda na entrada, então quem
acaba de ficar confuso só se acerta na troca seguinte), o alvo **mais rápido** (com 1 de HP qualquer
golpe o mata, e a Faixa sairia no golpe em vez do auto-dano) e o alvo com a Faixa e 1 de HP.
**A primeira versão dela passou por ACIDENTE** — a linha `faixa` que ela achava era do golpe comum.

#### NA TELA: três linhas, e o ícone segue o molde do GELO

| linha | quando | frase |
|---|---|---|
| `confundiu` | depois do golpe que causou | *💫 Snorlax ficou confuso com SOCO DINÂMICO!* |
| `confuso` | no lugar do golpe dele | *💫 Snorlax se acertou na própria confusão e perdeu 59 de HP* |
| `saiuConfusao` | quando ela passa | *💫 Snorlax não está mais confuso!* |

- **"COM" E NÃO "PELO"**, a decisão do congelamento: SOCO DINÂMICO é masculino e **CONFUSÃO é
  feminina** — a preposição neutra serve aos seis sem uma tabela de gênero pra uma frase só.
- **⚠️ A DO MEIO TRAZ O NÚMERO**, e é a única das três: a linha de um especial não ganha o *"e tirou
  −N de HP"* automático, e sem ele **a soma das linhas não fecharia com a barra**.
- **AS TRÊS DIVIDEM O 💫**, como as três do gelo dividem o ❄️: é o mesmo evento visto em três
  momentos, e ícones diferentes fariam procurar três mecânicas onde há uma.
- **⚠️ O `q` DO `confuso` É DE QUEM PERDE** (como a queimadura e o veneno), então **o passo da
  animação NÃO inverte o lado**. **⚠️ E A MARCA VELHA (`confusao`) ESTÁ NA FAMÍLIA OPOSTA** — o `q`
  dela é de quem CONFUNDIU. As duas convivem, e há trava cobrando que elas saiam em lados
  **contrários** pro mesmo `q`: é esse par que prova que não foram confundidas uma com a outra.
- **⚠️ O ÍCONE DO QUADRO SEGUE O GELO e não a queimadura, porque ela PASSA:** se a primeira marca do
  lado é `confundiu`, ele não estava confuso antes — o ícone acende no passo dela; se é `confuso` ou
  `saiuConfusao`, ele entrou no confronto **JÁ** confuso e vale desde o primeiro quadro. E ele
  **APAGA** no `saiuConfusao`, como o gelo faz no `degelou`.
- **⚠️ ELE FICA NOS ÍCONES FLUTUANTES da cena nova, não no `selosDoConfronto`** — e isso não é
  omissão: ali estão os **três que PASSAM** (sono, gelo, confusão) e o quadro tem os **três que NÃO
  passam** (queimadura, veneno, paralisia). Um selo de campo pro que passa mentiria: o campo do
  matchup é o estado no FIM do confronto, e quem saiu da confusão no meio sairia sem selo nenhum.

#### O ASTERISCO, E O 100% PASSOU A AFIRMAR

O aviso do cartão era *"Dá a passiva de confusão: 10% por confronto"* — uma frase que descrevia a
**espécie**. Hoje é `pct(GOLPES_QUE_CONFUNDEM[id])`, **derivado da tabela**: ela varia de 10% a 100%,
e um texto fixo mentiria em três dos seis.

**⚠️ E O `pct()` PASSOU A AFIRMAR NO 100% — a decisão já estava escrita e nunca tinha sido exercida.**
O asterisco do **ESTÁGIO** registra, desde 17/09, que *"100% de chance de" é uma condicional que não
existe; ali o certo é afirmar*, com a nota *"nenhum dos quatro de hoje é 100%"*. Só que o `pct()` é
**compartilhado pelos cinco status**, e o **CANHÃO DE CHOQUE dizia "100% de chance de causar
paralisia" desde 16/09**. Consertar no `pct` alinhou os dois de uma vez:

| | antes | hoje |
|---|---|---|
| Soco Dinâmico | 100% de chance de causar confusão | **Sempre causa confusão** |
| Canhão de Choque | 100% de chance de causar paralisia | **Sempre causa paralisia** |
| os outros | 10%, 20%, 30%, 50% | **iguais** |

#### A FICHA DA POKÉDEX PERDEU A LINHA, e os especiais foram de TREZE a DOZE

A ficha conta o que a espécie faz **SOZINHA**, e confundir deixou de ser isso — quem confunde é o
golpe. É a **mesma decisão** que tirou a drenagem daqui em 15/09/2026, e a entrada
`EXPLICACAO_DO_ESPECIAL.confusao` saiu junto (senão ela ficaria **órfã**, e há trava cobrando que
nenhuma explicação sobre sem dono).

**⚠️ E ISSO MUDOU O JOGO PRO MEW E PRO MEWTWO:** eles são imunes ao **BLOCO de especiais**
(`tentarGolpeEspecial`), não aos status por ataque — então o Mewtwo, que aprende Confusão, **passou
a poder confundir E a ser confundido**. É o mesmo que já valia pros outros quatro (o gelo, a
queimadura, o veneno e a paralisia nunca respeitaram aquela imunidade).

#### ⚠️ E ELA APAGOU A EXCEÇÃO DO TM03 — o caminho próprio virou o caminho normal

O **TM03 (Pulso de Água)** tinha um caminho próprio desde 17/09/2026, pedido assim: *"os TMs que dão
habilidade passiva ... o pokemon também deve ganhar a habilidade passiva enquanto estiver com esse
movimento"*. Ele existia porque a confusão era da **ESPÉCIE**, e quem ensinasse o golpe não entrava
na lista — então o `golpeQueConfunde` punha o golpe carregado **na frente** da espécie.

**Com o status por ataque isso É a mecânica**: carregar o golpe é o que confunde, e a função inteira
saiu. **⚠️ E A TRAVA DELE NÃO FOI APAGADA: ela virou a trava da regra NOVA** (o Blastoise com o TM03
confunde, sem ele não confunde, e a **espécie** não confunde mais). Sem isso alguém devolve a passiva
e o TM03 volta a precisar de exceção **sem ninguém ver** — e há um caso que pergunta pelo **ARQUIVO**
se a tabela `CONFUSAO` voltou, porque `const` não vira propriedade global do sandbox e um
`typeof S.CONFUSAO === 'undefined'` seria **VERDADE com a tabela de volta**.

**⚠️ E FOI ELA QUE PEGOU O REFACTOR PELA METADE: o `test-inventario` MORREU** com
`S.golpeQueConfunde is not a function` — a bateria acusou antes de qualquer print. É a mesma família
do *"uma trava que estoura é pior que uma que falha"*, do lado bom: **ela estourou no lugar certo**.

#### O PREÇO NA JORNADA: NADA

**55,39% (a passiva) contra 55,80% (o status por ataque)** — **+0,41 ponto, 0,4σ**, 8 blocos de 800
jornadas de cada lado (**6.400 de cada**, o MESMO bot contra duas cópias congeladas, desvio tirado de
ENTRE os blocos, **4 de 8 blocos** pra cada lado). Ruído absolutamente puro.

**⚠️ E ISSO SURPREENDE, porque a frequência caiu 8,8×.** A razão é a de sempre aqui: ela **cai dos
DOIS lados** — as 82 espécies confusoras apareciam em time de líder tanto quanto no do jogador — e o
auto-dano é pequeno (o espelho sem tipo).

**A impressão do motor MUDA, e tem que mudar** (`MOTOR 2d6a83f24cf1 → e6cd16d15e0f`): a passiva lia
o rng dentro do `tentarGolpeEspecial`, então tirá-la desloca a semente de toda batalha que tem uma
das 82. **E os dois motores continuam concordando: 0 divergências em 300 batalhas** com a mesma
semente, mais **120 com confusão garantida** no painel próprio.

- **Se um dia incomodar**, as réguas são as **chances por golpe** (`GOLPES_QUE_CONFUNDEM`, que são
  por GOLPE), a **duração** (2 a 5) e a **chance de se acertar** (50% — a mais forte das três, e
  mexer nela é sair da Gen 3).
- **⚠️ E ELA NÃO ALCANÇA as ligas nem o online**, pela mesma razão dos outros quatro: lá o time vem
  de um CÓDIGO e ninguém tem golpe escolhido, então o motor cai no de tipo e não há id pra consultar
  na tabela. A única porta é o **METRÔNOMO**.

**Medido a 320px, no navegador:** as quatro linhas em **243×58px** (com o selo em cada), os seis
cartões em **66px**, e o documento em **305 de 320** — sem rolagem lateral.

`tools/test-especiais.js` tranca ~60 pontas: os seis golpes com as chances oficiais, as quatro
constantes iguais nos dois motores, a passiva **não existindo mais**, as duas guardas (caído e já
confuso), **nenhum tipo imune** (cinco espécies nomeadas) e a imunidade do GOLPE, as chances medidas
com um rng contínuo, as **duas saídas antecipadas do rng**, a duração, o auto-dano (a fração da
barra, **o FÍSICO por comparação de perfis opostos**, o `lastMove` intocado), as três linhas com o
`q` de cada uma, **quem se acertou não atacando**, a confusão passando e a marca solta, as três
frases palavra por palavra, os três selos, o passo **não invertendo o lado** (com a marca velha
invertendo), o ícone só a partir do passo (e a **herdada** desde o quadro 0, e o apagar), o asterisco
nos seis com o 100% **afirmando**, a ficha e a explicação saindo juntas, **a Faixa no auto-golpe**, e
**120 batalhas com confusão garantida** batendo golpe a golpe nos dois motores.
**Conferido que os 22 defeitos religados acusam** (1 a 22 falhas cada).
E `tools/test-inventario.js` tranca o outro lado, no bloco do TM03: o Blastoise com o golpe
confundindo e sem ele não, a marca no ALVO com 2 a 5 turnos (as constantes lidas do **FONTE**), a
**espécie não confundindo mais**, a tabela `CONFUSAO` fora dos dois motores e os seis valendo.
**Conferido que os 6 defeitos religados acusam** (1 a 5 falhas cada).

#### ⚠️ E ELA DESENTERROU UM DEFEITO ANTIGO DA SUAVIZAÇÃO — achado e NÃO mexido

A trava da **banda da fórmula** passou a acusar 4 de 3.677 lados. Investigado, **não era regressão**:
o deslocamento de semente fez o painel dela sortear confrontos que ele não sorteava, e **o defeito
já estava no HEAD** — medido lá com 12.000 iterações, **21 de 25.174 lados**, com o pior em **9,63×**
(o painel de 1.700 da trava passava por SORTE).

**SÃO DUAS CAUSAS, e as duas são da suavização:**

1. **o golpe APARADO pelo teto do alvo cheio.** Medido no caso que acusou (Shuckle Lv.50 × Rapidash
   Lv.50, mesmo nível ⇒ o teto MÍNIMO de 70%): o Rolamento `rl16` tirou **241 de 345** —
   `345 − round(345×0,30)`, o teto exato — e o `rl1` seguinte tirou 28. Dividido pela escala isso dá
   15,1 contra 28. **Nada está errado**: o golpe grande foi cortado por uma regra que a tela
   EXPLICA. A trava passou a **isentá-lo**, como já isenta o golpe que MATA (o outro caso de aparo);
2. **a SOBRA do arredondamento vai TODA pro último item do grupo.** O último não é uma fatia, é o
   **RESTO**, e o desvio dele é a soma dos desvios dos outros: ~`√(n−1) × JITTER`. Num par isso é
   8%; num grupo de nove, **23%**. Medido num `slam` de oito tapas: o MOTOR produziu
   `23,23,23,27,23,23,23,27` (razão **1,174, DENTRO da banda**) e a tela mostrou
   `22,24,25,23,25,22,23,29` (**1,318**). A tolerância da trava, calibrada num PAR, passou a ser
   **derivada do tamanho do grupo**.

**⚠️ O QUE SOBRA É UM DEFEITO DE APRESENTAÇÃO REAL E NÃO MEXIDO:** o **Rolamento pós-reset**. Quando
a sequência reseta (o `% ROLAMENTO_USOS`), o peso do golpe novo é 1 contra 16 do anterior, e a
suavização lhe dá **1/17 do total** — o jogador vê um Rolamento de **1 de dano**. Medido: 12 de
25.169 lados no HEAD com a tolerância derivada, o pior em 9,63×. **Consertá-lo é mexer no
`fatiaDoGolpe`, o código de apresentação mais sensível do projeto**, e ele não foi pedido — fica
escrito. A saída, se um dia for pra valer, é **distribuir a sobra** em vez de jogá-la no último.

#### ⚠️ E O FLAKE DO `Charmeleon × Mankey` FOI PROVADO ANTERIOR — pelo método semeado

A trava *"NINGUÉM ataca com a barra em zero"* falhou, no par que este arquivo já nomeia desde 17/09.
**Mas eu mexi no código que ela lê** (o diário, o `buildAnimatedHitSequence`, o `fraseDoEspecial`),
então a terceira perna da prova (*"ver se o diff encosta no que a trava lê"*) **não isentava**.

E o HEAD deu **0 em 4 rodadas** — o que parecia regressão. A resposta veio do método que este
arquivo prescreve: **o bloco da trava foi extraído LITERAL** (não reimplementado — isso já traiu
duas vezes nesta sessão) e rodado com o `Math.random` **semeado** nos dois builds:

| | falhas em 8 sementes |
|---|---|
| HEAD | **2** (sementes 11 e 66) |
| com a confusão nova | **2** (sementes 66 e 77) |

**Mesmo patamar, e a semente 66 falha nos dois.** Sem semear, comparar um teste flaky entre dois
builds não é medição — e 4 rodadas de 0 num flake de ~25% é 32% de chance.

#### ⚠️ E QUATRO TRAVAS MINHAS NASCERAM MUDAS — as quatro pela mesma família

Só a conferência de acusação as pegou, e cada uma é uma armadilha que este arquivo já registra:

| trava | por que ela não media nada |
|---|---|
| *"o auto-dano é FÍSICO"* | era um **limiar frouxo** (`< 30% da barra`) e o especial **caberia nele**. Virou comparativa: a ordem entre Machamp e Alakazam **INVERTE** se for especial |
| *"o passo não inverte o lado"* | **não existia** — eu tinha a decisão no comentário e nenhuma asserção |
| *"o ícone só a partir do passo"* | idem, e a primeira versão procurava a chave `confusao` quando ela é **`confusion` em inglês** — devolvia sempre false |
| *"a Faixa no auto-golpe"* | passava por **ACIDENTE**: a linha `faixa` que ela achava era do golpe comum contra um alvo de 1 de HP |

**⚠️ E TRÊS CHAMADAS DE `fraseDoEspecial` PASSAVAM O `op` NO LUGAR DO NOME.** A assinatura é
`(g, quem, alvo, op)` — quatro argumentos —, e `(g, {})` põe o objeto no `quem`. As três frases novas
passavam **por acidente** (elas tiram o nome do campo `g.g` do registro, não do parâmetro); a da
marca **VELHA** usa os parâmetros, e ali isso saía como *"[object Object] deixou undefined confuso"*
— **com a trava VERDE**.

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

### OS ESTÁGIOS DE ATRIBUTO (17/09/2026) — o primeiro sistema de estágios do motor

Pedidos assim: *"Iron Tail: 30% de diminuir a Defesa do alvo em 1 estágio, Psychic: 10% de diminuir
a Defesa Especial, Shadow Ball: 20% ..., Rock Tomb: Diminui a Velocidade do alvo ao acertar, Steel
Wing: 10% de aumentar a Defesa do próprio usuário"*.

**⚠️ ATÉ AQUI O MOTOR NÃO TINHA ESTÁGIO NENHUM.** O que ele tinha eram **multiplicadores fixos**: a
Dança das Espadas é ×1,5 de Ataque e a Dança da Pluma ×0,5 — que por acaso são o +1 e o −1 da tabela
oficial, mas **não somam e não acumulam**. Estágio é outra coisa: ele acumula, tem teto, e a mesma
escada serve a qualquer atributo.

**A TABELA É A DA GEN 3, e ela NÃO é simétrica:**

| | −6 | −2 | **−1** | 0 | **+1** | +2 | +6 |
|---|---|---|---|---|---|---|---|
| | ×0,25 | ×0,5 | **×0,667** | ×1 | **×1,5** | ×2 | ×4 |

`+n` vale `(2+n)/2` e `−n` vale `2/(2+n)`. **Escrever "−1 = metade" é o erro clássico aqui** —
baixar dói MENOS que subir rende, e é assim desde a Gen 1. Quem vale ×0,5 é o **−2**.

**⚠️ O TETO DE ±6 É ALCANÇÁVEL DE VERDADE**, ao contrário dos estágios de crítico (que ficaram de
fora do jogo justamente por serem letra morta): a Cauda de Ferro usada seis vezes no mesmo confronto
chega no −6. Por isso a escada inteira existe.

| golpe | chance | efeito | quem leva no Lv.70 |
|---|---|---|---|
| **Cauda de Ferro** | 30% | Defesa do ALVO −1 | 3 (Onix, Forretress, Steelix) |
| **Psíquico** | 10% | Defesa Especial do ALVO −1 | **20** |
| **Bola Sombria** | 20% | Defesa Especial do ALVO −1 | 3 (a linha do Gastly) |
| **Asa de Aço** | 10% | Defesa de **QUEM USA** +1 | 1 (Skarmory) |

**⚠️ O ASA DE AÇO É O ÚNICO QUE CAI EM QUEM USA** (`noProprio`), e é a armadilha da feature: lido
como os outros quatro, ele **baixaria a Defesa de quem levou o golpe** em vez de subir a de quem
bateu — e o defeito não apareceria como erro, apareceria como o golpe sendo bom demais. Há trava
nomeando isso, e ela acusa.

**⚠️ ELES DURAM A BATALHA, não o confronto** — o contrário das duas Danças. A diferença não é gosto:
no jogo original o estágio zera quando o pokémon **sai de campo**, e aqui quem vence um confronto
CONTINUA em campo pro próximo (é por isso que o HP dele carrega). Quem sai de campo é quem cai… **e
quem é soprado pelo Remoinho** — e lá eles zeram. Sem isso o sopro viraria um jeito de **guardar** o
debuff em vez de tirá-lo de campo.

**O MULTIPLICADOR ENTRA POR ÚLTIMO** na cadeia, depois de shiny, terreno, especialidade, item e
fúria: *"metade da Defesa"* é metade do que o pokémon TEM na hora. É a mesma regra do corte da
queimadura e das duas Danças — e há trava medindo isso **num shiny**, que é onde entrar antes daria
outro número.

#### ⚠️ E ELE QUEBROU A PREMISSA DA SUAVIZAÇÃO — o mesmo caso do Rolamento

A suavização de 12/09 existe porque *"o mesmo golpe, do mesmo pokémon, contra o mesmo alvo, só
difere pelo sorteio de 0,85 a 1,00"* (1,176×). **Com estágio isso deixa de valer**: quando a Cauda
de Ferro baixa a Defesa, o golpe seguinte dói mais **de verdade** — medido, um Onix tirando **53, 78
e 106** do mesmo Furret (razão 2,0×).

A trava da banda pegou isso na primeira rodada (*Hypno × Forretress: 78 e 62*).

**O CONSERTO FOI ISENTAR, e não pesar como o Rolamento fez** — e a escolha foi medida:

- a suavização **só toca 0,68% dos confrontos hoje** (o revide moribundo, que era a razão dela
  existir, acabou em 15/09);
- confrontos com mudança de estágio são 1,02%, e ela mexia em **5 deles**;
- ou seja, isentar custa **25% do que ela ainda faz**.

E isentar é o **certo**, não só o barato: é o mesmo argumento do golpe que mata — *ele se explica
sozinho*. Aqui **há uma linha na tela dizendo que a Defesa caiu**; a suavização existe pra esconder
um corte **mascarado**, e aqui não há nada mascarado. Pesar exigiria carregar o multiplicador do
defensor por linha no caminho do DANO, que é o código mais sensível do projeto.

**⚠️ A ISENÇÃO É DO CONFRONTO, não do lado**: o estágio mexe na Defesa de um e no DANO do outro,
então uma queda marcada no lado do inimigo é o que explica o golpe do jogador. As duas travas que
mediam razão entre linhas aprenderam a mesma isenção.

#### O QUE ELE VALE, MEDIDO

1x1 contra um painel de 8, 250 batalhas por célula, ligando/desligando **um** efeito por vez:

| | sem | com | |
|---|---|---|---|
| Onix (Cauda de Ferro) | 4,3% | 7,1% | **+2,8** |
| Alakazam (Psíquico) | 58,9% | 60,8% | +1,9 |
| Skarmory (Asa de Aço) | 48,0% | 49,4% | +1,4 |
| Mewtwo (Psíquico) | 86,3% | 87,7% | +1,4 |
| Steelix (Cauda de Ferro) | 51,0% | 52,2% | +1,3 |
| **Gengar (Bola Sombria)** | 30,6% | 30,5% | **−0,1** |

**⚠️ O ZERO DO GENGAR TEM CAUSA, e não é a mecânica:** o motor escolhe pelo dano, e o Gengar tem
golpe melhor que a Bola Sombria (80) contra quase todo o painel — ele quase não a usa. É a mesma
conclusão do Rolamento e dos golpes de prender: **o motor está certo em recusar**.

**NA BATALHA: sai em 1,98% dos confrontos** e em 6,9% das batalhas 3x3. As linhas dela são 0,59% do
log.

**O PREÇO NA JORNADA: NADA — 58,48% contra 57,92%, −0,56 ponto, 0,6σ** (6 blocos de 800 jornadas de
cada lado, **4.800 de cada**, desvio tirado de ENTRE os blocos, **3 de 6 blocos** pra cada lado).
Ruído puro, e pelos dois motivos de sempre: são 26 espécies em 250 e elas caem dos DOIS lados -- o
Alakazam da Sabrina, o Gengar da Agatha, o Steelix da Jasmine.

#### ⚠️ O ROCK TOMB FICOU DE FORA, E NÃO É ESQUECIMENTO: ELE NÃO EXISTE NO JOGO

Conferido em três lugares: ele **não está** no dicionário de golpes do `data/golpes.json`, **ninguém
o aprende por nível** nas 250, e ele **não está** na tabela `GOLPES`. A razão é a de sempre: ele é
**TM39 na Gen 3**, e a base só cadastra aprendizado por NÍVEL — o mesmo motivo que deixou o Pó
Venenoso, o Tóxico e a Onda de Choque fora dos outros status.

Cadastrar o efeito dele hoje seria **letra morta** — a mesma decisão que manteve os estágios 2 a 4
do crítico fora do jogo, e que o CLAUDE.md registra em três lugares.

**As duas saídas, se ele for pra valer:**

1. **Dar dono a ele** — entra no `A_MAO` do `tools/gerar-tabelas-golpes.js` (como o `cut`, o `surf`
   e o `fly`) e ganha espécies à mão. É inventar conteúdo de jogo: decide quem aprende o quê.
2. **Esperar as TMs** — o dia em que o jogo tiver TMs, ele nasce com dono de graça. O `GOLPES_QUE_MUDAM_ESTAGIO`
   já aceita `chance: 1` (o cartão do golpe afirma em vez de dizer "100% de chance de", que é uma
   condicional que não existe).

`tools/test-especiais.js` tranca 33 pontas: a escada da Gen 3 inteira (com o **−1 = ×0,667** cobrado
por nome), o teto de ±6 e o `false` quando ele não move, os quatro golpes com chance e alvo, que os
quatro **existem** na tabela e são **levados de verdade**, o corte nos três atributos, o corte
**num shiny** (provando que ele entra por último), as três chances medidas com **um rng contínuo**,
as duas saídas antecipadas do rng, **o Asa de Aço subindo a Defesa de quem usa e não encostando no
alvo**, a linha no log sem `−0 de HP`, o `q` da linha sendo o de quem teve o atributo mexido, e o
asterisco dizendo **em quem** o efeito cai.

### A PARALISIA: O STATUS QUE MEXE EM VELOCIDADE (16/09/2026)

Pedida assim: *"implemente o status Paralysis, que alguns ataques tem uma chance de deixar o
oponente assim (Como Thunder Punch, Thunderbolt, etc..), no mesmo esquema que fizemos com o queimar
e o poison ... Pode seguir a mesma mecanica que o site bulbapedia informa para a Geração 3"*.

É a **quarta** mecânica POR ATAQUE, e a única das quatro que não mexe em dano:

| | |
|---|---|
| a velocidade cai pra **25%** (`PARALISIA_VELOCIDADE`) | a regra da Gen 1 à 6 — só na Gen 7 ela virou 50% |
| **25%** de chance de perder o turno (`CHANCE_PARALISIA_TRAVA`) | |
| dura até o fim da **BATALHA** | como a queimadura e o veneno; não passa sozinha |

**SÃO DEZ GOLPES** (`GOLPES_QUE_PARALISAM`), tirados do dado (Showdown, mod da Gen 3) com as chances
oficiais — o mesmo caminho das outras três listas. Elas variam de **10% a 100%**:

| golpe | poder | chance | espécies que levam |
|---|---|---|---|
| Golpe de Corpo | 85 | 30% | **12** |
| Faísca | 65 | 30% | 7 |
| Trovão | 120 | 30% | 7 |
| Choque do Trovão | 40 | 10% | 7 |
| **Canhão de Choque** | 100 | **100%** | 4 |
| Raio | 95 | 10% | 4 |
| Salto | 85 | 30% | 3 |
| Soco Trovão | 75 | 10% | 3 |
| Lambida | 20 | 30% | — |
| Sopro do Dragão | 60 | 30% | — |

**⚠️ SÃO 34 DAS 250 QUE LEVAM UM DELES no Lv.70 — a lista mais larga das quatro** (o gelo tem 10, a
queimadura 22, o veneno 26), e a causa é o **Golpe de Corpo**: ele é Normal, poder 85, e meio
bestiário o aprende.

**⚠️ FICARAM DE FORA: Onda de Choque, Pó do Estupor e Encarada** — golpes de STATUS (poder 0), e a
base só cadastra dano. A mesma regra que tirou o Pó Venenoso do veneno e o Will-O-Wisp da queimadura.

#### ⚠️ NA GEN 3 NENHUM TIPO É IMUNE — e é aqui que a intuição mais erra

O tipo **ELÉTRICO só ficou imune à paralisia na GEN 6**. Na Gen 3 ele apanha como todo mundo — e como
seis dos dez golpes são Elétricos e a maioria dos donos também é, **o caso mais comum é justamente um
Elétrico paralisando outro**.

Isso é o **oposto** do que o gelo precisou: lá a imunidade do Gelo É da geração, e sem ela dois
pokémon de Gelo se congelariam o tempo todo. Aqui, pôr a imunidade seria sair da geração que o resto
do motor segue. Há trava nomeando cinco Elétricos, pra ninguém "consertar" isso pra parecer com o
jogo moderno.

**⚠️ O QUE EXISTE É A IMUNIDADE DO GOLPE, e ela precisou de código próprio** (`golpeAfetaOAlvo`):
Terra não toma Elétrico, e **golpe que não afeta não paralisa**. Sem essa guarda um Raio paralisaria
um Golem que ele nem alcança — porque este motor **sempre "conecta"** (piso de 1 de dano, golpe
teimoso).
É a **única das quatro mecânicas que precisou disso**: nenhum tipo é imune a Fogo ou a Gelo, e no
veneno o Aço já é barrado pela imunidade ao STATUS.

#### O QUE ELA CUSTA A QUEM APANHA — e a assimetria É a mecânica

1x1 contra um painel de 8, Lv.55, paralisia forçada, 250 batalhas por célula:

| paralisado | vitória cai | |
|---|---|---|
| **Alakazam** | 61,9% → **12,5%** | **−49,4** |
| **Starmie** | 65,0% → 28,1% | −36,9 |
| **Jolteon** | 57,6% → 22,6% | −35,0 |
| Snorlax (lento) | 60,1% → 41,1% | −19,0 |
| **Golem (lento)** | 73,0% → 60,8% | **−12,2** |

**A distância entre o Alakazam (−49,4) e o Golem (−12,2) é o corte de velocidade**: quem dependia de
bater primeiro perde tudo, quem já era lento quase não sente. É o mesmo desenho da queimadura (que
separa físico de especial), com outro eixo.

**MEDIDO NA BATALHA: sai em 3,20% dos confrontos** e em **12,0% das batalhas 3x3**, com 45 turnos
perdidos em 3.778 confrontos. As linhas dela são 1,40% do log.

**O PREÇO NA JORNADA: NADA — 58,81% contra 57,97%, −0,84 ponto, 0,7σ** (8 blocos de 800 jornadas de
cada lado, **6.400 de cada**, desvio tirado de ENTRE os blocos, **4 de 8 blocos** pra cada lado).
Ruído puro, e pela razão de sempre: ela cai dos DOIS lados — o Snorlax de rota, o Magneton da
Jasmine, o Raichu do Surge.

#### ⚠️ O CANHÃO DE CHOQUE É 100%, E AQUI ISSO PESA MUITO MAIS QUE NO ORIGINAL

No jogo real ele tem **50% de precisão**, e é esse o preço dele. **Este motor não tem errar** — todo
golpe acerta —, então ele paralisa em **todo ataque**. Medido (1x1 contra um painel de 8, Lv.70):

| | sem o golpe | com | |
|---|---|---|---|
| **Magneton** | 32,5% | **57,3%** | **+24,7** |
| Magnemite | 2,0% | 14,8% | +12,8 |
| Porygon2 | 25,6% | 34,6% | +9,1 |
| Porygon | 2,9% | 9,7% | +6,8 |

**+24,7 pontos num golpe só** é a maior alavanca individual desta série. Ele ficou em 100% porque é o
que a Gen 3 diz e o pedido foi seguir a Gen 3 — mas **se incomodar, a régua é uma linha**: baixar o
`zapcannon` no `GOLPES_QUE_PARALISAM` pra 0.50 modela a precisão que este motor não tem.
Quem leva: Magnemite, Magneton, Porygon, Porygon2 e Forretress (este só até o Lv.55).

#### AS DUAS FRASES, E A TERCEIRA QUE NÃO TEM QUANDO SAIR

| linha | quando | frase |
|---|---|---|
| `paralisou` | depois do golpe que causou | *⚡ Snorlax ficou paralisado com CANHÃO DE CHOQUE!* |
| `paralisado` | no lugar do golpe dele | *⚡ Snorlax está paralisado e não consegue atacar* |

**⚠️ E A TERCEIRA — "quando passou a paralisação" — NÃO FOI IMPLEMENTADA, e não é esquecimento: ela
não tem quando acontecer na Gen 3.** Lá a paralisia **não passa sozinha** (só item ou cura a tira),
e é exatamente isso que o pedido também pede ao dizer *"no mesmo esquema que fizemos com o queimar e
o poison"* — os dois duram até o fim da batalha.
Quem passa é o **congelamento**, que sorteia degelo a 25% por turno; a paralisia é o oposto dele.
**Se for pra ter mesmo**, é uma constante nova no molde do `CHANCE_DESCONGELAR` mais uma linha
`despalarisou` — e aí ela deixa de ser Gen 3.

- **"COM" E NÃO "PELO"**, a mesma decisão do congelamento: RAIO e TROVÃO são masculinos, mas FAÍSCA e
  LAMBIDA são femininas, e a preposição neutra serve aos dez sem uma tabela de gênero pra uma frase só.
- **O SELO É ⚡ nos dois momentos**, como o ❄️ serve aos três do gelo: é o mesmo evento visto em horas
  diferentes, e ícones diferentes fariam procurar duas mecânicas onde há uma.
- **⚠️ E ELE SÓ APARECE A PARTIR DO PASSO EM QUE A PARALISIA PEGA** (`statusAteAqui`), como o 🔥 e o
  🟣 — ela acontece NO MEIO do confronto. Paralisia **herdada** (sem marca no diário) vale desde o
  primeiro quadro: o pokémon entra já paralisado.
- **O asterisco entra no cartão do golpe** nos dez, com a chance **derivada da tabela** — ela varia de
  10% a 100%, então um texto fixo mentiria em oito dos dez.

#### ⚠️ E ELA DERRUBOU UMA TRAVA QUE MEDIA UMA SUPOSIÇÃO VELHA

A trava do despertar cobrava que *"quem dorme SEMPRE apanha antes de acordar"* — e isso era verdade
só enquanto nada podia travar o **ATACANTE**. A paralisia é a primeira coisa que trava: o dono do
sono perde o turno, ninguém bate, e o adormecido acorda mesmo assim.

**E ele acordar ali está certo: o sono compra TURNOS, não golpes** — o contador anda na entrada da
troca, tenha havido golpe ou não. A trava passou a tolerar o caso, e continua cobrando o que ela
existe pra cobrar (ele não acorda antes da vez dele). É a mesma lição da trava que caiu quando o sono
virou de 1 a 3 trocas: **ela media a DURAÇÃO e não a regra**.

#### ⚠️ E O SERVIDOR NÃO SOLTA OS OUTROS TRÊS STATUS — achado no caminho, e não mexido

O `encerrarBatalha` do CLIENTE solta `_congelado`, `_queimado`, `_envenenado` e agora `_paralisado`;
o do SERVIDOR **nunca soltou nenhum dos três**. Hoje isso é inofensivo porque as instâncias do
servidor nascem a cada batalha (o `resolverTimeDosSaves` e o `battleHydrate` montam do zero), ao
contrário das do cliente, que vão pro SAVE. **Só o `_paralisado` foi acrescentado lá** — mexer nos
outros três seria mudar comportamento que ninguém pediu. Fica registrado pro dia em que algum caminho
do servidor passar a reusar instância: ali os três vazam junto.

`tools/test-especiais.js` tranca 44 pontas: os dez golpes e as chances oficiais, que eles existem na
tabela e têm nome PT, que 30+ espécies os LEVAM (a lição da Fúria), os 25% de velocidade (inclusive
num shiny, provando que o corte entra por último), os 25% de trava, **os cinco Elétricos podendo ser
paralisados**, os cinco Terra não sendo paralisados por Raio nem com o dado viciado, as chances
medidas com **um rng contínuo** (com o caso p=1 cobrado por igualdade exata, porque ali o σ é zero),
as duas saídas antecipadas do rng, as duas frases palavra por palavra, o log sem `−0 de HP`, o selo
só a partir do passo, a paralisia herdada, o asterisco nos dez com a chance derivada, e a marca
solta em 2.400 pokémon.

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

### A FORMA EVOLUÍDA HERDA O APRENDIZADO DA LINHA (24/09/2026)

Pedida assim: *"o Cloyster originalmente tem apenas 3 ataques se voce olhar na pokedex, mas ele vem
do shellder, então o cloyster tem que herdar todos os ataques que o shelder tambem tinha, sem
repetir moves"*.

**⚠️ ISSO REVERTE A DECISÃO DE 09/09/2026, que está na seção acima:** *"os 30 que sobram são os que
a forma nova realmente não sabe — que é a regra do jogo original e fica como está"*. As duas travas
que mediam AQUELA regra (o Raichu sem Trovão e a Starmie sem Raio de Bolhas) **viraram a trava da
regra nova** — elas não foram apagadas.

**⚠️ E O CASO DO RELATO É O QUE JUSTIFICA A REVERSÃO: o Raio Congelante era INALCANÇÁVEL pra a linha
inteira.** O Shellder o aprende no **Lv.49** e evolui no **40** — então nem ele (que já virou
Cloyster) nem o Cloyster (que não o ensina) chegavam nele. Não é "um golpe que a forma nova não
sabe": é um golpe que **ninguém daquela linha consegue ter**, e que a ficha mostra como se existisse.

| Cloyster | |
|---|---|
| golpes próprios | **3** |
| **agora** | **7**, sem repetir |
| e ele ganha | `icebeam` (95), `dive`, `clamp`, `tackle` |

#### ⚠️ A REGRA, e as três coisas que ela não é

- **SOBE A LINHA INTEIRA, não só o pai.** O Venusaur herda do Ivysaur **E** do Bulbasaur. Com um
  passo só, a terceira forma de toda linha de três ficaria sem o que a primeira ensina — e o teste
  tem caso de 3 gerações justamente porque um Venusaur passa num teste de 2 passos por acidente.
- **⚠️ A BIFURCAÇÃO TAMBÉM É EVOLUÇÃO**, e ela mora noutra tabela: o mapa de pais lê o `EVOLUTIONS`
  **e** o `EVOLUTION_CHOICES`. Sem a segunda metade ficariam de fora justamente **Politoed,
  Bellossom, Slowking e os três do Tyrogue** — e o Poliwrath herdaria enquanto o Politoed não,
  na mesma tela.
- **⚠️ NO EMPATE VALE O NÍVEL DA FORMA ATUAL.** O Raio Aurora é Lv.17 no Shellder e **Lv.1** no
  Cloyster; o que vale é o dela — ela está mais perto, e é a tabela dela que a ficha mostra.
- **⚠️ E ELA CLONA OS PARES, nunca devolve a tabela.** Um `sort` num leitor reordenaria o
  `APRENDIZADO` **pra o jogo inteiro** — e o defeito não apareceria como erro: apareceria como a
  ordem dos golpes mudando de uma tela pra outra.

#### ⚠️ ELA É LAZY, E ISSO FOI A SEXTA VEZ DESSA ARMADILHA

No **SERVIDOR** o `EVOLUTION_CHOICES` é declarado **DEPOIS** do `ataquesDisponiveis`, e uma `const`
computada no topo é zona morta temporal: **o servidor inteiro morre no carregamento**. O mapa de
pais é montado na primeira chamada (`let _paiDaEspecie = null`), e a lista de cada espécie é
memoizada.

#### POR ONDE ISSO CHEGA NO JOGO — cinco leitores, uma função

`aprendizadoDaEspecie` é a porta única, e os cinco leem ela: a **ESCOLHA** do jogador
(`ataquesDisponiveis`), o **nível** que a tela mostra (`nivelDoAtaque`), a **fila** de aprendizado
por nível, a **ficha** da Pokédex e — por tabela — o `ataquesPadrao` dos NPCs.

**⚠️ E A LIGA ACEITA DE GRAÇA, e o que garante isso é de ONDE o `golpesValidos` tira a lista:** ele
usa o `ataquesDisponiveis`. Com uma lista própria, o golpe herdado seria **RECUSADO EM SILÊNCIO** na
liga e no online — o defeito que o `fly` custou em 16/09.

#### O QUE ISSO MUDA, MEDIDO

| | |
|---|---|
| espécies COM ancestral | **117** |
| **ganham golpe** | **35** (69 golpes no total) |
| **ganham um golpe MAIS FORTE** | **12** |
| o `ataquesPadrao` muda em | **9,6%** das combinações espécie × nível (456 de 4.750) |
| e o poder médio do melhor golpe | **74,1 → 75,6** |

Os que mais ganham: **Wigglytuff 15 → 120**, **Clefable 15 → 100**, Politoed 40 → 120,
Ninetales 40 → 95, Poliwrath 80 → 120, Starmie 90 → 120, **Cloyster 65 → 95**, Raichu 95 → 120.

**⚠️ E 117 COMBINAÇÕES PERDEM UM MULTI-TAPA**, o que é o outro lado da mesma moeda: com um golpe
mais forte disponível, o `ataquesPadrao` para de escolher o de vários tapas. Não é regressão — é o
motor escolhendo pelo dano, como sempre.

**O PREÇO NA JORNADA: NADA. 56,16% contra 55,72% de conclusão** — **−0,44 ponto, 0,4σ** (8 blocos de
800 jornadas de cada lado, **6.400 de cada**, o MESMO bot contra duas cópias congeladas, desvio
tirado de ENTRE os blocos, **3 de 8 blocos** pro lado da herança). Ruído puro, e a direção é até
negativa.

**⚠️ E ISSO FAZ SENTIDO PORQUE ELA CAI DOS DOIS LADOS:** o `equiparNpc` dá ao líder, ao rival e ao
treinador da Torre o moveset da espécie **pelo `ataquesDisponiveis`** — então o Onix do Brock também
herda. É a mesma conclusão da drenagem, do sono e da Fúria do Dragão.

#### ⚠️ A IMPRESSÃO DO MOTOR NÃO VÊ MUDANÇA DE TABELA DE GOLPES — a lição de instrumento

A impressão de sempre (`impressao.js`, 900 batalhas semeadas) veio **IDÊNTICA**, e eu quase a
reportei como prova de que o motor não mudou. Ela não vê: o painel dela é
`S.createInstance(id, lv)` e **nunca equipa ninguém** — sem `ataques`, o motor cai no de tipo e a
tabela de aprendizado não é lida uma vez sequer.

Com um painel que dá moveset (`p.ataques = S.ataquesPadrao(p)`), ela **MUDA** — e tem que mudar:

| | MOTOR / DIARIO |
|---|---|
| sem herança | `8f10c9218239 / d3f7bb9a1003` |
| **com herança** | **`3d20f17fc6d3 / 84a63092b7cc`** |

E o instrumento foi conferido nas duas pontas: o **mesmo build duas vezes** dá o mesmo hash, e com o
`CRIT_BASE` mexido ele muda. **Um hash imóvel só prova alguma coisa quando o painel exercita o
caminho que a mudança toca** — e pra mudança de golpe o painel tem que equipar.

`tools/test-ataques.js` tranca: o caso do relato carta por carta, o `icebeam` chegando **com o nível
do Shellder (49) e não inventado**, o empate valendo a forma atual, a linha inteira (3 gerações), a
bifurcação nos dois lados do Gloom e do Poliwhirl, **quem não tem ancestral saindo IDÊNTICO à tabela**
(sem esse caso, uma herança que devolvesse lixo pra todo mundo passaria nos outros), a tabela não
sendo mutada, os cinco leitores, a liga lendo o `ataquesDisponiveis`, as duas cópias byte a byte
(a herança, o mapa de pais **e** o `ataquesDisponiveis`) e o mapa sendo LAZY.
**Conferido que os 11 defeitos religados acusam.**

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
- **⚠️ E DESDE 24/09/2026 SÃO QUATRO: CHOVE NO CENÁRIO** — ver **A CHUVA CAINDO NA CENA**, na seção
  da cena nova de batalha. Ela sai do MESMO `m.chuva` que o emoji e o selo, então ela responde a
  pergunta dos confrontos 2 e 3 **sem uma palavra** — e é a única das quatro que se vê sem ler.
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
habilidade na partida"*. São **doze** hoje: autodestruição, sono, anulação, Metrônomo, cura (o
Recuperar E o Sino Curativo — a caixa é indexada pelo EFEITO, ver abaixo), Fúria, Fúria do Dragão,
**Sketch** — este acrescentado à ficha no mesmo dia, também a pedido, e SÓ pra aparecer: a mecânica
dele não foi tocada —, a **Dança da Chuva**, que chegou logo depois e é a única POR BATALHA, o
**Remoinho** (12/09/2026), que é o único que muda QUEM está no confronto, e as **duas Danças** de
ataque (12/09/2026).
**⚠️ A DRENAGEM E A CONFUSÃO SAÍRAM DA LISTA** — a primeira em 15/09/2026 e a segunda em
24/09/2026, as duas porque viraram efeito de **GOLPE** e a ficha só conta o que a espécie faz
SOZINHA. As entradas do `EXPLICACAO_DO_ESPECIAL` saíram junto, senão elas ficariam **órfãs** — e há
trava cobrando que os dois lados batam: hoje são **12 efeitos na ficha e 12 explicações**, sem uma
sobrando de cada lado.

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
- **⚠️ O DOCE RARO NÃO OFERECIA O GOLPE NOVO, E ISSO FOI CONSERTADO EM 17/09/2026** — ver a seção
  própria, logo abaixo. O diagnóstico que estava aqui era exato (*"a pendência CORRETA gravada, e
  quem a resolve é só o `continueFromEvolution`"*), e foi ele que apontou o conserto: uma fila nova
  ao abrir o save, no molde da `escolhaDoSavePendente`.
- **⚠️ ISTO É HISTÓRIA desde 24/09/2026: os 13 golpes que ficavam inalcançáveis pra LINHA INTEIRA
  passaram a ser herdados.** O item dizia: *"o que a forma antiga ensinaria ACIMA do nível da
  evolução e a nova nunca ensina não tem como ser aprendido (a Starmie é o caso mais duro)"* — e era
  exatamente esse buraco que o relato do Cloyster apontou, só que pelo Raio Congelante. Ver **A FORMA
  EVOLUÍDA HERDA O APRENDIZADO DA LINHA**. O que continua valendo daqui é o diagnóstico: a evolução
  neste jogo é sempre automática por nível, e não existe Everstone.


### ⚠️ O DOCE RARO NÃO OFERECIA O GOLPE DO NÍVEL NOVO (17/09/2026)

Reportado assim: *"cheguei com um Zapdos no level 85 usando Rare Candy, e ele não aprendeu o golpe
que deveria aprender no 85"*. **E era verdade**: o Zapdos aprende **Trovão (poder 120) no 85**, e
ele nunca chegava.

**⚠️ A PENDÊNCIA SEMPRE ESTEVE CERTA — o que faltava era alguém PERGUNTAR.** Reproduzido antes de
mexer em qualquer coisa: depois do doce, o save fica com `Lv.85` e a janela `(84, 85]`, e
`aprendizadosPendentes()` devolve `thunder (Lv.85)` corretamente. Só que o **único chamador** do
`resolverAprendizados` era o `continueFromEvolution` — alcançado só pelo fluxo da jornada. Quem usa
o doce no save campeão, que é onde ele mais é usado, **nunca passava por lá**.

O conserto é uma fila nova (`aprendizadoDoSavePendente`), no molde exato da `escolhaDoSavePendente`
que já resolve a fila da CAPTURA, e ela roda em **dois momentos**:

- **na hora**, quando o pokémon é do save ABERTO — ele acabou de subir de nível na frente do
  jogador, e adiar pra a próxima abertura seria a mesma falha silenciosa, só que mais curta;
- **ao abrir o save**, pros outros casos — o doce usado pela Torre (que escolhe de qualquer save) e
  a evolução feita no servidor.

- **⚠️ ELA VEM DEPOIS DA FILA DA CAPTURA, não antes.** Aquela é a de quem não tem golpe NENHUM
  (save antigo); esta é a de quem tem golpe e cruzou um nível novo. Perguntar *"qual retirar"* antes
  de o pokémon ter os três primeiros seria pedir uma decisão sobre um time que ainda não existe.
- **O destino é uma TELA, e por isso há lista de permissão** (`SCREENS_DE_VOLTA`): o
  `evolucaoDepois` também carrega passos da jornada (`continueJourney`, `retry`, `special`), e um
  nome desconhecido caindo no `game.screen` levaria a uma tela em branco. Vindo do doce o jogador
  estava na mochila, no resumo da jornada ou na torre — mandá-lo pro `teamOrder` o tiraria do lugar
  por ter aprendido um golpe.
- **E o destino é LIMPO quando a tela não abre**, exatamente como o `escolhaDepois` precisou:
  deixado gravado, ele **rouba a próxima passada** — foi esse vazamento que fez um jogador pular a
  distribuição de níveis de um ginásio inteiro.

#### ⚠️ E NO CAMINHO APARECEU UM SEGUNDO DEFEITO, PIOR QUE O RELATADO: O DOCE SE PERDIA

O nível sobe no **SERVIDOR** (`useRareCandy`), e o `game.team` desta aba **continuava no nível
velho**. Bastava voltar da mochila pra uma tela de gravação (`SAFE_SAVE_SCREENS` — `teamOrder`,
`walk`, `journeyEnd`...) pro autosave **escrever o nível ANTIGO por cima** do que o servidor tinha
subido: **o doce era gasto e o nível voltava, em silêncio.**

Medido antes do conserto: com o save aberto, `game.team[0].level` ficava em **84** enquanto o
servidor gravava **85**, e `serializeGame().team[0].level` devolvia **84**.

- **⚠️ O NÍVEL VEM DA RESPOSTA DO SERVIDOR, e não de um `+= 1` local**: o servidor é quem manda, e
  somar por aqui erraria se as duas cópias já estivessem fora de sincronia.
- **E o `tryEvolve` logo depois é o MESMO caminho da jornada** — o servidor rodou o espelho dele
  (`evoluirNoSave`), e os dois já são comparados em **24.750 casos** pelo teste.

`tools/test-ataques.js` tranca 15 pontas: que o Zapdos **aprende mesmo** algo no 85 (o dado, antes
da mecânica), o nível do save aberto acompanhando, a pergunta saindo na hora com o golpe certo, o
destino guardado e a volta pra ele, a pergunta chegando ao abrir o save fechado, o destino **não**
ficando gravado quando nada está pendente, quem tem vaga aprendendo sem perguntar **mas com
anúncio**, e — lendo o código — a ordem entre as duas filas e as duas portas de abrir save.
Conferido que elas acusam: 3 falhas com o time aberto sem acompanhar, 4 sem a pergunta.

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
