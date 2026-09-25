# A BATALHA NA TELA

O **log**, a **cena**, a **animação** e os **selos** — tudo que o jogador LÊ durante uma luta. Saiu
do `CLAUDE.md` em 25/09/2026, pela mesma medição que tirou as Ilhas Laranja e a economia.

⚠️ **ISTO É APRESENTAÇÃO, E A PROVA DISSO É A IMPRESSÃO DO MOTOR:** quase tudo aqui foi conferido
com `node tools/impressao.js A B`, e o que se espera é o **MOTOR idêntico** com o **DIÁRIO
mudando**. Quando os dois mudam, é mecânica — e aí a medição de jornada entra junto.

⚠️ **E O INSTRUMENTO PRECISA SER PROVADO SENSÍVEL** (o `--sensivel`): um hash que nunca muda não
prova nada se o painel não alcançar o código mexido.

⚠️ **E O QUE NÃO ESTÁ AQUI:** as MECÂNICAS de batalha moram em `docs/motor-de-batalha.md` (dano,
golpe, status, passiva), as Ilhas Laranja em `docs/ilhas-laranja.md`, a loja em `docs/economia.md`,
e o resto no `CLAUDE.md`.

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


#### O FUNDO DO CARD DIZ O RESULTADO (23/09/2026)

Pedido assim: *"no log de batalha, deixe o fundo de cada card que o pokémon do treinador que venceu
de verde, e o que a batalha ele perdeu, deixe vermelho, mas deixe uma cor leve, para não atrapalhar
a leitura"*.

**⚠️ ELE NÃO AFIRMA NADA NOVO — é a MESMA coisa que o título diz desde 16/09**, e é isso que o torna
seguro: a cor se lê **antes** da palavra, que é o ponto numa lista de vários cards. E `m.player` é
sempre o pokémon do treinador nas **nove** telas que mostram este log — no online o
`logDaMinhaVista` já virou a perspectiva, e no Ginásio da Cidade quem lê o resultado é o
DESAFIANTE. É a mesma convenção que o título já usa pra pintar o nome de azul.

*(O CLAUDE.md dizia "sete telas, inclusive a liga assistida" — conferido: são **nove** hoje, a
Seleção e a Pescaria entraram depois, e a **liga assistida não usa este log**: ela tem quadro
próprio e animação, e nunca chamou o `renderMatchupLog`.)*

**⚠️ QUEM VENCEU PASSOU A VIVER NUMA FUNÇÃO SÓ** (`vencedorDoConfronto`), lida pelo título E pela
cor. Duas contas em paralelo divergiriam no primeiro ajuste, e o sintoma seria o pior possível: **um
card verde com o título dizendo que o adversário venceu.** É a lição do `EXPOENTE_TIPO`, que valia
num lugar e não no outro, e a da `fraseDoEspecial`. Uma trava varre os quatro estados e cobra o
**PAR** — uma que só olhasse a classe passaria com o título refazendo a conta.

**⚠️ O TETO DA COR NÃO É O GOSTO: É O TÍTULO BATENDO NO AA.** Ele é `--muted` (o texto mais claro do
card) e já está em **5,20:1** sobre o branco. Medidas quatro intensidades no navegador:

**⚠️ E ELA FICOU MAIS VIVA NO MESMO DIA (8% → 16%), a pedido — e o que cedeu foi o TEXTO, não o
fundo.** O gargalo é o `--muted` (o título, o `Lv.` e o `x/y` de HP), que a 16% cai pra 4,34/4,05,
**abaixo do AA**. Por isso o card colorido **redeclara a variável** (`#5f5f73`), e o valor não foi
escolhido no gosto: é o que devolve os **5,20:1** que eles davam sobre o BRANCO antes de a cor
existir. Ou seja **a cor deixou de custar leitura nenhuma**:

| | 8% | **16% (hoje)** |
|---|---|---|
| ΔE do branco | 6,0 / 6,8 | **11,9 / 14,0** |
| ΔE verde–vermelho | 8,5 | **17,3** |
| título / `Lv.` / HP | 4,75 / 4,59 | **5,20 / 4,85** (com o `--muted` local) |
| passo a passo | 15,6 | 14,3 |
| nome no título (já sai em verde/vermelho ESCURO) | 6,0 | 5,5 |

**⚠️ E O NOME JÁ SAÍA NA COR DO RESULTADO, o que este arquivo dizia errado:** o `.mlog-quem` é
`--green-dark`/`--red-dark`, não azul — ou seja ele já casava com o fundo antes de o fundo existir.

**⚠️ SE ELA PRECISAR FICAR MAIS VIVA AINDA, o lugar continua sendo o TEXTO:** a 24% o `#5f5f73` já
cai pra 4,3 no vermelho. E a trava passou a **medir o contraste de verdade** em vez de um proxy —
a primeira versão somava os canais do fundo ("perto do branco") e **caducou no dia seguinte**.

| tom sobre o branco | título verde / vermelho | ΔE p/ o branco | ΔE verde–vermelho |
|---|---|---|---|
| 5% | 4,92 / 4,81 | **3,5 / 4,5** | 5,4 |
| **8% (hoje)** | **4,75 / 4,59** | **6,0 / 6,8** | **8,5** |
| 12% | 4,54 / **4,30** ❌ | 8,8 / 10,5 | 12,9 |
| 16% | **4,34** ❌ / **4,05** ❌ | 11,9 / 14,0 | 17,3 |

**12% e 16% REPROVAM no AA** (o mínimo é 4,5) — descartados por medição, não por gosto. E **5% fica
a ΔE 3,5 do branco, ou seja indistinguível do próprio `:hover` do card (ΔE 3,6)**: a cor existiria e
não se veria. **8% é o ponto** — o mais forte que mantém o título acima do AA nas duas cores.
O texto do passo a passo (`--ink`) nem chega perto do limite: **17,06 no branco, 15,6 no verde**.

**⚠️ SE UM DIA A COR PRECISAR SER MAIS FORTE, o lugar de mexer é a cor do TÍTULO**, não a do fundo:
é ele o gargalo, e escurecê-lo sobe os dois números de uma vez.

- **⚠️ AS DUAS REGRAS VÊM DEPOIS DO `:hover` GENÉRICO, e cada cor tem o hover dela.** Elas têm a
  MESMA especificidade (0-2-0), então quem vence o empate é a **última declarada** — declaradas
  antes, passar o mouse num card verde o deixaria creme. É a armadilha que o `.pesc-puxar.puxando`,
  o `.pesc-zona:disabled` e o `.minha` do Resgate já custaram, e ela **não aparece em asserção de
  HTML nenhuma** — a trava lê a ORDEM no arquivo.
- **⚠️ OS DOIS CAÍREM NÃO GANHA COR** (1,2% dos confrontos, e é sempre autodestruição): ali não
  houve vencedor, e pintar de um dos dois seria escolher um por acaso. É a mesma decisão da medalha
  do pódio da Arena 1x1. Os dois de pé, que não acontece hoje, idem.
- **⚠️ E O LOG ANTIGO (sem passos) FICA DE FORA**: ele não vira card, não tem título e não tem
  fundo branco pra tingir — a cor sairia como uma faixa solta no meio da lista tracejada.
- **O card ABERTO continua com a borda azul** por cima da cor: a borda diz QUAL está aberto e o
  fundo diz o resultado. As duas coisas convivem, conferido no navegador.

**Medido a 320px, num log de 10 confrontos com os três casos:** sem rolagem lateral, o passo a passo
aberto sobre o verde em 15,6:1, e o card "Os dois caíram" em branco puro.

**No motor, nada:** `MOTOR 5481ce57abca / DIARIO a4c6725aa4aa`, idêntico em 900 batalhas semeadas.
**Os 8 defeitos religados acusam** (1 a 5 falhas cada).

**⚠️ E UMA TRAVA MEDIA A FORMA DA STRING DE CLASSE:** ela contava `mlog-card aberto` **colado**, e
a classe do resultado entrou no meio (`mlog-card venceu aberto`) — ela caiu com o código certo. É a
mesma armadilha da `resultTime` cravada por igualdade exata, que passou a casar com ZERO no dia em
que a segunda classe entrou na mesma lista. **Classe se procura na LISTA, nunca colada.**


### QUEM ENTRA EM CAMPO COM BUFF DE TERRENO ANUNCIA (23/09/2026)

Pedido assim: *"antes de iniciar um confronto, caso o pokémon tenha buff de terreno, exiba uma
mensagem dizendo 'Onix é afetado pelo terreno e ganha buff de 15% em todos atributos (símbolo de
buff de terreno)', espera aquele 1,5s e segue com a batalha, para todos os pokémons que entrar na
batalha e tiver buff de terreno"*.

**⚠️ É NA ENTRADA, UMA VEZ POR POKÉMON POR BATALHA -- não a cada confronto.** Quem sobrevive a três
confrontos não "entrou" três vezes, e as duas metades do pedido se conciliaçam aí: *"antes de
iniciar um confronto"* é o começo do confronto **dele**, e *"que ENTRAR na batalha"* é a entrada.

**MEDIDO em 900 batalhas com terreno sorteado:**

| | linhas por batalha | de tela |
|---|---|---|
| **por ENTRADA (o que foi feito)** | **1,73** | **+2,6s** |
| por CONFRONTO | 3,29 | +4,9s |

Ou seja por confronto seriam **1,90× mais frases**. Num painel de terreno forte (Termas Vulcânicas,
que pega 5 dos 12) são **+3,8 a +4,4s por batalha**, com teto de 5 linhas (+7,5s).
**Se um dia for pra valer a cada confronto, é tirar o `_terrenoAnunciado` da guarda** -- e a régua
está aqui.

- **⚠️ ELA NÃO LÊ O `rng`**, e isso é o que a torna barata: não há sorteio nenhum (o pokémon TEM
  ou NÃO TEM a flag), então a semente não se move. **Conferido por impressão, 900 batalhas COM
  terreno: o MOTOR fica idêntico (`d25352d084c0`) e só o DIÁRIO muda** -- que é o que uma linha
  nova deve fazer. Sem terreno, os dois ficam idênticos (`5481ce57abca / a4c6725aa4aa`).
- **⚠️ O MARCADOR É SOLTO NO `encerrarBatalha`**, com o `_congelado` e o `_furia`: sem isso o
  pokémon sai da batalha "já anunciado" e **nunca mais anuncia** -- e a flag `terrainBuffed` é
  recalculada a cada batalha. É o vazamento que o teto de HP da Fúria teve.
  ⚠️ **E A ÂNCORA É OUTRA NO SERVIDOR**: o `encerrarBatalha` de lá não solta o `_congelado`, o
  `_queimado` nem o `_envenenado` -- a nota disso já estava escrita ali desde a paralisia.
- **OS 15% SAEM DA CONSTANTE**, nunca escritos na frase: é o cuidado da caixa que explica o
  especial, e a razão de ela existir -- a especialidade já teve este arquivo dizendo "~13 pontos
  percentuais" por um texto ter sobrevivido à mudança do valor.
- **O SELO É O MESMO DO TERRENO DO RESTO DO JOGO** (o do quadro do lutador e o da faixa): o jogador
  lê o símbolo aqui e reconhece o do pokémon buffado sem ligar as duas coisas.
- **O `q` DA LINHA É DO PRÓPRIO POKÉMON**, como o do `acordou` e o da Fúria: ela é sobre UM
  pokémon, não sobre um causador e um alvo. Lido ao contrário, a frase nomeia o adversário.
- **O 1,5s vem da entrada no `passosDaAbertura`** (1 passo, como toda frase que não mexe barra).
  Fora da tabela ela valeria pra SEMPRE -- o defeito que a anulação teve.
- **⚠️ E O `ehGolpeEspecial` TEM QUE CONHECÊ-LA**, senão a linha cai no ramo do GOLPE COMUM e sai
  como `-0 de HP` com o nome de um golpe que o pokémon não tem: foi o que aconteceu com as três
  linhas do congelamento em 16/09/2026, e foi o **navegador** que pegou.

**⚠️ E A COMPARAÇÃO DAS 300 BATALHAS NÃO SERVE PRA ISSO: ela roda SEM TERRENO.** Religando o
defeito "o servidor não anuncia", a bateria inteira passava **em branco** -- ou seja os dois
motores podiam divergir numa linha do diário sem nada acusar. Por isso ela tem **painel próprio**:
120 batalhas com o terreno marcado nos dois lados, batendo golpe a golpe (**0 divergências, 597
linhas, 600 pokémon buffados**). É a mesma decisão do gelo e da queimadura.

**⚠️ E DUAS TRAVAS MINHAS MEDIAM O QUE NÃO DÁ PRA MEDIR DE FORA:**

1. *"o marcador FICA durante a batalha"* -- o `simulateGymBattle` **JÁ chama o `encerrarBatalha`**
   no fim, então ele nunca está de pé quando ela volta. Quem prova a regra é o `doExchange`
   chamado na mão: a primeira troca anuncia os dois, a segunda não repete, o encerrar solta, e a
   batalha seguinte anuncia de novo.
2. *"o número é DERIVADO da constante"* -- **`const` dentro do sandbox não é reatribuível de
   fora**: escrever em `S.TERRAIN_BUFF_MULT` só troca a propriedade do objeto, e a ligação léxica
   de dentro do script continua a mesma. É a mesma lição do `const` que não vira global, que a
   Queimada já custou. Hoje quem prova é o **código**: a frase lê a constante e não tem o número
   escrito.

**Medido a 320px:** a linha cai na caixa amarela das aberturas, com o selo, **antes** do primeiro
golpe -- e **zero `-0 de HP`** no log. **Os 10 defeitos religados acusam** (1 a 14 falhas cada).


#### ⚠️ O SELO SAI NA COR DO TERRENO, E A FRASE DURA 2s (23/09/2026)

Pedido assim: *"a mensagem de que tal pokemon ganhou buff de terreno, deixe a cor do simbolo de
buff, da mesma cor que fica ao lado do nome do pokemon com o simbolo de buff, e aumente o tempo
dessa mensagem para 2s"*.

**⚠️ A LINHA GANHOU O TIPO DO TERRENO (`tt`), e a cor sai DELA — nunca do estado da tela.** O log é
relido dias depois, e ali o terreno da batalha corrente não é o daquele confronto: lido do estado,
a frase de um log antigo sairia na cor do terreno de hoje. É a mesma razão pela qual o `sai` do
Remoinho e o `a` da anulação viajam no diário.

- **⚠️ O CAMPO É `tt` E NÃO `t`:** o `t` do passo animado já quer dizer **quantos TAPAS**, e um
  colide com o outro no mesmo objeto. Há trava cobrando que a linha do terreno não tenha `t`.
- **A COR É O `TYPE_COLORS[tt]`, que é o MESMO que o `terrainColor` do quadro do lutador usa** —
  as duas pontas têm que dar a mesma cor, senão o selo da frase e o galão do quadro discordam na
  MESMA tela. Medido no navegador: `#F08030` nos dois, num terreno de Fogo.
- **⚠️ E OS DOIS MOTORES GRAVAM O CAMPO.** O diário do servidor é o que vai pro log da liga —
  gravando só no cliente, a frase da liga sairia no verde padrão.
- **LINHA ANTIGA (sem o campo) CAI NO `COR_TERRENO_PADRAO`**, que é o verde que ela sempre teve:
  log velho não pode sumir nem mudar de cor.

**⚠️ E A PAUSA É PRÓPRIA (`PAUSA_TERRENO_MS`, 2000ms), NÃO A CONSTANTE DE SEMPRE.** O
`PAUSA_LEITURA_ESPECIAL_MS` (1500) vale pra **TODA** frase de passiva do jogo — subi-lo deixaria
toda batalha mais lenta por frase, que não foi o que se pediu. Quem separa os dois casos é o
`pausaDaFaixa`, e há trava cobrando que as outras continuem em 1,5s e que um passo comum continue
sem pausa nenhuma.

**⚠️ NO MOTOR, NADA — e a impressão de SEMPRE não prova isso sozinha: ela roda SEM TERRENO**, então
ela não alcança a linha. Medido com uma impressão COM terreno (900 batalhas, um terreno por
batalha): **MOTOR `3bd460a0238a` idêntico** e **DIÁRIO mudando** (`79fb3fe4a3bf` → `03abfbce4535`),
que é exatamente o que um campo novo de apresentação deve fazer.

`tools/test-especiais.js` tranca: o `tt` na linha (e o `t` não colidindo), a cor batendo com o
`terrainColor`, a linha antiga caindo no padrão, os outros especiais intactos, os dois motores
gravando, os 2s só do terreno e o 1,5s dos outros. **Conferido que os 4 defeitos religados acusam.**

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

#### ⚠️ E ELE VIROU UM DIA POR VEZ, COM SETAS (17/09/2026)

Pedido assim: *"no histórico do ranking da torre, ao invés de exibir todos os dias um embaixo do
outro, coloque setinhas para ir paginando os dias"*.

- **EMPILHADOS, OS CINCO DIAS SÃO ATÉ 50 LINHAS** num modal que já rola por dentro — e a pergunta
  que se faz ali é sobre **UM** dia, não sobre os cinco ao mesmo tempo. Medido a 320px com cinco
  dias cheios (10, 4, 0, 7 e 1 inscritos): o conteúdo vai de **~1.075px para 601px no pior dia**,
  **−44%**, sem rolagem lateral.
- **AS SETAS SÃO O `.circle-btn` DA CASA**, o mesmo das setas de ordem do time (32px) — não um
  controle novo. A data fica **entre as duas**, numa grade de três colunas, e a conta ("1 de 5") vem
  logo abaixo: sem ela o jogador não tem como saber quantos dias existem nem onde está.
- **A SETA DA PONTA FICA DESABILITADA, não some.** Sumindo, a data pularia de lado a cada
  navegação — e um controle que muda de posição num celular é o que faz errar o toque.
- **⚠️ O ÍNDICE É CLAMPADO NO DESENHO, E O CLAMP GRAVA A CORREÇÃO.** O histórico é carregado **depois**
  de a tela abrir, então a página pode apontar pra um dia que ainda não chegou (ou que sumiu) — sem
  o clamp, a seta levaria a um modal vazio. E gravar não é detalhe: com o valor velho ainda
  guardado, a **próxima seta partiria dele** e a página pularia sozinha. É literalmente o mesmo
  cuidado que a paginação do montador de time carrega, e foi a trava que o pegou.
- **A PÁGINA ZERA AO ENTRAR NO HISTÓRICO** (`abrirHistoricoDaTorre`): o "dia 3 de 5" de ontem não é
  o mesmo de hoje, porque a lista anda.
- **⚠️ E QUATRO TRAVAS MEDIAM O FORMATO EMPILHADO**, então elas não foram só "consertadas": passaram
  a **ANDAR pela paginação** — cada dia continua sendo cobrado, um a um, e o pódio por dia ficou mais
  visível do que era (o dia com um inscrito só leva ouro **e mais nada**; o dia vazio não tem
  medalha nenhuma).

## A CENA NOVA DE BATALHA (22/09/2026)

> **⚠️ ELA NASCEU ATRÁS DE UM GATE DE ADMIN E FOI ABERTA PRA TODO MUNDO NO MESMO DIA**, a pedido —
> ver **A CHAVE FOI ABERTA**, no fim desta seção. Tudo que este texto diz sobre "o não-admin
> continua vendo a batalha de hoje" é a régua de algumas horas, e continua valendo como história:
> é ela que explica por que a porta é uma FUNÇÃO SÓ e por que o caminho antigo não foi apagado.

Pedida assim: *"ele possui um cenário gráfico diferente do index atual no momento das batalhas, com
sprites, cenários e animações diferentes ... pegue SOMENTE essa parte gráfica ... coloque que somente
quem está com admin=true veja essa nova animação, que não tem admin=true continua vendo a batalha
como ela é hoje"*, e depois: *"quero que a batalha fique EXATAMENTE como está nesse arquivo"*.

A origem é o `index-novos-graficos.html` da raiz — um branch **ANTIGO** do mesmo arquivo (39.906
linhas contra 39.026), com a cena nova pronta e **sem** várias features recentes (Montanha Sagrada,
Ilhas Laranja, HM03, Home 2.0). Ou seja: o diff entre os dois é quase todo **REMOÇÃO**, e o port é
uma colheita seletiva — não um merge.

**O QUE A CENA É:** sprites animados da Gen V (o adversário de frente, o jogador **de costas**),
fundo de pixel art por TERRENO, placas de HP separadas em vez do bloco central, avanço do atacante,
tremor e flash no alvo, número de dano subindo, desmaio, explosão da autodestruição, e seis ícones
de status flutuando sobre o sprite (sono, veneno, queimadura, paralisia, gelo, confusão).

### ⚠️ ELA VALE EM DUAS TELAS, E SÓ NELAS

`renderBattling` (jornada + Ginásio da Cidade) e `renderSpecialBattling` (Elite, Rocket, rival,
Vigília). A **Torre**, a **liga assistida**, o **online** e a **pescaria** continuam no desenho
antigo — e isso não é corte meu: **é o que o próprio arquivo de origem faz**, declarado no comentário
do CSS dele (*"a classe `.battle-scene` isola tudo: pescaria, online e telas antigas que ainda usam
`.battle-vs` continuam com o desenho anterior até serem migradas de propósito"*).

É por isso que só **DOIS** dos quatro laços de revelação chamam o `animarGolpeNaCena`
(`advanceSpecialReveal` e `advanceReveal`): os outros dois não têm cena pra animar.

### ⚠️ O GATE É UMA FUNÇÃO SÓ, E O PONTO QUE ELE PROTEGE NÃO É ÓBVIO

```js
function visualNovoDeBatalha(){ return game.ehAdmin === true; }
```

`=== true` exatamente, como as portas das Ilhas Laranja: `'sim'`, `1` e `'true'` não abrem. Ele é
lido em **seis** pontos (os dois containers, os dois `fighterHtml`, o sprite com status e o preload
dos GIFs) — escrito em cada um, o próximo ponto nasceria sem ele e a cena vazaria pra todo mundo.

**⚠️ O PONTO QUE SUSTENTA A IDENTIDADE DO NÃO-ADMIN É O `spriteComStatusHtml`.** No arquivo de
origem ele envolve o sprite **também no caminho ANTIGO** (o `fighterHtml` de sempre, a liga assistida
e o online) — ou seja, colado sem gate ele poria os ícones de status na tela de **todo jogador**.
A guarda mora **dentro** dele:

```js
if(!visualNovoDeBatalha()) return sprite;
```

Uma linha, e com ela qualquer caminho antigo que venha a chamá-lo volta a devolver o HTML de hoje
byte a byte, sem precisar de um `if` em cada chamador.

### ⚠️ E OS ÍCONES DE STATUS FICARAM SÓ NA CENA — o que o navegador pegou

O `fighterHtml` tem **seis** chamadores, e só quatro passam `visualNovo`: os outros dois são a
**TORRE** (`renderTrainerBattling`, que serve também o boss e a Seleção) e a **PESCARIA**. O arquivo
de origem envolve o sprite com `spriteComStatusHtml` no caminho antigo também — então, portado ao pé
da letra, um **admin** passaria a ver os seis ícones na Torre e na Pescaria.

**Medido a 320px no navegador, e é feio:** na Torre os ícones caem **EM CIMA do placar de
pokébolas**. A causa é estrutural — o `.battle-status-fx` é `bottom:calc(100% + 3px)` do sprite, e no
layout antigo **o sprite é o PRIMEIRO elemento do `.fighter`**, então o "acima dele" é justamente a
linha do placar. Na cena nova isso não acontece: lá o sprite fica no rodapé do palco e sobra campo
acima dele.

Então **o wrap do caminho antigo ficou de fora**, e essa é a única diferença estrutural em relação à
origem. Com ela, **as telas que seguem no desenho antigo continuam byte a byte iguais pra todo
mundo, admin inclusive** — e os ícones ficam onde a cena está, que é onde eles foram desenhados pra
caber.
**⚠️ A TORRE E A PESCARIA ESTAVAM NESSA LISTA QUANDO ISTO FOI ESCRITO, e saíram dela horas depois**,
quando ganharam cenário (ver as seções abaixo). Hoje os que sobram no caminho antigo são o **Boss de
Domingo**, a **Seleção** da Ilha Kumquat, o desafio por **código de treinador** e o **online**. Se um dia forem pra valer nas telas antigas, o que falta não é o wrap: é reposicionar o
`.battle-status-fx` pra aquele layout.

**⚠️ E ELE COBROU DUAS VEZES O MESMO TIPO DE PEDÁGIO, os dois já registrados neste arquivo:**
o comentário que explica a decisão nasceu como um `${…}` **separado** e acrescentou **uma linha de
indentação ao HTML de todo mundo** — a medição de identidade caiu de 80/80 pra 0/82 e apontou na
hora; ele passou a viver dentro do comentário que já existia ali. E, escrito com **crase** em volta
dos nomes de classe, ele **fechou o template literal** — e essa é a armadilha pior, porque com um
número PAR de crases o `node --check` **passa** e a tela só quebra no navegador.

### ⚠️ OS 18 MB DE ATLAS VIRARAM SEIS PNG — e é a decisão mais cara desta leva

O arquivo de origem embute os 6 atlas de terreno como `data:image/png;base64` **dentro do CSS**:
**13,5 MB de PNG que viram 18,05 MB de base64**. Colados aqui, o `index.html` iria de 2,48 MB para
**20,5 MB**.

**E isso não seria "um arquivo maior": seria o jogo inteiro parando de abrir.** Este arquivo já
registra, na seção de Deploy, que o Hosting **NUNCA devolve 304** pro `index.html` — *toda abertura
do jogo baixa o arquivo inteiro*. Medido, o que trafega:

| | gzip (o que desce em toda abertura) |
|---|---|
| hoje | **799 KB** |
| com os atlas em arquivo (o que está no ar) | **812 KB** (+1,7%) |
| **com os atlas embutidos, como na origem** | **15,0 MB** (**18,5×**) |

Os 15 MB cairiam em **todo jogador, admin ou não, em toda abertura** — inclusive em quem nunca vai
ver a cena. Os atlas saíram pra `assets/batalha/atlas-0..5.png` e o CSS os pede por caminho relativo.

- **O `firebase.json` publica a RAIZ** (`"public": "."`) e o `hosting.ignore` não cobre `assets/`,
  então eles são servidos em `jornadakanto.com/assets/batalha/…` sem mexer em nada.
- **⚠️ E ELES SÓ BAIXAM QUANDO A CENA DESENHA:** `background-image` de uma regra que ninguém casa não
  é requisitada. Pro não-admin o custo é **ZERO** — os 13 KB de gzip acima são só o CSS e o JS.
- **O visual é IDÊNTICO** — é o mesmo PNG, byte a byte, só que num arquivo em vez de numa string.
- **⚠️ E O SELETOR ACOPLA NO FORMATO DA STRING INLINE:** ele é
  `[style*="--battle-atlas:0;"]` — **sem espaço depois dos dois-pontos e COM ponto-e-vírgula**. Quem
  mexer no `terrainBattleSceneStyle` tem que manter esse formato, senão o fundo some sem erro nenhum.

### ⚠️ O DRIFT QUE TERIA APAGADO O SELO DA ESPECIALIDADE

Os dois arquivos derivaram, e o `fighterHtml` da origem usa **`selo('medalha','selo-g')`** pro selo
🎖️ da especialidade. **`'medalha'` não existe na tabela `DESENHOS` — nem aqui, nem no arquivo de
origem** (conferido nos dois): `selo()` de um nome desconhecido sai **VAZIO, sem erro**, que é o
defeito do selo fantasma que este arquivo já registra em produção.

Ou seja: **a cena nova, no arquivo de origem, perde o selo da especialidade e ninguém notou.** Aqui
ele foi portado como **`selo('medalha_ouro','selo-g')`**, que é o nome que o caminho antigo já usa.
É a **única** diferença deliberada em relação à origem, e ela é pra o selo continuar aparecendo.

### O QUE FOI MEDIDO ANTES DE COLAR

- **OS 51 TERRENOS BATEM EXATO.** `TERRAIN_SCENE_META` e `TERRAIN_SCENE_TILES` têm 51 entradas cada,
  e o conjunto de ids é **idêntico** ao do `TERRAINS` daqui: **0 terrenos sem cenário**, 0 cenários
  órfãos. Nenhum cai no fallback do `campo_aberto`.
- **O CSS NÃO TEM COMO VAZAR: os 125 seletores do bloco contêm uma classe `battle-*` nova.** As
  únicas três `.battle-*` que já existiam (`.battle-vs`, `.battle-status-area`,
  `.battle-result-line`) não são tocadas, e os 10 `@keyframes` novos têm nome livre.
  **⚠️ E a `.battle-status-area` é IRMÃ da `.battle-vs`, não filha** — o `overflow:hidden` da cena
  não corta a linha de status.
- **O MOTOR NÃO FOI TOCADO, e o instrumento é sensível:** `MOTOR 47d16bcb4c3f / DIARIO 053483c8b60c`,
  **idêntico** antes e depois em 900 batalhas semeadas — e a mesma medição com o `CRIT_BASE` mexido
  muda os dois hashes, que é o que impede o hash imóvel de não provar nada.

### ⚠️ A IDENTIDADE DO NÃO-ADMIN FOI MEDIDA, NÃO ARGUMENTADA

82 telas renderizadas nos dois builds com o mesmo estado (4 fases × 3 terrenos × 4 confrontos, mais
o `fighterHtml` cru nos dois lados e em quatro passos): **80 de 80 saem byte a byte iguais** (as
duas restantes são a própria função nova, que não existe no build de antes).

**E a primeira medição pegou uma diferença de verdade: +14 bytes por tela.** Não era elemento
nenhum — eram **duas linhas em branco**, das interpolações `${cenaNova ? … : ''}` da grade e da
camada de efeitos, que deixavam a linha vazia quando o gate estava fechado. Hoje a quebra de linha
faz parte do próprio condicional (`${cenaNova ? '\n      <div …>' : ''}`), e aí sem cena não sobra
nem a linha. **Whitespace não muda o que a tela desenha — mas "byte a byte" só vale se for medido.**

**E do lado do ADMIN a conta fecha pro outro lado:** contra o `index-novos-graficos.html`, **todas as
telas da CENA saem idênticas — zero diferenças**. As únicas que diferem são as do caminho ANTIGO, e
elas diferem de propósito: são os ícones de status que ficaram de fora do **caminho antigo** (item
acima).

### O QUE FICOU DE FORA, E É DECISÃO — não esquecimento

> **⚠️ REVISADO EM 24/09/2026, e o item 1 JÁ FOI FEITO:** a **liga assistida** ganhou a cena horas
> depois disto (ver **A CENA CHEGOU NA TORRE, NA LIGA E NO GINÁSIO DA CIDADE**), então o que restou
> desta lista é só o **online**.
>
> **⚠️ E O `virarMatchup` NUNCA FOI UM REFACTOR A FAZER — ele existe desde 28/08/2026**, e é usado na
> reprise e no **log** do online (o `logDaMinhaVista`). O texto abaixo o descreve como se ele
> precisasse ser criado, e isso está errado: o que falta é **USÁ-LO na ANIMAÇÃO**. Medido no código
> hoje, são duas coisas, as duas com padrão pronto no jogo:
>
> 1. o `meuM` da virada de perspectiva **carrega só HP** — o comentário do próprio jogo diz isso ao
>    lado dele —, então o lado B continua vendo a **reconstrução**. O `virarMatchup` resolve;
> 2. o `renderOnlineFight` desenha com `battle-vs` **sem** `battle-scene`, ou seja a cena não chegou.
>
> **⚠️ E A CONSEQUÊNCIA É QUE O ARQUIVO DE REFERÊNCIA DEIXOU DE SER NECESSÁRIO:** a arte está toda
> extraída em `assets/batalha/` (**15,4 MB em 9 WebP**, pedidos por 12 pontos do CSS), a cena está
> implementada (**49 usos de `battle-scene`**) e os dois itens acima são a aplicação de padrões que o
> jogo já tem. Ele foi **tirado do diretório em 24/09/2026** — ele tinha **23 MB, ~6 milhões de
> tokens**, e uma varredura que o lesse estourava o contexto sozinha.

O arquivo de origem tem, na MESMA camada, mais duas coisas que **não** trocam cenário nenhum (são só
os seis ícones de status sobre o sprite antigo):

1. **A LIGA ASSISTIDA.** Custo **zero** e auto-gateada pelo `spriteComStatusHtml`. Ficou de fora só
   porque o pedido é sobre a batalha da jornada; são duas linhas quando se quiser. **← FEITO em 22/09.**
2. **⚠️ O ONLINE — e este NÃO é gateável.** Ele depende do refactor `virarMatchup`, e **ele não é só
   refactor: ele muda o online pra TODO MUNDO** (só pro lado B). Medido em 4.000 confrontos, o que
   ele consertaria:

   | | hoje (lado B) | com o refactor |
   |---|---|---|
   | a sequência que o lado B vê difere da real | **100%** | — |
   | frase de passiva com a contagem de passos fora de sincronia | 86,8% delas | 0 |
   | selos de status no pokémon ERRADO | **8,30%** dos confrontos | 0 |

   Ou seja: **hoje os dois jogadores da mesma partida assistem a lutas diferentes** — o lado A vê os
   golpes reais e o lado B vê a reconstrução. Isso é defeito de produção, e este arquivo já o
   registrava em aberto na seção da drenagem (*"o conserto é uma linha, mas ele muda o que metade dos
   jogadores vê numa batalha PvP e merece medição própria"*). **Esta é a medição.**

   Ficou de fora porque o pedido foi explícito em não mexer em mais nada, e porque gateá-lo seria
   pior que as duas opções: a MESMA partida PvP animaria diferente conforme quem assiste ser admin.
   O preço de fazê-lo um dia está medido: o lado B ganha a luta de verdade e paga ~12% de compressão
   a mais na animação (fator 0,906 → 0,801), **com a janela de escolha intacta** — é pra isso que o
   `ORCAMENTO_ANIM_ONLINE_MS` existe.

### ⚠️ E UMA TRAVA ENVELHECEU NO MESMO DIA

`tools/test-especiais.js` cobrava *"nenhuma classe devolve o crispEdges pelo CSS"* grepando
`shape-rendering:crispEdges` no **arquivo inteiro** — e isso era um proxy **certo** enquanto o selo
era o único SVG com regra de CSS aqui. Os ícones de status novos (`.battle-status-effect svg`) são
pixel art de 16×16 desenhada **pra** ter crispEdges, e não têm contorno de 2px pra perder: a trava
passou a acusar o que estava certo.

Hoje ela pergunta o que sempre quis perguntar — **nenhuma REGRA QUE ALCANCE UM `.selo`** pode
devolver o crispEdges — e continua acusando quando ele volta pro selo (conferido religando o
defeito). É a mesma família de trava-que-envelhece que este arquivo já registra meia dúzia de vezes.

### ⚠️ O SUBMARINO AFUNDADO NÃO TINHA ONDE PÔR O ADVERSÁRIO (22/09/2026) — CONSERTADO EM 23/09

> **⚠️ ISTO É HISTÓRIA: ele foi consertado em 23/09/2026** — ver o bloco no fim desta seção. O que
> ela continua valendo é a MEDIÇÃO: ela é a razão pela qual nenhum dos dois caminhos sozinho
> resolvia, e é ela que explica por que o conserto precisou de arte NOVA.

Reportado com print: *"o Gengar parece nao estar posicionado corretamente no chão? Ele esta na
parede ... a maioria esta correto, mas este não"*. **O relato estava certo**, e por um dia esta
seção existiu pra dizer POR QUE o defeito ficava.

#### A MEDIÇÃO: ele é o único dos 51

A cena põe o pé do jogador em 84% da altura e o do adversário em **64%**, iguais nos 51 — e o
cenário é que tem que ter chão ali. Medida nos atlas, na coluna do adversário (78%), a folga entre
o pé e a linha do horizonte:

| cenário | horizonte | folga do pé (64%) |
|---|---|---|
| campo_aberto, hangar_gelado, tundra | 55% | **+9** |
| vulcao, arena_suspensa | 49% | +15 |
| dojo_tradicional | 50% | +14 |
| mina_subterranea | 58% | +6 |
| deserto | 63% | +1 |
| **submarino_afundado** | **72%** | **−8** |

Medida fina na coluna dele: o piso metálico só clareia a partir de **68%**; de 58% a 67% é a parede
com os canos e a escotilha. Era ali que o Gengar aparecia — e a confirmação foi visual, com a cena
de verdade (o `fighterHtml`, o cenário e o sprite, a 320px) contra Campo Aberto, Hangar Gelado e
Dojo.

#### ⚠️ POR QUE NÃO DÁ PRA CONSERTAR PELA POSIÇÃO

**O cartão do jogador começa em 65,8% da altura** — ou seja **acima** dos 68% em que o piso começa.
Não existe altura que ponha o pé no chão sem invadir o cartão. Medido, na cena real (280×330):

| variante | sobre o CARTÃO | sobre o POKÉMON do jogador |
|---|---|---|
| pé 73%, right 4% *(a tentativa que foi pro ar)* | **1.667px²** | 0 |
| pé 73%, right 30% | 1.508px² | 0 |
| pé 73%, right 45% | 582px² | **805px²** |
| pé 73%, right 58% | 0 | **1.758px²** |
| **pé 64% (como está)** | **0** | **0** |

**Mover pra a esquerda só troca de vítima**, e a posição de hoje é a única com zero conflito nos
dois lados — porque o layout foi desenhado pra o adversário ficar exatamente ali.

#### ⚠️ E PELO RECORTE CUSTA A ARTE

Com o rodapé do tile ancorado, o horizonte aparente é `1 − 0,28k`. Pra levá-lo de 72% a 60% seria
preciso **k = 1,43** — **~40% da imagem cortada**, e o que sai é o topo: as escotilhas, os canos e a
lanterna, que são a identidade do cenário. E os atlas são **PNG prontos, sem gerador**: não há de
onde regerar o desenho com o piso mais alto.

*(A tentativa de recorte nem chegou a rodar: com `background-size` ampliado, a `background-position`
que eu calculei passou a mostrar o TILE VIZINHO — a caverna de cristais no lugar do submarino. Fica
dito pra quem for tentar: a posição precisa ser recalculada junto com a escala, não herdada.)*

#### O QUE ACONTECEU, E A LIÇÃO

**Uma correção pela posição foi ao ar e voltou no mesmo dia.** Ela pôs o pé em 73% (`bottom:27%`),
escolhida comparando 36/30/27/25/23 na cena real — e na tela do jogador ela **cobriu o cartão**:
*"agora o gengar ficou em cima do quadro, ficou ruim"*. Foi revertida com `git revert`.

**⚠️ O ERRO DE MÉTODO FOI ESCOLHER PELO OLHO SEM MEDIR O OUTRO LADO.** Eu medi onde o piso começa
(68%) e testei as alturas visualmente, mas **não medi onde o cartão começa** (65,8%) antes de
escolher — e é esse número que dizia, de antemão, que nenhuma altura serve. Na prévia a
sobreposição parecia tolerável; na tela real, não. **Quando um ajuste tem dois limites, medir só um
deles é escolher no escuro.**

**Se um dia for pra valer, o caminho é REDESENHAR o tile** (subir a linha do piso na arte, no PNG),
não mexer na posição — e aí o cenário volta a caber no layout dos outros 50.

#### ⚠️ E O COMENTÁRIO DA TABELA FOI CORRIGIDO, mesmo sem o conserto

Ele afirmava que *"cada cenário reserva chão livre"* nas duas alturas — e era essa afirmação que
fazia ninguém procurar a exceção. Hoje ele traz a medição inteira e a razão de o defeito ficar.
**Um defeito conhecido e escrito é melhor que um defeito conhecido e calado** — e é o que separa
esta seção de um TODO.

#### ⚠️ ELE FOI CONSERTADO EM 23/09/2026, PELOS DOIS CAMINHOS QUE ESTA SEÇÃO APONTAVA

O arquivo de referência (`index-novos-graficos.html`) trouxe **as duas coisas juntas**, e é por isso
que ele coube: a posição do pé virou **POR CENÁRIO** (`TERRAIN_BATTLE_FOOTING`, 51 entradas de
`[jogadorX, jogadorY, adversárioX, adversárioY]`) **e** o submarino ganhou um **tile REDESENHADO**.

**A medição inteira desta seção continua valendo como história** — ela é a razão pela qual nenhuma
das duas sozinha resolvia: com a posição fixa, não havia altura possível; com a posição por cenário
mas a arte antiga, o piso continuaria começando em 68%.

Medido no navegador a 320px, no submarino: o adversário põe o pé em **70%** (era 64% fixo) e o
jogador em 82%, os dois **sobre o convés** — e a sobreposição entre sprite e cartão fica em **ZERO**
nos dois lados.

### ⚠️ O VISUAL NOVO DA BATALHA, COLHIDO DO ARQUIVO DE REFERÊNCIA (23/09/2026)

Pedido assim: *"adicionei umas mudanças na tela de batalha no arquivo index-novos-graficos.html,
esse arquivo ta desatualizado de algumas mecanicas, como o login anonimo, entao só altere o visual
da batalha como o cenário do terreno e as movimentações dos sprites conforme esse html, nao altere
mais nenhuma mecanica"*.

**⚠️ O ARQUIVO DE REFERÊNCIA É UM RAMO ANTIGO DO MESMO `index.html`** (39.906 linhas contra 40.499),
então o diff entre os dois é quase todo **REMOÇÃO**: o que falta nele é mecânica recente (o login
anônimo, a travessia das Ilhas aberta, o `CAMPOS_DA_CONTA` novo). Trazer o diff inteiro seria
**desfazer** essas features. O que veio foi a colheita seletiva do que é VISUAL — e o que sobrou no
diff depois dela são exatamente as 21 mudanças de mecânica que **não** podiam vir.

**O QUE MUDOU, medido a 320px no navegador:**

| | antes | depois |
|---|---|---|
| altura da cena | 330px (306 no celular) | **384px (368)** — ver o ajuste do dia, abaixo |
| painel do lutador | 56% (54 no celular) | **50%** |
| palco do sprite | 36% | **40%** |
| sprite do JOGADOR | `max-width:83,3%` × 1,2 | **60% × 1,75** |
| sprite do ADVERSÁRIO | sem regra (1,0) | **68% × 1,55** |
| posição do pé | FIXA nos 51 | **por cenário** |
| cenários dedicados | nenhum | **3** (submarino, termas, colmeia) |

**⚠️ OS DOIS `max-width` FORAM ESCOLHIDOS PRA CAIR NO MESMO LUGAR, e vale saber porque não parece:**
o `max-width` é medido **ANTES** da escala, então `60% × 1,75` e `68% × 1,55` dão os **mesmos ~95px**
de largura desenhada. Ou seja todo sprite sai com a mesma largura e só a ALTURA varia com a
proporção dele — é a escolha do arquivo de referência, e ela achata a diferença de tamanho entre as
espécies que o quadro de 96px preservava.

**⚠️ E O `transform-origin:50% 100%` É O QUE FAZ A ESCALA SER SEGURA:** ela cresce a partir dos PÉS,
então o sprite sobe em vez de afundar no chão — a posição do pé continua sendo a que a tabela diz.
Sem ele o bicho cresceria pro centro e entraria no piso.

#### ⚠️ AS IMAGENS FICARAM EM ARQUIVO, E ISSO CONTRARIA O ARQUIVO DE REFERÊNCIA

Ele traz os fundos **embutidos em base64** (20,11 MB), e o comentário dele diz que é pra *"o cenário
não ficar verde quando um atlas externo falta"*. **A medição de 22/09 que os tirou de lá continua
valendo, e ela é grande:** embutidos, o **gzip de toda abertura do jogo iria de 799 KB para ~15 MB**
— e o `index.html` **nunca devolve 304** (ver a seção de Deploy), ou seja isso cairia em todo jogador
em toda abertura, inclusive em quem nunca vê a cena.

**E o problema que o embutido resolveria já está resolvido**: a cor de espera (`#8bbb62`) que nasceu
naquela mesma medição.

**⚠️ O QUE VEIO FOI O FORMATO: os atlas viraram WebP.** Medido: os seis vão de **14,0 MB (PNG) pra
11,7 MB — 17% menos**, com as MESMAS dimensões. Mais as três cenas dedicadas (3,54 MB), o conjunto
fica em **15,08 MB** em `assets/batalha/`.

**⚠️ E O CUSTO POR JORNADA FOI REMEDIDO, porque os números velhos caducaram nos dois sentidos** (o
PNG virou WebP e as cenas dedicadas nasceram):

| | antes | agora |
|---|---|---|
| cada atlas | 2,26 MB | **1,92 MB** |
| arquivos distintos em 9 batalhas | 4,79 | **5,15** |
| **por jornada, na PRIMEIRA vez** | ~10,8 MB | **9,61 MB** |

**⚠️ QUEM TEM CENA DEDICADA NÃO BAIXA O ATLAS DELE**: as duas regras alcançam a mesma cena com a
mesma especificidade, então a dedicada (que vem depois) vence o `background-image` — e o navegador
só pede a imagem da regra que venceu. É por isso que a conta não é "6 atlas + 3 cenas".

#### OS TRÊS AJUSTES PEDIDOS NO MESMO DIA

Depois de ver a cena, três pedidos em sequência:

1. ***"jogar o sprite do pokemon adversario um pouco para a direita"*** — o X dele andou **+4 pontos
   em todos os 51**, somado ao valor de cada um. **⚠️ NÃO É UM X FIXO**: as posições foram afinadas
   uma a uma (cada cenário tem chão num lugar), e cravar um número jogaria fora essa afinação.
   Somando, a diferença relativa entre eles fica de pé.
   ⚠️ **E ELE VOLTOU 2 PONTOS no mesmo dia** (*"coloque o pokemon e a sombra dele um pouco para a
   esquerda"*), ou seja o saldo é **+2**. Medido: o centro do adversário fica entre **69,5% e
   75,4%** da cena, **nenhum sprite sai** nos 51 e a sobreposição com o cartão continua **ZERO**.
   ⚠️ **O POKÉMON E A SOMBRA ANDAM JUNTOS POR CONSTRUÇÃO** — os dois leem a MESMA variável
   (`--battle-enemy-x`): o palco em `left:calc(X − 20%)` e a sombra em `left:X`. Medido, o empurrão
   de 1% que a sombra tem por cima (a média do pé) se preserva: ela continua a **−2px** do centro
   da caixa do sprite nos 51.
2. ***"diminuir a altura do quadro da luta em 20%"*** — **480 → 384px** (e 460 → 368 no celular).
   ⚠️ **Só a altura**: a largura da cena nunca foi tocada — ela é 100% do container, como sempre foi.
3. ***"mover a sombra do adversario para a esquerda e subir ela um pouco para ficar no pé"*** — ver
   o bloco abaixo, que é o que tem número.
   ⚠️ **A metade "PRA CIMA" CADUCOU no mesmo dia**: ela era um `margin-top` num elemento que deixou
   de existir — hoje a sombra é um `::after` do próprio sprite e cai no pé por construção (ver **A
   SOMBRA CRESCE COM O POKÉMON**). O empurrão lateral continua, em outra unidade.
4. ***"o pokemon adversario ... faz uma animação de ir para baixo e depois ir reto ... consegue
   colocar para a animação ir reto e depois descer?"*** — a troca é de **ORDEM**, não de valor: os
   dois destinos (−38% e 26px) são os mesmos, e o que muda é qual eixo sai primeiro. Medido
   congelando a animação: `0% (0,0) → 20% (−38%, 0) → 45% (−38%, 26px)`, e a 320px o sprite **não
   sai da cena** em passo nenhum.
   ⚠️ **O JOGADOR NÃO FOI TOCADO** — ele continua subindo e só então atravessando, que é a mesma
   forma vista do outro lado da câmera (ele vai PRA LONGE, e por isso também encolhe).
5. ***"coloque o sprite do pokemon adversario só um pouco mais para cima"*** — o Y dele subiu **2
   pontos** nos 51, somado ao valor de cada um (a mesma regra do X).
   ⚠️ **QUEM SOBE É O PÉ, não o sprite solto** — e é isso que faz a sombra ir junto: ela lê a MESMA
   variável (`--battle-enemy-y`). Subindo só o sprite, ele voltaria a flutuar acima dela, que é
   justamente o que o ajuste anterior consertou. Medido: a sombra continua em `dy=1px` do pé.
   **E ele ainda LIMPOU o resto de sobreposição**: a maior entre sprite e cartão nos 51, com o
   Snorlax e o Dragonite, foi de **125px² para ZERO**.

**MEDIDO DEPOIS DOS CINCO, a 320px, nos 51 terrenos com os DOIS MAIORES sprites do jogo** (Snorlax e
Dragonite): a sobreposição entre sprite e cartão é **ZERO**, **zero** sprites saem da cena e **não há
rolagem lateral** (documento em 320 de 320).

#### ⚠️ A SOMBRA DO ADVERSÁRIO: 15px PRA CIMA TÊM CAUSA, 2% PRA ESQUERDA SÃO UMA MÉDIA

**A vertical não era a sombra — era o VOADOR.** Quem voa (`.air`) ganha `padding-bottom:10px` no
wrap, e o sprite do adversário é ampliado 1,55× — então esses 10px viram **15,5px** de folga entre o
pé dele e o chão. A sombra marca o CHÃO; o pé fica acima dela. Medido: sombra no y=256 e pé no
y=241. **E só o `.air` precisa disso**: no `.water` o sprite não leva padding e o pé já cai em cima
da ondinha (desvio de meio pixel).

**⚠️ A HORIZONTAL É ARTE, E A DISPERSÃO É GRANDE — este é o número honesto da mudança.** A sombra é
centrada na **CAIXA** do sprite, e o pé de cada bicho não fica no centro da caixa dele. Medido em
**20 sprites**, varrendo os pixels opacos da folha:

| | desvio do pé em relação ao centro do quadro |
|---|---|
| **média** | **−4,6%** (ou seja, pra a esquerda) |
| pior pra a esquerda | −22% (Dragonite, Gyarados, Arcanine, Mewtwo) |
| pior pra a direita | **+22% (Blastoise)**, +18% (Alakazam) |

**⚠️ E ELE NASCEU COM A MÉDIA INTEIRA E VOLTOU METADE NO MESMO DIA.** O sprite desenha ~106px numa
cena de 243px, então os 4,6% são **~2% da cena** — e a 2% foi reportado na hora: *"a sombra passou
um pouco o corpo do pokémon"*. Faz sentido, e é a dispersão cobrando: pra quem tem o pé à **direita**
do centro da caixa (Blastoise +22%, Alakazam +18%), andar a média inteira pra esquerda tira a sombra
de debaixo do bicho.

Hoje ele é **1% da cena** — metade. Medido: o desvio do centro da caixa vai de **−5px para −2px**, e
o pé continua na altura certa (dy=1px). **Ele acerta o caso comum sem estourar o outro extremo**, e
continua errando nos dois: acertar cada um exigiria uma tabela de pé POR ESPÉCIE, que é outra
feature.

**⚠️ E O `%` DO `margin-left` RESOLVE CONTRA A CENA** (o bloco que contém é o `.battle-fighter`, que
é `inset:0` dela), enquanto o `left`/`right` do `::after` resolve contra o **PALCO** — que é 40% da
cena. Por isso os mesmos 2% viram `-11%` num e 5 pontos no outro.

**O jogador não foi tocado** (medido: desvio 0 em x e em y, antes e depois).


#### ⚠️ SÓ O PRIMEIRO CONFRONTO PARECIA AJUSTADO — E A CAUSA ERA A ESPÉCIE (23/09/2026)

Reportado assim: *"somente o primeiro confronto que esta com o sprite do pokemon mais para cima ...
numa luta o gyarados tava mais pra cima, ele morreu e entrou um raichu, e ai o raichu ficou mais
pra baixo"*.

**⚠️ O ESTILO DA CENA ERA IDÊNTICO NOS ONZE CONFRONTOS, e isso foi a primeira coisa medida** —
`enemy-y=67%` em todos, numa batalha de verdade renderizada confronto a confronto. Ou seja o
ajuste PEGOU em todos: o que mudava era **a espécie**.

**Quem VOA leva `padding-bottom:10px` no wrap** (é o que faz o pokémon pairar), e como o sprite do
adversário é ampliado **1,55×** esses 10px viram **15,5px** de altura a mais. O **Gyarados é
Água/VOADOR** e o **Raichu é Elétrico** — o relato descreve exatamente isso. Medido nas 250:
**37 voam**, 12 são aquáticas e 201 ficam no chão, então a diferença ia e vinha de confronto pra
confronto sem nada na tela explicando.

**O CONSERTO SÃO DOIS PASSOS QUE ANDAM JUNTOS**, e um sem o outro devolve o defeito:

1. a `TERRAIN_BATTLE_FOOTING` subiu **4 pontos** nos 51 (67→63 no caso comum) — que é a altura em
   que o voador já estava, e é a que foi pedida;
2. o **levantamento por espécie saiu do lado do adversário** — senão o voador ficaria 15px acima de
   todo mundo de novo, só que mais alto ainda.

E a **compensação de 15px da sombra saiu junto**: ela existia SÓ por causa do levantamento (a
sombra subia pra alcançar o pé). Com o levantamento fora, ela poria a sombra 15px **acima** do pé —
os dois andam juntos nos dois sentidos, e há trava pra isso.

**⚠️ O JOGADOR NÃO FOI TOCADO, e é decisão:** ali o levantamento continua valendo e nunca foi
reportado — o quadro de baixo tem o chão muito mais perto, então os 17,5px dele (10 × 1,75) se leem
como o pokémon pairando, não como um confronto diferente do outro.

**MEDIDO DEPOIS, a 320px:** Gyarados e Raichu no **mesmo pé (62,8%)** no campo aberto e no deserto,
com a sombra em `dy=0` nos dois. Varrendo os 51 terrenos com os dois maiores sprites do jogo: o pé
do adversário cai em **62,8 / 63,8 / 64,8%** (as três faixas afinadas), a sobreposição com o cartão
é **ZERO**, ninguém sai da cena e não há rolagem lateral.

**⚠️ E O QUE ISSO CUSTOU FOI MEDIDO ANTES DE ESCOLHER O LADO.** Havia duas saídas — trazer o voador
pra baixo ou levar todo mundo pra cima —, e elas dão pixels diferentes: a primeira põe o pé na
linha que a arte tinha, a segunda o sobe 15px. Conferido no navegador nos cenários de horizonte
mais apertado (deserto, mina subterrânea, dojo): a **63% o pé ainda cai no chão desenhado**, então
a segunda coube — e ela é a que o relato pede.

#### ⚠️ E O HARNESS ENCONTROU UMA ARMADILHA QUE VALE PRO JOGO: `el.style` DERRUBA O FUNDO

Sondando a altura no navegador eu fiz `cena.style.setProperty('--battle-enemy-y','63%')` — e o
**cenário sumiu**. A causa: qualquer escrita em `el.style` **RE-SERIALIZA o atributo inteiro**, e o
navegador põe **espaço depois de cada dois-pontos**. O `--battle-atlas:0;` vira `--battle-atlas: 0;`,
o seletor `[style*="--battle-atlas:0;"]` para de casar e o fundo fica vazio **sem erro nenhum**.

Conferido no navegador, o atributo depois do `setProperty`:
`--battle-player-x: 24%; ... --battle-atlas: 0; ...`

**Hoje nada no jogo faz isso** (o único ponto que escreve `style` na cena escreve em elementos que
ele mesmo CRIA), e o aviso ficou no comentário do `terrainBattleSceneStyle`. **E não adianta mexer
num ancestral**: as quatro variáveis estão inline no próprio elemento, e inline ganha de herança —
quem precisar sondar tem que fazer por REGRA de CSS.


#### ⚠️ A SOMBRA CRESCE COM O POKÉMON (23/09/2026)

Pedida assim: *"você consegue crescer o tamanho da sombra de acordo que fique proporcional ao
tamanho do pokémon?"*.

**⚠️ E A PRIMEIRA COISA MEDIDA FOI SE HAVIA O QUE CRESCER — havia, e muito.** A sombra era
**42px pra TODO MUNDO** (o `.battle-sprite-stage::after` era `left:28%;right:28%` de um palco de
largura FIXA), e o sprite desenhado varia bastante. Medido a 320px em 20 espécies:

| | sprite desenhado | sombra | razão |
|---|---|---|---|
| **Caterpie** | **56px** | 42px | **0,75** |
| Pikachu | 78px | 42px | 0,54 |
| Abra, Geodude, Vulpix | 93–96px | 42px | 0,45 |
| **Onix, Snorlax, Raichu, Arcanine** | **100px** | 42px | **0,42** |

O bichinho tinha uma sombra **quase da largura dele** e o grandão uma que **não chegava à metade**.

**⚠️ O QUE FAZ ELA SER PROPORCIONAL É ELA MUDAR DE DONO, e isso não é detalhe de onde escrever a
regra: nenhum dos três elementos que desenhavam a sombra sabe o tamanho do bicho.** O palco é 40%
fixo da cena e o `.battle-ground-base` é **irmão** dele — os dois são grandezas da CENA. Quem tem
a largura do POKÉMON é o **`.battle-sprite-wrap`**, que ABRAÇA a imagem (medido bicho por bicho: a
largura dele é exatamente a largura desenhada do sprite).

Hoje a sombra é um **`::after` do wrap**, com `left`/`right` em % dele. E como o wrap está DENTRO
do `.battle-status-host`, que é escalado (**1,75** no jogador e **1,55** no adversário), ela é
escalada junto — que é exatamente o que "proporcional ao tamanho" quer dizer.

**MEDIDO DEPOIS, nas mesmas 20 espécies: a razão ficou CONSTANTE em 0,580** (0,579 do lado do
jogador, 0,584 do adversário — a diferença é o arredondamento da escala). A sombra do Onix foi de
42 pra **58px** e a do Caterpie de 42 pra **32px**.

- **⚠️ O `aspect-ratio` É O QUE FAZ A ALTURA ACOMPANHAR.** Uma altura em `%` resolveria contra a
  **ALTURA** do wrap, e aí um sprite alto e fino ganharia uma sombra alta; uma em px não cresceria
  com o bicho. Com a razão fixa a elipse guarda a forma em qualquer tamanho — **6:1**, que é a
  razão que a sombra de contato já tinha, e **4,5:1** na ondinha de quem nada, que sempre foi mais
  gorda.
- **⚠️ E O `translateY(50%)` A CENTRA NA LINHA DO PÉ**, que é onde as três variantes antigas
  ficavam — as três tinham `margin-top` de metade da própria altura, e o `bottom:-3px` do palco
  fazia o mesmo. Sem ele a sombra fica inteira ACIMA do pé. Medido: `dy = 0,0` nas 20.
- **⚠️ E QUEM VOA CONTINUA COM A SOMBRA NO CHÃO de graça, sem uma exceção sequer:** o `.air` põe
  `padding-bottom:10px` no wrap, e `bottom:0` resolve contra o **PADDING box** — ou seja abaixo da
  imagem, que é onde o chão está. Medido: **dy = 17,5px** (10 × 1,75) no jogador, e **0,0** no
  adversário, onde esse levantamento é zerado desde o relato do Gyarados × Raichu. Os dois casos
  saem da MESMA regra.
- **⚠️ E ELA É ESCOPADA NA `.battle-scene` de propósito.** O `battleAnimatedSpriteHtml` é exclusivo
  da cena hoje — conferido: o caminho antigo usa o `spriteHtml`, que não emite o wrap —, mas ele é
  uma **FUNÇÃO**: reusado noutra tela, um `::after` sem escopo poria uma sombra lá sem ninguém ver.

**⚠️ E O `.battle-ground-base` VIROU SÓ O PORTADOR DA CLASSE.** Ele não desenha mais nada, e as
duas âncoras de posição dele saíram junto (elas liam o footing pra posicionar um elemento que hoje
é `display:none` — letra morta). **Ele fica no HTML**, porque é ele que diz, pelo combinador `+`,
se a espécie voa, nada ou anda no chão: tirar o elemento derrubaria as duas regras que dependem
disso.

**⚠️ E O EMPURRÃO PRA ESQUERDA DO ADVERSÁRIO MUDOU DE UNIDADE, o que o deixa mais certo do que
era:** ele agora é uma variável em **% do SPRITE** (`--sombra-dx:-2.3%`), que é a unidade em que
ele foi MEDIDO — o pé desvia −4,6% da largura do **QUADRO** do bicho, e ele é metade disso. Antes
ele era traduzido pra % da CENA (1%), ou seja **todo tamanho de sprite recebia o mesmo empurrão em
pixels**, quando a medição diz que ele é uma fração do bicho. Medido agora: de **−1,3px** no
Caterpie a **−2,3px** no Onix. A sombra do jogador não anda (o padrão da variável é 0).

**CONFERIDO QUE O CAMINHO ANTIGO NÃO MUDOU, e por duas medições:** o HTML das 16 telas dele sai
**byte a byte igual** (mesmo hash), e no navegador ele tem **ZERO `.battle-sprite-wrap`** — ou
seja a regra nova não tem por onde alcançá-lo.

**No motor, nada:** `MOTOR 5130995a7232 / DIARIO 416ea6822949`, idêntico em 900 batalhas semeadas.

#### AS ESPADINHAS SAÍRAM DO FUNDO DA CENA (23/09/2026)

Reportado: *"no fundo dos cenários ainda está exibindo aquele símbolos de espadinhas que exibia no
modo antigo, retire"*. Elas vinham do arquivo de referência como uma **marca d'água no centro**
(`opacity:.18`) — e com o cenário desenhado atrás, elas são mais um desenho no meio da luta.

**⚠️ O ELEMENTO CONTINUA NO HTML, e tem que continuar:** no caminho ANTIGO ele é o **× entre os
dois lutadores** — e é nele que o 🌧️ da Dança da Chuva se pendura —, e o **Boss de Domingo**, a
**Seleção**, o desafio por **código de treinador** e o **online** seguem naquele desenho. Quem
esconde é o escopo `.battle-vs.battle-scene`: a cena é a exceção, não o contrário. Medido no
navegador, lado a lado: no antigo o `.vs-swords` é `display:block` (26×27px) e na cena é `none`.

A trava tem as **duas metades** — a cena esconde E o caminho antigo continua mostrando. Sem a
segunda, esconder sem escopo passaria e quatro telas perderiam o ×.

#### ⚠️ O QUE O PORT CUSTOU E NÃO ESTAVA PEDIDO: O NOME DO TREINADOR TRUNCA

Com o painel indo de 54% pra 50% no celular, o nome do treinador **passa a cortar quando o time tem
6 pokébolas**. Medido a 320px: "Buzzo" precisa de 32px e tem **29** — sai `BUZ...`. O lado do
adversário (4 pokébolas) não corta. **Se incomodar, a régua é uma linha**: o painel de volta a 54%
no `@media`.

#### NO MOTOR, NADA — e o instrumento é sensível

**`MOTOR 5130995a7232 / DIARIO 416ea6822949`, idêntico** ao build de antes em 900 batalhas semeadas
— e a mesma medição com o `CRIT_BASE` mexido muda os dois hashes, que é o que impede um hash imóvel
de não provar nada. Tudo isto é CSS, uma tabela de posição e apresentação.

#### AS TRAVAS: `tools/test-terrenos.js` GANHOU A CENA

⚠️ **O QUE ELAS EXISTEM PRA PEGAR É O DEFEITO QUE NÃO DÁ ERRO**: o fundo sai de um **seletor de
atributo** (`[style*="--battle-atlas:0;"]`), então um espaço a mais depois dos dois-pontos, um
ponto-e-vírgula que sumiu ou um arquivo com o nome trocado fazem o cenário sair **VAZIO** — sem erro
no console, sem quebrar teste nenhum, e a tela continua desenhando os dois lutadores sobre a cor de
espera. É a família da classe fantasma e do `[hidden]` que não vence o `display`.

São 15 pontas, e as que importam:

- **toda imagem que o CSS pede existe em disco** — um nome trocado é um cenário mudo;
- **cada um dos 51 casa com EXATAMENTE UMA regra de imagem** — zero é cenário vazio, duas do mesmo
  tipo é a arte de um terreno aparecendo noutro;
- **as dedicadas vêm DEPOIS das do atlas** e **sobrescrevem o `background-size`** (elas são a cena
  inteira, não um slot de uma folha 3×3);
- **todo terreno tem posição PRÓPRIA na tabela** (nenhum cai no padrão) e **o pé do adversário fica
  ACIMA do do jogador** nos 51 — a câmera é frontal, e invertido os dois trocam de profundidade;
- **no lado do adversário, quem voa NÃO é levantado** — é a trava do relato do Gyarados × Raichu, e
  ela anda em par com *"a compensação de 15px da sombra saiu junto"*;
- **TODA leitura das quatro posições no CSS tem valor padrão** (16 leituras) — cenário que saia da
  tabela um dia volta ao comportamento antigo em vez de ficar sem chão.

**Conferido que os 9 defeitos religados acusam.** E duas lições saíram daí:

1. **⚠️ O `:not(...)` TEM QUE SAIR ANTES DE LER OS SELETORES**, e foi ele que derrubou a primeira
   versão: a regra do atlas 1 é **DUPLA** — ela vale pra quem tem `--battle-atlas:1;` E pra quem
   **não tem a variável nenhuma**. Lido cru, o `[style*="--battle-atlas:"]` de dentro do `:not` é
   substring de TODOS os 51, e a trava acusava os 42 de uma vez.
2. **⚠️ UMA TRAVA MINHA MEDIA FRACO**: ela pedia que **ALGUÉM** lesse a posição com valor padrão — e
   há duas regras por variável, então tirar o padrão de uma passava em branco. A regra é que **TODA**
   leitura tenha.

#### ⚠️ E O HARNESS DA PRÉVIA INVENTOU UM DEFEITO DUAS VEZES

1. **A primeira prévia saiu SEM POKÉMON NENHUM** — as cenas certas, os painéis certos, e nenhum
   sprite. Não era o jogo: o **`createInstance` devolve `hp:0/maxHp:0`** (quem enche a barra é o
   `calcMaxHp`), então os dois lados entravam com hp 0, o `fighterHtml` os marcava como **MORTOS** e
   o `battle-fainted` os apagava. É a mesma família do `preservePlayerHp` que cura o time B.
2. **E a medição de "rola pro lado" acusou 12px que eram meus**: o harness dava `width:320px` ao
   `.app` DENTRO de um body que já tem a margem do jogo. Com ele em `auto`, o documento fica em
   **320 de 320**.

⚠️ **E A JANELA DO CHROME NÃO DESCE ABAIXO DE ~500px**: pedir 320 devolve uma janela maior e o
`innerWidth` continua grande — a medição sai certa e **descrevendo outra largura**. O que mede 320 de
verdade é um **iframe de 320px**.

### A CENA CHEGOU NA TORRE, NA LIGA E NO GINÁSIO DA CIDADE (22/09/2026)

Três pedidos em sequência, no mesmo dia: *"na torre dos treinadores, pode deixar o cenário sendo
sempre o dojo, porém sem os atributos que o dojo proporciona"* e *"as batalhas das ligas e ginásio
da cidade também fique nesse modelo de gráfico novo"*.

**O GINÁSIO DA CIDADE JÁ ESTAVA PRONTO, e isso não é sorte:** o desafio dele passa pelo MESMO
`renderBattling` da jornada (`game.battleResultContext === 'neighborhoodGym'`), que só troca o
rótulo e o terreno. Ele entrou junto com a jornada e usa o `game.neighborhoodGymBattleTerrain` —
conferido na tela.

#### ⚠️ A TORRE LUTA SEMPRE NO DOJO, e é SÓ o cenário

`CENARIO_DA_TORRE = 'dojo_tradicional'`, passado direto pro `terrainBattleSceneStyle`.

**E ele não dá bônus nenhum por CONSTRUÇÃO, não por cuidado:** quem pinta o fundo é o
`terrainBattleSceneStyle`, que só devolve variáveis de CSS (qual atlas e que pedaço dele recortar).
O 1,15× vem do `applyTerrainBuff`, no motor, e ele é chamado por quem **MONTA** a batalha.
**Conferido nos DOIS motores:** as chamadas do cliente são `runSpecialBattle`, `runBattle`,
`resolveTrainersLeagueMatch` e `resolveLeagueMatch` — nenhuma é a Torre; e no servidor o
`fightTrainerTowerFloor` tem **ZERO** chamadas. Não havia o que desligar: o id do dojo aqui é uma
**coordenada de imagem**, não um terreno.

**E o selo 🔺 continua fora** porque os dois `fighterHtml` seguem com `comTerreno:false` — ele
prometeria um bônus que esta batalha não dá, que é a mesma regra pela qual ele já não aparecia lá.

**⚠️ SÓ A TORRE, e a distinção importa:** o `renderTrainerBattling` serve **QUATRO** telas — a
Torre, o **Boss de Domingo**, a **Seleção** da Ilha Kumquat e a batalha por **código de treinador**
(que é também a reprise de um desafio do Ginásio da Cidade). O pedido nomeia a Torre, então o
cenário é ligado pelo `towerBattlePending` e os outros três seguem no desenho antigo — conferido:
das 16 telas medidas, só as duas da Torre com admin mudaram. Pra estendê-lo a eles, é tirar esse
termo da conta do `cenaNova`.

#### A LIGA ASSISTIDA, e o que ela já fazia por fora

Ela é a única das telas de batalha que montava os lutadores **INLINE**, sem passar pelo
`fighterHtml` — por isso ela tinha ficado de fora da primeira leva. No ramo da cena ela passou a
usar o `fighterHtml` como todas as outras; **o bloco antigo foi preservado inteiro no `else`**, então
quem não é admin recebe o HTML de hoje byte a byte.

- **O terreno dela é REAL** (a liga tem terreno escolhido), então a cena usa o `w.terrain` de
  verdade e o 🔺 continua honesto — ao contrário da Torre, que é só cenário.
- **⚠️ E O SELO DO TERRENO TROCOU DE FONTE, o que é um conserto de graça:** o bloco inline
  recalculava o buff na mão (`playerSp.types.some(t => w.terrain.types.includes(t))`) — uma cópia da
  regra do `applyTerrainBuff`. O `fighterHtml` lê o **`m.playerBuffed`**, que é a flag que o próprio
  motor gravou. Conferido que ela existe no log guardado: o `storeMatchLogAndStrip` grava os
  `matchups` inteiros, o campo é de **28/08/2026** e os logs de liga são podados em 48 ciclos
  (~2 dias) — ou seja **nenhum log no ar é velho o bastante pra não ter o campo**.
- **E a liga ganhou os selos DESENHADOS:** o bloco inline ainda usava os emojis crus `🌟` e `🎖️`,
  esquecidos quando os emojis viraram desenho em 18/09. No ramo da cena eles saem pelo `selo()`,
  como no resto do jogo.

#### ⚠️ O LAÇO DE REVELAÇÃO NÃO PRECISA SABER QUEM TEM CENA

Os quatro laços agora chamam o `animarGolpeNaCena`, **sem `if` nenhum**: ele sai na primeira linha
quando não acha um `.battle-vs.battle-scene` na tela. Um teste no chamador seria uma segunda regra
dizendo a mesma coisa — e ela envelheceria no dia em que o Boss ou a Seleção também ganhassem
cenário.

#### O QUE FOI MEDIDO

| | |
|---|---|
| Torre: telas medidas nos dois builds | **14 de 16 idênticas** — só as duas do admin mudaram |
| Liga + Ginásio da Cidade | **4 de 8 idênticas** — só as quatro do admin mudaram |
| o dojo cai no atlas certo | atlas **1**, recorte `0% 0%` — e **não** é o fallback (o `campo_aberto` é `50% 0%`) |
| selo de terreno na Torre | **zero**, nas duas fases |
| motor | `MOTOR 47d16bcb4c3f / DIARIO 053483c8b60c`, **idêntico** em 900 batalhas semeadas |
| baterias | **36 de 36** passam |

### A PESCARIA LUTA NO MANGUEZAL (22/09/2026)

Pedido junto do resto: *"online não precisa, e na pescaria coloque apenas o cenário do manguezal,
sem colocar os atributos"*.

`CENARIO_DA_PESCARIA = 'porto_abandonado'` — o **"Manguezal"** da tabela `TERRAINS` (Água/Inseto),
que cai no **atlas 3**. É a mesma decisão do dojo da Torre, e pelo mesmo motivo: **o
`terrainBattleSceneStyle` só devolve variáveis de CSS**, e o 1,15× vem do `applyTerrainBuff` — que a
pescaria **nunca chamou**. Não havia o que desligar; o id aqui é uma **coordenada de imagem**.
E o **selo 🔺 continua fora** porque os dois `fighterHtml` daqui não passam `comTerreno`: sem ele o
selo nem é montado. Medido: **zero** `#s-terreno` nas duas fases.

#### ⚠️ E ELA FOI A ÚNICA QUE PRECISOU MEXER NO PINTOR — por causa do GIF

O `pescariaPintarArea` trocava o **`innerHTML` inteiro** do `#pescBatalhaVs` a cada passo. Isso
**recria os `<img>`** — e um GIF recriado **volta pro primeiro quadro**: o sprite ficaria preso no
começo do laço, com um tranco a cada golpe.

**⚠️ ISSO NÃO EXISTE NA JORNADA, e a diferença é de CADÊNCIA — não de desenho.** Lá o passo é
**PINTADO** e o `render()` só roda nos passos marcados (`cura`/`faixa`/`leitura`/`troca`/`posFaixa`);
aqui o pintor roda em **TODO** passo. Medido em 400 confrontos 1x1 (2.058 passos):

| | reconstruções do sprite |
|---|---|
| **jornada** | **0 de 2.058** (0,0% dos passos) |
| **pescaria, sem o conserto** | **2.058 de 2.058** — 5,14× por confronto |

E a tela antiga podia se dar ao luxo de refazer, porque o sprite dela é um **PNG parado**.

**Hoje só o que MUDA por passo é repintado:** o `.battle-mon-panel` (nome, selos, barra) e a
**classe** do lutador — é ela que carrega o `battle-fainted`. O palco do sprite fica de pé, e os
ícones de status têm pintor próprio.
**Medido no navegador**, com as duas estratégias sobre a mesma marcação: com o `innerHTML` inteiro o
`<img>` é **OUTRO elemento em 3 de 3** passos; assim ele é **o MESMO nos 3** — e o painel atualiza
igual nos dois, com a grade e a camada de efeitos vivas dos dois jeitos.

**⚠️ E COM A ESTRUTURA DIFERENTE ELE REFAZ TUDO:** a vaga vazia do Remoinho não tem painel, e sem
essa saída o quadro ficaria com o painel de quem acabou de ser soprado pra fora.

**⚠️ E A GRADE E A CAMADA DE EFEITOS MORAM NO `pescariaLutadoresHtml`**, não no container: o pintor
troca o miolo, então qualquer filho que ficasse só no render seria destruído no primeiro golpe.

#### ⚠️ E ELA DERRUBOU TRÊS TRAVAS QUE MEDIAM A FORMA, NÃO A REGRA

As três estavam certas e caíram com o código certo — a família que este arquivo já registra quatro
vezes:

| trava | por que ela envelheceu |
|---|---|
| *"o quadro usa o fighterHtml da casa"* (`class="fighter"` ×2) | o fixture chama `contaAdmin()`, que **LIGA o gate** — ela passou a medir a cena. Hoje o bloco **desliga o gate** pra medir o visual de quem não é admin, e a cena entra **ao lado**, pela mesma função |
| *"com o sprite GRANDE da batalha"* (`sprite-lg`) | idem |
| *"pela MESMA função que o render monta"* | **fatia por OFFSET**: `slice(i, i + 1600)` — o bloco da cena empurrou o que ela procura pra **fora da janela**. Hoje ela fatia a **função inteira**, com um `ok` cobrando que a fatia tem o que ler |

A segunda metade dessa última cravava `id="pescBatalhaVs">${pescariaLutadoresHtml(b)}` como string
crua, e o atributo ganhou o `cenaNova` — hoje ela lê a **linha** do render e procura só a chamada.

**Conferido que as travas novas acusam:** gate desligado **2 falhas**, cenário trocado **1**, o
pintor refazendo o quadro inteiro **2**.

**⚠️ E A PRIMEIRA CONFERÊNCIA DO TERCEIRO DEFEITO DEU ZERO, e o errado era ela:** a injeção comeu o
`}` do `if(vs){`, o teste **estourou** com `SyntaxError` e o `grep -c FALHOU` leu isso como *"passou
em branco"*. É a lição que este arquivo já registra — **uma trava que estoura é pior que uma que
falha** —, agora do lado da ferramenta de acusação: confira que o defeito **compila** antes de
acreditar num zero.

#### ⚠️ O QUE CONTINUA FORA

Só o **online** (`renderOnlineFight`/`renderOnlineCountdown`), e não é teimosia: ele depende do
refactor `virarMatchup`, que **não é gateável** — ele muda o que o lado B vê pra TODO MUNDO. A
medição está na seção acima.

### ⚠️ A CHAVE FOI ABERTA: A CENA É DE TODO MUNDO (22/09/2026)

Pedido no mesmo dia, horas depois de ela subir: *"pode tirar que só quem tem admin=true consegue ver
a nova tela"*. `visualNovoDeBatalha()` passou a devolver **`true`**.

- **⚠️ ELA CONTINUA SENDO UMA FUNÇÃO SÓ, e é isso que a mudança comprou de volta:** voltar atrás é
  **uma linha**. É o molde do `MOSTRAR_TM_HM` — que já foi puxado e devolvido uma vez — e do
  `BOSS_ATIVO`. Trocar os **nove** pontos de leitura por um `true` escrito em cada um seria o
  caminho sem volta, e o próximo ponto nasceria sem a chave.
- **⚠️ E O CAMINHO ANTIGO NÃO VIROU LETRA MORTA, o que é o que permite deixá-lo de pé:** ele
  continua desenhando o **Boss de Domingo**, a **Seleção** da Ilha Kumquat, o desafio por **código de
  treinador** e o **online** — os quatro que não ganharam cenário. Não havia o que apagar.
- **NO MOTOR, NADA:** `MOTOR 47d16bcb4c3f / DIARIO 053483c8b60c`, idêntico em 900 batalhas semeadas.
  E **37 de 37** baterias passam.

#### ⚠️ O CUSTO QUE ABRIR ISTO CRIOU, MEDIDO — ele era ZERO e deixou de ser

Enquanto a cena era de admin, o resto do jogo **não pagava um byte**: `background-image` de uma regra
que ninguém casa não é requisitada. Agora todo jogador baixa os atlas conforme cada batalha desenha.

| | |
|---|---|
| cada atlas | **~2,26 MB** (2,36 / 2,36 / 2,26 / 2,33 / 2,35 / 1,88) — ⚠️ **1,92 MB desde 23/09**, quando eles viraram WebP |
| os 6 juntos | **13,54 MB** |
| atlas distintos numa jornada de 9 batalhas | **4,79 em média** (5 em 47% delas, os 6 em 18%) |
| **por jornada, na PRIMEIRA vez** | **~10,8 MB** — ⚠️ **9,61 MB desde 23/09** (WebP + as 3 cenas dedicadas) |

**⚠️ E ELES REVALIDAM DE VERDADE, ao contrário do `index.html`.** Medido em produção: o PNG vem com
`Cache-Control: max-age=3600` e, com `If-None-Match`, devolve **304 com 0 bytes em 67 ms** — contra
os 486 KB e ~1,1 s que o `index.html` baixa **em toda abertura** por nunca devolver 304 (ver a seção
de Deploy). Ou seja o custo é a **primeira** baixada de cada atlas, e ela é espalhada: um atlas por
vez, quando a batalha daquele terreno desenha, e não um bloco no carregamento.

**Se um dia incomodar**, as réguas são: um `headers` pra `/assets/**` com `max-age` longo (tira a
revalidação de hora em hora, que hoje custa 67 ms), recortar os atlas em imagens menores por terreno
(hoje é uma folha 3×3 pra 9 terrenos, então baixa-se 9 cenários pra usar 1), ou a própria chave —
que é a linha que devolve tudo ao que era.

#### ⚠️ E A JANELA DE CARREGAMENTO MOSTRAVA UMA CAIXA VAZIA — a regressão que a extração criou

A regra de cada atlas **SUBSTITUI** o `background-image`, então o gradiente de céu-e-grama que a
regra base declara como fallback **nunca aparecia**. Medido no navegador: o `background-color` da
cena era **`rgba(0,0,0,0)`** e o do pai é **`rgb(254,251,240)`** — ou seja, enquanto os 2,26 MB não
chegavam, o que se via era **o creme da caixa com os dois lutadores boiando nele**.

**⚠️ ISSO NÃO EXISTE NO ARQUIVO DE ORIGEM, e é por isso que consertar não é desviar dele:** lá os
atlas são **base64 dentro do CSS**, ou seja vêm com a folha de estilo e não há janela nenhuma. A
janela é consequência da extração pra arquivo — que é a decisão que poupou **15,0 MB de gzip por
abertura** pra todo jogador (ver acima).

O conserto é **uma linha** (`background-color:#8bbb62`, o verde da metade de baixo do próprio
gradiente de fallback): durante a carga vê-se um campo, não um quadro vazio.
**⚠️ E ELE NÃO ENCOSTA NO ACOPLAMENTO DO ATLAS** — conferido no navegador, `background-position`
segue `50% 0%` e `background-size` segue `300% 300%`, e a cena depois de carregada sai idêntica.
Mexer no `background-size` pra empilhar o gradiente como segunda camada daria um placeholder mais
bonito e **tocaria justamente as duas propriedades que o seletor `[style*="--battle-atlas:N;"]`
acopla** — não valeu o risco por menos de um segundo de tela.

### O PLACAR E OS SELOS ENTRARAM NO PAINEL DO LUTADOR (22/09/2026)

Dois pedidos em sequência, e eles resolvem o mesmo desconforto: com o cenário atrás, **tudo que
estava fora do quadro passou a parecer solto**.

#### O TREINADOR E AS POKÉBOLAS

*"Durante a batalha, exibe aqueles quadros com o nome dos treinadores e as pokebolas representando
quantos pokemons eles ainda tem. Vamos agora colocar essas informações dentro do quadro com o nome
do pokemon durante a batalha, o nome e as pokebolas."*

Eles viviam numa **fileira própria acima da cena** (o `team-alive-row` com dois `team-alive-chip`),
e com o cenário ela virou a única coisa fora dele: a batalha acontecia dentro do quadro e o placar
ficava olhando de fora.

- **⚠️ A REGRA É "UM LUGAR SÓ", e é ela que o teste cobra — não a posição.** Onde a cena desenha, o
  placar mora no painel e a fileira **sai**; onde ela não desenha (o **Boss**, a **Seleção**, o
  desafio por **código** e o **online**), a fileira fica e o painel nem existe. Emitir os dois seria
  dizer a mesma coisa duas vezes na mesma tela.
- **⚠️ O PAINEL SÓ GANHA O PLACAR QUANDO O CHAMADOR MANDA** (`op.treinador`): quem não manda desenha
  byte a byte como antes. É isso que deixa as duas formas conviverem sem um `if` por tela.
- **⚠️ AS POKÉBOLAS ENCOLHEM AQUI, e não é estética:** o painel tem ~158px de conteúdo a 320px, e as
  de 13px do chip somam **93px** com os vãos — sobrariam ~59px pro nome, meia dúzia de letras. Em
  **9px** elas somam 64px e o nome fica com ~88px. Quem cede espaço é o **NOME** (ele trunca); as
  pokébolas são a informação — a mesma regra do chip de cima.
- **A contagem segue a fase** (`antes` durante a luta, `depois` no fim), a mesma do chip. Na
  **pescaria** isso ainda comprou uma coisa: quem repintava o placar do fim era o ramo `b.fim` do
  `pescariaPintarArea`, e agora ele vem junto do painel, que o pintor já repinta a cada passo.

**MEDIDO A 320px, o mesmo confronto nos dois builds:**

| | antes | depois |
|---|---|---|
| altura da caixa da batalha | 510px | **452px** (**−58px, −11%**) |
| a fileira de cima | 48px | **0** |
| o painel | 88px | 109px (dentro da cena, que é de altura fixa) |
| sobreposição painel × sprite | — | **0% dos dois lados**, nas quatro telas |

#### OS SELOS AO LADO DO NOME

*"Os status que o pokemon ta tendo, como queimado, buff pelo terreno, shiny, deixe ao lado do nome,
hoje esta exibindo numa linha embaixo do nome do pokemon durante a tela de batalha."*

Eles eram uma linha própria (`battle-mon-badges`) embaixo do nome — e ali se liam como uma segunda
informação, quando o que eles são é um **adjetivo do pokémon escrito ao lado**. Hoje a linha do nome
é `[Nome] [selos] ......... [Lv.60]`.

- **⚠️ `flex-wrap:nowrap` + `flex-shrink:0` nos selos:** sem os dois, uma luta com queimadura +
  veneno + fúria empurrava os selos pra uma segunda linha e **o painel crescia no meio da batalha**,
  com o cenário atrás dele. Quem cede é o nome, que já truncava.
- **DE QUEBRA O PAINEL ENCOLHEU 5px** (109 → 104), porque a linha dos selos deixou de existir.

**⚠️ E O PIOR CASO QUE DÁ MEDO É TEÓRICO — medido em 19.650 quadros de batalha real:**

| selos ao lado do nome | |
|---|---|
| **nenhum** | **91,54%** |
| um | 8,11% |
| dois | 0,35% |
| **quatro ou mais** (onde o nome começa a sofrer) | **0,00%** — o maior visto foi **2** |

Com os três "permanentes" (shiny + terreno + especialidade) o nome **cabe inteiro** a 320px
("Venusaur ⭐🔺🎖️ Lv.60", conferido no navegador). Com cinco ele vira "V." — e esse é o caso que a
medição diz que não acontece. **Se um dia acontecer**, a régua é o tamanho do selo dentro do painel.

**NO MOTOR, NADA:** `MOTOR 47d16bcb4c3f / DIARIO 053483c8b60c`, idêntico em 900 batalhas semeadas.

#### ⚠️ E DOIS EXTRATORES DE TESTE ENVELHECERAM JUNTO

| trava | por que ela caiu |
|---|---|
| *"o placar de pokébolas em cima"* (pescaria) | ela media a **POSIÇÃO**. Hoje cobra a regra: o placar existe, um por lutador, e a fileira de cima saiu |
| *"com o placar de quem esta de pe ANTES do canto"* (jornada) | ela fatiava a tela por **`team-alive-chip`** pra achar o lado do Buzzo — sem chip, o `find` casava com a tela INTEIRA e ela contava as pokébolas dos **dois** lados ("4 vivas, 1 pretas"). Hoje ela fatia por `id="battle-fighter-`, com o chip como fallback |

**⚠️ E A SEGUNDA TEM UMA ARMADILHA QUE VALE GUARDAR: o primeiro pedaço do `split` é descartado.** Ele
é tudo que vem ANTES do primeiro lutador — com a fileira de cima de volta, ele conteria os dois
chips e a conta sairia dos dois lados de novo.

#### ⚠️ E A PRÉVIA MOSTRAVA OS SELOS VAZIOS — a lição que este arquivo já registra

A primeira captura saiu com a linha do nome **sem ícone nenhum**, e não era o código: o
`montarSelos()` injeta o `<svg>` dos símbolos no `document.body` **de verdade**, e a prévia é montada
pelo sandbox, que não tem body. Todo `<use href="#s-x">` sai **vazio, do tamanho certo** — então a
MEDIÇÃO de largura estava certa e a TELA parecia quebrada.
A prévia passou a injetar o `svgDosSelos()` na mão (79 símbolos). **É a mesma nota que a seção do
anúncio das Ilhas já carrega**, e ela custou uma rodada aqui de novo.

### A CHUVA CAINDO NA CENA (24/09/2026)

Pedida assim: *"Quando tiver acontecendo a dança da chuva, voce consegue colocar um efeito de chuva
no cenário? Como se tisse chovendo ao fundo?"*.

**⚠️ A DANÇA DA CHUVA JÁ TINHA TRÊS COISAS NA TELA** (a frase, a linha do log e o 🌧️ em cima do ×) —
e **as três são TEXTO**: elas contam que está chovendo. Com o cenário desenhado atrás dos lutadores
desde 22/09, o clima passou a ser a única condição de batalha que **não se vê**. Esta é a quarta, e
é a única que se lê sem ler.

#### ⚠️ ELA VEM DO MATCHUP, NUNCA DE ESTADO GLOBAL

```js
function chuvaDaCenaHtml(m){
  if(!m || !m.chuva) return '';
  return '<div class="battle-chuva atras"></div><div class="battle-chuva frente"></div>';
}
```

O `m.chuva` é a MESMA fonte do emoji e do selo, e a razão dela existir é a de sempre aqui: **o log é
relido dias depois**, e ali o `chuvaRestante` já não existe. Lendo o estado, um confronto de ontem
choveria porque está chovendo HOJE — ou não choveria tendo chovido.

- **⚠️ E ISSO DÁ DE GRAÇA O QUE OS CONFRONTOS 2 E 3 PRECISAVAM.** A frase só sai no confronto que
  ATIVOU a chuva (*"somente na batalha que foi ativada"*, o pedido de 11/09), então nos dois
  seguintes o que restava era o emoji. Agora eles chovem.
- **Confronto gravado antes do campo sai seco**, como sempre saiu — log velho não pode sumir.
- **⚠️ E NÃO HÁ GUARDA DE CENA, de propósito:** a função é chamada de DENTRO do ramo que desenha a
  cena, nas cinco telas. Uma segunda pergunta ali seria a mesma regra escrita duas vezes.

#### SÃO DUAS CAMADAS, E O QUE AS SEPARA É O POKÉMON NO MEIO

| | ladrilho | gotas nele | passo por ciclo | duração | velocidade | z-index |
|---|---|---|---|---|---|---|
| **trás** | 84×126 | 23 | (−84, 252) | .76s | **332 px/s** | **2** |
| **frente** | 60×90 | 7 | (−60, 180) | .36s | **500 px/s** | **7** |

**⚠️ É O z-index QUE PÕE O BICHO DENTRO DA CHUVA em vez de na frente de um papel de parede.** A pilha
da cena é grade=1, lutadores=0, impacto=2, palco do sprite=5, efeitos=8, painel e número de dano=10:
a de **trás** fica atrás do pokémon e a da **frente** passa na frente dele — **e as duas ficam abaixo
do número de dano e do painel**, porque chuva por cima deles esconderia justamente o que o jogador
está lendo naquele instante.

- **AS DUAS CAEM COM A MESMA INCLINAÇÃO** (3, ou seja 252/84 = 180/60): é o mesmo vento. A de trás
  cai mais devagar porque ela está longe — é a paralaxe que dá profundidade, e há trava cobrando a
  ordem (invertida, a chuva longe correria mais que a de perto).
- **⚠️ O ÂNGULO DO GRADIENTE NÃO É A INCLINAÇÃO: é `atan2(dy,dx)`, e a conta engana.** No CSS a
  DIREÇÃO do gradiente é `(sin A, −cos A)` e **a faixa de cor sai PERPENDICULAR a ela** — pra a faixa
  ficar paralela ao caminho da gota, `tan A = dy/dx`. Com inclinação 3 isso dá **108,4deg** (o CSS
  usa 108), e não os 251,6 que uma leitura direta da direção pede. A trava confere a conta, e
  **módulo 180**: A e A+180 desenham a MESMA faixa.

#### ⚠️ A PARTE QUE NÃO APARECE EM PRINT NENHUM: O CICLO TEM QUE FECHAR

**O `render()` recria o `innerHTML` inteiro, e com ele TODA animação de CSS reinicia** — é o mesmo
motivo pelo qual o GIF do sprite volta ao primeiro quadro, que a Pescaria já pagou em 19/09. E o
render acontece nos passos marcados da animação, ou seja **várias vezes por confronto**.

O que salva é o desenho ser **ladrilhado** e o passo ser um número **INTEIRO de ladrilhos**: o quadro
final é idêntico ao inicial, então **o recomeço é invisível**. Com um passo que não fosse múltiplo do
ladrilho, a chuva daria um **pulo a cada redesenho**.

**⚠️ E ISSO PEGOU UM DEFEITO REAL, QUE O OLHO NÃO PEGARIA: a 2ª camada da FRENTE tinha ladrilho 56×42
com passo (−28, 84).** `28/56` não é inteiro — então **só ELA** pularia, no meio de uma chuva em que
todo o resto fecha. Um pulo de uma camada de 32% de opacidade, num quadro, num celular: só a conta
acha. O passo foi pra (−56, 168) e a duração de .28 pra .34s.

**⚠️ E A SEGUNDA METADE É O OPOSTO: NENHUM SUB-PASSO PODE REPETIR O PADRÃO.** Se o padrão já voltar a
ser o mesmo na metade do caminho, a chuva **desliza sobre si mesma e parece PARADA** — que é a
armadilha da linha infinita, o primeiro desenho a ser descartado aqui.

Um padrão ladrilhado `(w,h)` só é invariante pelas translações da rede `{(a·w, b·h)}`, então as duas
coisas são **uma conta e não uma opinião**: com passo `(dx,dy)` e camadas `(w_i,h_i)`, existe
sub-passo invariante se e só se o **mdc de todos os `dx/w_i` e `dy/h_i` é maior que 1**. Medido: nas
duas camadas ele é **1** — zero sub-passos invariantes.

- **A FOLGA DO `inset` COBRE UM CICLO INTEIRO** (`-260px -96px` atrás, `-190px -70px` na frente),
  senão a borda de cima aparece **vazia** no fim dele. O que sobra é clipado pelo `overflow:hidden`
  da cena, então a folga é de graça.
- **⚠️ O MOVIMENTO É `transform`, NUNCA `background-position`:** aquele é composto na GPU e este
  **REPINTA a camada inteira a 60fps**, do tamanho da cena, num celular. Há trava.
- **E ela não recebe toque** (`pointer-events:none`): duas camadas por cima da cena tapariam os
  cliques dela.

#### ⚠️ É DESENHO, NÃO IMAGEM — e o custo é o argumento

A regra da casa é que **nenhuma imagem vem de fora** (dois episódios de hotlink que funcionavam
local e morriam publicados), e a lição dos atlas é mais forte: **o `index.html` é baixado INTEIRO em
toda abertura**, porque o Hosting nunca devolve 304 pra ele. Um PNG embutido entraria nessa conta.

| | |
|---|---|
| o arquivo | 2.680.848 → **2.690.706 bytes** (+9.858, quase tudo comentário) |
| **o que TRAFEGA (gzip)** | **849,5 → 852,2 KB — +2.806 bytes** |
| e **zero** quando não chove | a função devolve string vazia: nem as camadas existem no DOM |

#### O QUE FOI MEDIDO

**Medido a 320px, no navegador, com e sem chuva:** o documento fica em **320 de 320** (sem rolagem
lateral), a cena tem a **MESMA altura nos dois casos (368px)** — as camadas são `position:absolute`,
então elas não empurram nada —, e o texto do painel do lutador fica entre **15,24 e 16,48:1** de
contraste **por cima da chuva**, contra o mínimo de 4,5 do AA. Ela é atmosfera; ela não disputa a
leitura com o que importa.

**NO MOTOR, NADA:** `MOTOR e6cd16d15e0f / DIARIO 1e9b7214c627`, **idêntico ao HEAD** em 900 batalhas
semeadas — e o instrumento é sensível (com o `CRIT_BASE` mexido os dois hashes mudam). Isto é CSS,
uma função de apresentação e cinco interpolações.

**⚠️ E O `test-especiais` FALHOU UMA VEZ EM QUATRO RODADAS**, no flake que este arquivo já nomeia
desde 17/09 (*"NINGUÉM ataca com a barra em zero"*, sempre no par `Charmeleon × Mankey`). Ele **não
é sinal de regressão**, e a perna mais barata da prova é a que resolveu aqui: **o diff não encosta em
uma linha do que a trava lê** — zero ocorrências de `sequenciaDoConfronto`, `passosVisiveis`,
`fraseDoEspecial`, `doExchange`, `calcDamage`, `marcarCriticos`, `fatiaDoGolpe`,
`buildAnimatedHitSequence` e `simulateGymBattle` nas 76 linhas mexidas. Mais a impressão idêntica e
3 rodadas limpas em seguida.

- **Se um dia incomodar**, as réguas são a **densidade** (as células do gerador), a **opacidade** das
  faixas de peso e a **duração** — e mexer no passo obriga a refazer a conta do ciclo, que é o que a
  trava cobra. Tirar a chuva inteira é uma linha no `chuvaDaCenaHtml`.

`tools/test-terrenos.js` ganhou **17 asserções**, e todas leem os números **do `index.html`**
(escritos no teste, ele mediria a si mesmo): as duas camadas existindo, o passo sendo inteiro em TODA
camada, o mdc, o ângulo pela conta, a folga do inset, os dois z-index, `transform` e não
`background-position`, a mesma inclinação nas duas, a de trás mais devagar, o `pointer-events`, a
função só emitindo com `m.chuva`, as duas camadas, e — a que importa — **TODA tela que desenha a cena
chamando a chuva**, contado contra o **número de cenas** e não contra um 5 escrito ali, que
envelheceria na sexta.
**Conferido que os 13 defeitos religados acusam.**

#### ⚠️ E ELA NASCEU COM LISTRAS, QUE É O QUE `linear-gradient` SABE FAZER (24/09/2026)

Reportado no mesmo dia: *"os traços da chuva tão muito contínuo, seguindo o mesmo padrão, deixe
aleatório e correndo na diagonal para dar impressão de chuva mesmo"*.

**⚠️ E A CAUSA NÃO É AJUSTE, É O QUE A FERRAMENTA PRODUZ: `linear-gradient` só faz listra
INFINITA.** Ela atravessa o ladrilho de ponta a ponta e **EMENDA com a do vizinho** — o comprimento
do traço fica preso ao tamanho do ladrilho, e ladrilho pequeno (que é o que o ciclo pede, pra o
salto do recomeço ser pequeno) é justamente o que faz a emenda. Não existe `linear-gradient` que
dê traço curto: o que se vê é sempre uma **grade de riscos contínuos**.

**Hoje cada camada é um LADRILHO SVG com gotas curtas**, e o ladrilho continua sendo ladrilho — é
ele que sustenta a conta do ciclo. **O que mudou foi o desenho DENTRO dele, não a mecânica.**

| | antes | **hoje** |
|---|---|---|
| o desenho | 2 `linear-gradient` por camada | um **ladrilho SVG** por camada |
| o traço | **atravessa o ladrilho** e emenda | **17% dele** (trás) e 37% (frente) |
| as posições | uma listra por ladrilho, em fileira | **jitter em grade**, uma gota por célula |
| trás | ladrilho 20×8 e 40×24 | **84×126**, 23 gotas, passo (−84, 252), .76s |
| frente | 28×14 e 56×42 | **60×90**, 7 gotas, passo (−60, 180), .36s |
| velocidade | 333 / 494 px/s | 332 / **500** px/s |
| gzip | +1.749 bytes | **+1.057** |

#### ⚠️ JITTER EM GRADE, NUNCA SORTEIO UNIFORME PURO

Uniforme puro **AGLOMERA** — buracos grandes e três gotas coladas —, e **o olho lê aglomerado como
padrão tanto quanto lê fileira**. Uma gota por célula, deslocada dentro dela, dá a aparência de
acaso sem a aparência de grade — desde que o jitter cubra a célula inteira.

- **⚠️ E O WRAP É OBRIGATÓRIO: a gota que sai por uma borda tem que REENTRAR pela oposta.** Sem ele
  sobra uma faixa vazia em volta do ladrilho e a repetição vira **uma grade de corredores** — o
  padrão que este desenho existe pra tirar. Só as cópias que podem tocar o ladrilho são desenhadas
  (o SVG recorta o resto), então isso custa uma ou duas por gota, não nove. Há trava.
- **O desenho é GERADO e semeado** (o gerador vive no scratchpad), como os selos: o que vai pro
  jogo é o resultado. Regerar com a mesma semente dá o mesmo desenho.

#### ⚠️ O CUSTO CAIU 4,2× AGRUPANDO AS GOTAS — e isso não é só byte

`stroke-width` e `opacity` escritos em **cada** gota são quase metade do arquivo. Com um `<g>` por
faixa de peso e **UM `<path>` com vários subcaminhos** dentro dele, o atributo sai uma vez por
faixa: medido, **10,1 KB → 2,4 KB** na mesma densidade.

**⚠️ E ELA CONTINUA SENDO DESENHO, não imagem:** a regra da casa (nenhuma imagem de fora) mais a
lição dos atlas — um PNG embutido entraria na conta do `index.html`, que é baixado **INTEIRO em
toda abertura** porque o Hosting nunca devolve 304 pra ele.

#### ⚠️ E A TRAVA NOVA PEGOU UM DEFEITO MEU NA PRIMEIRA VEZ QUE RODOU

Arredondar as coordenadas pra inteiro (a otimização de bytes) **entorta a inclinação das gotas
curtas**: com `dx` e `dy` arredondados em separado, um traço de 10px sai com `10/3 = 3,33` em vez
de 3 — e num traço desse tamanho o erro se vê. **2 das 33 gotas** da camada de trás estavam tortas.

O conserto não custa um byte: **`dy` é DERIVADO do `dx`** (`dy = -dx × k`), e aí a inclinação é
exata pra qualquer `dx` inteiro.

#### AS TRÊS TRAVAS QUE O PEDIDO CRIOU

Elas leem o SVG do `index.html`, decodificam os paths e medem o desenho — não um número escrito no
teste:

| | o que ela impede |
|---|---|
| **o desenho são GOTAS, nunca listras de `linear-gradient`** | a regressão literal do relato |
| **nenhuma gota atravessa o ladrilho** | atravessando, ela emenda com a do vizinho e **vira listra** — o critério é estrutural, não um limiar de gosto |
| **toda gota cai na MESMA inclinação do passo** | desenhada noutra, o risco atravessa a trajetória em vez de segui-la — a gota anda de lado |
| **a gota da borda REENTRA pela oposta** | o corredor vazio que vira grade |

**⚠️ E AS DUAS QUE MEDIAM O ÂNGULO DO GRADIENTE NÃO FORAM APAGADAS: elas viraram as da inclinação
das GOTAS.** A conta do `atan2` continua registrada acima porque ela é a lição do
`linear-gradient`; o que ela media deixou de existir quando o desenho mudou de ferramenta.

#### O QUE FOI MEDIDO

**A 320px, no navegador, com e sem chuva:** documento em **320 de 320** (sem rolagem lateral), a
cena com a **MESMA altura nos dois casos (368px)**, **2 camadas com chuva e ZERO sem**, z-index 2 e
7, `pointer-events:none` nas duas, e o texto do painel do lutador em **16,47:1** de contraste
(o mínimo do AA é 4,5).

**NO MOTOR, NADA:** `MOTOR e6cd16d15e0f / DIARIO 1e9b7214c627`, idêntico ao HEAD em 900 batalhas
semeadas.

- **A densidade é a régua, e ela foi escolhida OLHANDO** — quatro níveis comparados lado a lado na
  cena real, a 320px. A escolhida é a mais rala das quatro (**23 gotas por ladrilho na de trás, 7
  na da frente**): ela lê como chuva e deixa o cenário e os pokémon respirarem.
  Mexer nela é mexer nas `colunas`/`linhas` do gerador, e o custo em bytes anda junto.
- **⚠️ E O QUE NÃO SE MEXE SEM REFAZER A CONTA é o PASSO**: ele tem que continuar sendo um número
  inteiro de ladrilhos, e nenhum sub-passo pode repetir o padrão. As duas coisas são cobradas pela
  trava, lendo os números do arquivo.

**Conferido que os 15 defeitos religados acusam.**

#### ⚠️ ELA SEGUE A DANÇA DA CHUVA, E ISSO FOI MEDIDO (24/09/2026)

Pedido assim: *"garanta que o efeito de chuva só começa quando tem dança da chuva e quando acabar o
efeito da dança da chuva, também acaba o efeito de chuva no cenário"*.

**⚠️ A MECÂNICA JÁ ESTAVA CERTA — e a garantia é a MEDIÇÃO, não uma correção: o `index.html` e o
`functions/index.js` não mudaram um caractere.** O que entrou foram **9 travas** que rodam batalhas
de verdade e comparam o campo `m.chuva` (de onde a cena sai) com as **marcas do DIÁRIO** — ou seja
a fonte da TELA é conferida contra a fonte do MOTOR:

| marca | o que ela diz |
|---|---|
| `x:'chuva'` | a chuva **começou** neste confronto |
| `x:'chuvafim'` | este foi o **último** debaixo dela |

**O QUE FOI MEDIDO:**

| | |
|---|---|
| com Dança da Chuva no time | **3.789 confrontos** em 900 batalhas, **752 chovendo** (19,8%) |
| confrontos que mostram chuva **fora** de um trecho | **ZERO** |
| confrontos **dentro** de um trecho que saem secos | **ZERO** |
| **sem ninguém que dance** | **0 de 4.229** confrontos chovem |
| a cena discordando do campo | **ZERO** |
| maior trecho visto | **3** confrontos — exatamente o `CHUVA_EM_CONFRONTOS` |

#### ⚠️ O CASO DELICADO É A CHUVA SAIR DUAS VEZES, E O PAINEL COMUM NÃO O PRODUZ

Ela **pode** sair mais de uma vez na mesma batalha (acabados os 3 confrontos, o portador que entrar
no seguinte sorteia de novo) — e aí existe um **BURACO de confrontos secos** entre os dois trechos.
É nele que um *"acabou mas continua chovendo"* apareceria.

**Medido: 0 em 900 batalhas do painel comum.** Ou seja ele **não exercita** o caso — a trava passaria
em branco sobre ele. Por isso há um painel **FORÇADO**: seis dançarinos de cada lado, que é o que faz
a batalha ser longa e o dado rolar muitas vezes.

| no painel forçado (2.500 batalhas) | |
|---|---|
| batalhas com **dois trechos** | **1.129** |
| confrontos **secos** entre eles | **2.016** |
| deles chovendo na cena | **ZERO** |
| o 2º trecho começando seco | **ZERO** |

#### ⚠️ E O VAZAMENTO ENTRE BATALHAS TEM PAINEL PRÓPRIO

O `chuvaRestante` é variável de **MÓDULO**, e no servidor a instância é reaproveitada entre
invocações: uma batalha **cortada com chuva no ar** deixaria a próxima começando debaixo dela —
**sem Dança da Chuva nenhuma**, que é exatamente o que o pedido proíbe. Quem fecha isso é o
`limparClima()`.

Medido em **80 batalhas cortadas com chuva no ar**: **zero vazamentos**. E a trava cobra que o
painel **tenha** esses casos — sem isso ela daria verde medindo um conjunto vazio.

#### ⚠️ E O SERVIDOR GRAVA IGUAL — porque a LIGA ASSISTIDA desenha a cena a partir do log DELE

Não é zelo: se os dois motores divergirem, **a mesma partida chove numa tela e não chove na outra**
— e o log da liga é justamente o que ninguém confere depois. Medido em **400 batalhas com a mesma
semente**: **1.549 confrontos, 440 chovendo, ZERO divergências**.

**⚠️ E O CAMPO É SEMPRE UM BOOLEANO**, nunca `comChuva || undefined` (que foi como ele nasceu). No
cliente o `undefined` é inofensivo pro Firestore; no **servidor** o Admin SDK recusa a gravação
**INTEIRA** — foi assim que as duas ligas morreram de 11 a 13/09/2026. Do lado do servidor quem
cobra é o `test-liga-treinadores` (conferido: o defeito religado derruba **6** travas lá); aqui se
cobra o do cliente, que é o que vai pro save.

**Conferido que os 7 defeitos religados acusam** — e eles são no **MOTOR da chuva**, não no desenho,
que é a única forma de provar que estas travas medem a REGRA e não a aparência: o campo sempre
ligado, sempre desligado, a chuva que nunca acaba, o clima vazando entre batalhas, o campo lido
ANTES da luta (o confronto em que ela nasce sairia seco), o `undefined` e a cena desenhando sempre.

**⚠️ E O QUINTO PRECISOU SER REESCRITO PRA COMPILAR:** movido de qualquer jeito ele dava
`SyntaxError` e a trava acusava **morrendo** — e *"acusa morrendo"* prova menos que *"acusa
medindo"*, porque não distingue uma trava que mede a regra de uma que só não roda.

**⚠️ E O FLAKE DO `test-especiais` APARECEU DE NOVO** (1 falha em 4 rodadas, o par
`Charmeleon × Mankey` que este arquivo nomeia desde 17/09) — **e aqui a prova de que não é
regressão é a mais forte que existe: o diff não toca UMA linha do jogo.** Ele é
`tools/test-terrenos.js` e este arquivo, e mais nada. Mais a impressão idêntica e 3 rodadas limpas
em seguida.

### ⚠️ O QUE FICA EM ABERTO

- ~~**A janela do `ehAdmin`**~~ — ela era o risco de uma batalha rodar antes de a conta carregar e
  sair no desenho antigo pra um admin. **Ela morreu quando a chave foi aberta**: a cena não depende
  mais de nada assíncrono. Fica registrada porque ela **volta** no dia em que a chave voltar a
  olhar o campo, e aí o molde é o `contaCarregada` que as outras portas usam.
- **O `id="battle-fx-layer"` é global** e está nas cinco telas com cenário. Hoje é inofensivo — o
  `render()` troca o `innerHTML` inteiro e só existe uma tela de batalha por vez —, mas é o tipo de
  coisa que quebra no dia em que duas convivirem.
- **⚠️ QUANTO A PRIMEIRA BATALHA DE UM TERRENO NOVO DEMORA NUM CELULAR NÃO FOI MEDIDO.** O atlas
  tem ~2,26 MB, ele **só começa a baixar quando a cena desenha** (é `background-image`, não entra no
  `preloadBattleSprites`) e daqui leva **0,36 s** — numa rede de celular é mais. O que a janela
  MOSTRA já está medido e consertado (o item abaixo). Se for pra encurtá-la, o caminho é pôr o atlas
  do terreno no `preloadBattleSprites`, que já roda antes da luta.

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

> **⚠️ ELA VIROU A METADE DE BAIXO DE UMA REGRA MAIOR EM 17/09/2026** — hoje QUALQUER
> atacante para entre 70% e 95% contra um alvo de vida cheia, conforme a diferença de nível (ver
> **VIDA CHEIA NÃO MORRE NUM GOLPE**, logo abaixo). Esta continua valendo por cima, pelo MENOR teto:
> quem raspa para em 70% mesmo com 20 níveis de vantagem, porque o que ela olha é o ESTADO do
> atacante e não o nível.

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

### VIDA CHEIA NÃO MORRE NUM GOLPE (17/09/2026)

Pedida assim: *"quando um pokemon esta de vida cheia, ele nunca morre com um só golpe, invente um
calculo que dependendo da diferença de level entre os pokemons, o de vida cheia ao tomar um golpe
que seria de 100% de hp, vai tomar no maximo 95% e no minimo 70%. Se a diferença entre o level dos
pokemons for maior que 15, ai pode desconsiderar essa regra e matar de primeira"*.

**⚠️ ELA NASCEU DE UM RELATO SOBRE VELOCIDADE**, e vale registrar o caminho: o pedido anterior era
*"o charizard tem uma velocidade bem alta, e tem confrontos que ele leva o time inteiro só porque
começa batendo"*. Medido na época: **um Charizard Lv.60 fazia 2,67 abates por vida** contra seis do
mesmo nível, e o MESMO Charizard com velocidade 60 fazia **1,27** — ou seja, a velocidade dobrava.
E com o revide moribundo de volta ele fazia **1,23**, praticamente o mesmo do lento: **era o revide
que neutralizava a velocidade**, e ele saiu em 15/09. Esta regra ataca o mesmo sintoma por outro
lado — pelo ALVO, e não pelo contra-golpe.

**A CURVA É A VANTAGEM DE NÍVEL**, e ela anda no sentido que o pedido descreve:

| diferença (atacante − alvo) | o alvo fica com | teto |
|---|---|---|
| 0 ou negativa | **30%** | 70% |
| 5 | 21,7% | 78,3% |
| 10 | 13,3% | 86,7% |
| 15 | **5%** | 95% |
| **> 15** | — | **sem trava: mata** |
| **qualquer, se o golpe for CRÍTICO** | — | **sem trava: mata** (23/09, ver abaixo) |

Entre 0 e 15 é linear (`CHEIO_TETO_MIN`, `CHEIO_TETO_MAX`, `CHEIO_DIF_MAXIMA`). **Atacante MAIS
FRACO cai no piso**: um pokémon de nível menor matando um alvo cheio num golpe é o caso mais
absurdo dos dois, então ele cede o máximo.

- **⚠️ ELA É A GENERALIZAÇÃO DO `MORIBUNDO_TETO_NO_CHEIO`** (14/09/2026), que já fazia exatamente
  isto — só que apenas quando o ATACANTE estava raspando. A mecânica de aparo é a mesma (o teto vale
  por TROCA e é repartido entre os tapas, pra a linha do log continuar coerente com o selo `Nx`);
  o que muda é QUANDO ela vale e QUANTO deixa passar.
- **⚠️ E AS DUAS CONVIVEM PELO MENOR TETO, não se substituem.** Elas olham coisas diferentes: aquela
  é sobre o ESTADO do atacante (*"um pokémon muito ferido não deveria aguentar tanto numa luta"*,
  que foi o pedido dela) e esta é sobre a diferença de PODER. **Um atacante raspando com 20 níveis
  de vantagem continua parando em 70%** — deixar a nova liberar o que a antiga proíbe desfaria um
  pedido com o outro. Há trava pra exatamente isso.
- **NÃO É "70% DO DANO"**: um golpe de 800 numa barra de 400 continuaria matando. O que se limita é
  **onde o ALVO PARA**, que é o que o pedido descreve.
- **⚠️ E ELA NÃO É UM TETO DE DANO** (o `DMG_CAP_PCT`, desligado em 09/09): ela só age quando o
  golpe MATARIA. Um golpe que tira 99% e não mata sai inteiro.
  **Consequência conhecida e aceita: isso é descontínuo** — um golpe de 99% deixa o alvo com 1%, e
  um de 101% deixa com 30%. Tirar mais dano pode deixar o alvo com mais vida. É invisível pro
  jogador (ele não sabe qual seria o dano sem o aparo, como no piso mascarado do revide), e o
  `MORIBUNDO_TETO_NO_CHEIO` já tinha essa propriedade desde 14/09.

**⚠️ O PREÇO NA JORNADA É GRANDE E VAI PRO LADO DIFÍCIL: −3,61 pontos de conclusão.**
**57,56% → 53,95%**, **3,6σ** — 8 blocos de 800 jornadas de cada lado (**6.400 de cada**, o MESMO
bot contra duas cópias congeladas, desvio tirado de ENTRE os blocos), com **7 de 8 blocos** pro
lado difícil.

**⚠️ E ISSO CONTRARIA A INTUIÇÃO — a regra PROTEGE, e mesmo assim endurece.** A explicação é a
mesma do `MORIBUNDO_TETO_NO_CHEIO` ao contrário: ela cai dos DOIS lados, mas **quem matava de
primeira era quem estava na frente**, e ao longo de uma fila isso era do jogador tanto quanto do
líder. Sem o abate limpo, cada confronto custa uma troca a mais e o time se desgasta.

**E A FORMA MUDA MAIS QUE O TOTAL** (1.500 jornadas de cada lado):

| ginásio | sem | com | |
|---|---|---|---|
| 1º | 83 | 97 | +17% |
| **5º** | 56 | **97** | **+73%** |
| **6º** | 227 | **321** | **+41%** |
| 7º | 10 | 8 | — |
| **8º** | 236 | **184** | **−22%** |

O meio da jornada aperta e **o 8º ginásio afrouxa**. Faz sentido: no fim os dois lados estão em
nível parecido e a trava protege o jogador tanto quanto o líder; no meio, é o jogador que perdia o
abate limpo com que ele compensava a desvantagem.

**QUANTO ELA APARECE, medido** (mesmos times e mesma semente nos dois builds, 7.764 confrontos):
o primeiro golpe matando de vida cheia vai de **33,80% para 22,95%**. Os ~23% que sobram são
justamente os pares com **diferença acima de 15**, que é a regra.

- **Se um dia incomodar**, as réguas são as três constantes — e a mais forte é a `CHEIO_DIF_MAXIMA`
  (15): baixá-la devolve os abates limpos pra quem tem vantagem de nível, que é o caso mais comum
  do jogador contra rota. Depois vem o `CHEIO_TETO_MIN` (70%).
- `tools/test-especiais.js` tranca 17 pontas: as três constantes, o invariante em **10.632
  confrontos** sorteados (zero mortes com dif ≤ 15), a **curva medida onde a trava AGE** (o alvo
  para no resto EXATO em 4 diferenças), o outro lado da regra em 3 diferenças acima de 15, o alvo
  machucado continuando a morrer, o golpe que não ia matar saindo inteiro, quem RASPA parando em
  70% mesmo com 20 níveis, e as constantes no servidor.


#### ⚠️ O CRÍTICO IGNORA A TRAVA DE NÍVEL (23/09/2026)

Pedido assim: *"se o dano for crítico, para ignorar essa trava de 15 levels de diferença, se for
crítico, pode deixar matar de primeira"*.

**⚠️ ELE LÊ O MESMO CAMPO QUE DECIDE O SELO (`lastCrit`), e essa é a decisão:** se a tela diz
**CRÍTICO**, o golpe mata; se não diz, não mata. Qualquer outra fonte — *"algum tapa foi crítico"*,
por exemplo — deixaria uma troca matar de vida cheia **SEM o selo na tela**, e o jogador não teria
como ligar uma coisa à outra: ele veria um pokémon de vida cheia morrer num golpe, que é
exatamente o que a regra de 17/09 promete que não acontece com dif ≤ 15.
O log já trata o crítico como propriedade da **TROCA** (o `c` do diário sai do mesmo `lastCrit`
pra todas as linhas daquele atacante), então as duas leituras já concordavam por construção.

**A CURVA, medida** (Fearow × Caterpie Lv.20 — os dois sem passiva nenhuma):

| diferença | sem crítico | **com crítico** |
|---|---|---|
| **−5** (atacante mais fraco) | 30,3% | **mata** |
| 0 | 30,3% | mata |
| 5 | 21,7% | mata |
| 10 | 13,1% | mata |
| 15 | 5,1% | mata |
| 16 em diante | mata | mata |

**⚠️ E ELE SÓ DERRUBA A TRAVA DE NÍVEL — a de 14/09, de quem está RASPANDO, continua valendo.** As
duas são regras diferentes: esta olha a diferença de **PODER** e aquela olha o **ESTADO** do
atacante (*"um pokémon muito ferido não deveria aguentar tanto numa luta"*), e um crítico não muda
o fato de que quem bateu está quase morto. Medido: um atacante abaixo de 10% da barra **para em
70% com crítico e 30 níveis de vantagem**. Elas continuam convivendo pelo MENOR teto — o crítico
só apaga um dos dois termos da conta.

**⚠️ E O `lastCrit` PODE ESTAR VELHO quando o atacante NÃO atacou** (dormindo, congelado,
paralisado): quem não atacou não passou pelo `golpesDaTroca`, e o campo dele ficou de uma troca
anterior — ou de outro confronto. É a armadilha do `lastMove` que os seis `tentar*` pagaram em
18/09. Quem fecha essa porta é a **primeira linha do `tetoDeQuemRaspa`** (`if(!golpes.length)
return golpes`), e é por isso que ela existe.

**QUANTO ISSO ALCANÇA, medido** (900 batalhas 6x6, 8.639 confrontos, 28.337 trocas):

| | |
|---|---|
| trocas contra alvo de vida **CHEIA** (a trava chega a valer) | **9.489** — 33,5% das trocas |
| **APARADAS** (o golpe mataria e o teto segurou) | **1.468** — 5,2% das trocas, 17,0% dos confrontos |
| dessas, com o atacante **RASPANDO** (a de 14/09, que fica) | 146 |
| **PASSAM A MATAR** (críticas e o atacante não raspando) | **225** — 15,3% das aparadas, **2,60% dos confrontos** |

**⚠️ O PREÇO NA JORNADA: +1,92 PONTO DE CONCLUSÃO, 3,0σ — fora do ruído, e para o lado FÁCIL.**
**53,75% → 55,67%**, 16 blocos de 800 jornadas de cada lado (**12.800 de cada**, o MESMO bot contra
duas cópias congeladas, desvio tirado de ENTRE os blocos), com **13 de 16 blocos** pro lado do
crítico.

**⚠️ E OS 8 PRIMEIROS BLOCOS DAVAM 2,1σ, que é o limite do ruído — foi DOBRAR a amostra que fechou
a conta.** Vale registrar porque é o oposto do caso de 14/09 que este arquivo guarda (lá 6 blocos
deram 2,1σ e o dobro derrubou pra 1,1σ): **em nenhuma das duas direções meia amostra decide**.

**E A FORMA SE MOVE NO MEIO, não nas pontas** (os 16 blocos somados):

| ginásio | sem | com | |
|---|---|---|---|
| 1º | 621 | 646 | +4% |
| **5º** | 998 | **932** | **−7%** |
| **6º** | 1.856 | **1.711** | **−8%** |
| 8º | 2.369 | 2.309 | −3% |

**⚠️ O MECANISMO NÃO FOI ISOLADO, e é honesto dizer.** A mudança cai dos DOIS lados, então a
direção não é óbvia — e um painel fixo **não responde**: medido num 6x6 com os dois times iguais
ela dá **−12 pontos**, e no mesmo 6x6 com o lado B levando o moveset de NPC ela dá **+13**. É a
mesma lição do *painel forte demais* que este arquivo registra na medição do Smeargle e na do
revide: **o arranjo do painel decide o sinal**, e por isso o número que vale aqui é o da JORNADA,
medido com o bot jogando de verdade.

**Se um dia incomodar, não há constante nova pra mexer: a régua é a própria condição** (`!critico`
no `tetoNoAlvoCheio`). Tirá-la devolve a curva de 17/09 inteira, e a conta de quanto isso vale está
aqui.

#### ⚠️ E ELE OBRIGOU O SELO A PARAR DE SUMIR NA BARRA INTEIRA

**Medido antes de tratar: 42,6% dos golpes que passaram a matar saíam SEM o selo de crítico.** Ou
seja o alvo morria de vida cheia e a tela **não dizia por quê** — a promessa da regra acima ficaria
falsa em quase metade dos casos.

A causa é o `cap` do `aplicarGolpes`, que é de 12/09: ele esconde o selo quando *"o corte comeu a
dobra"* (`efetivo * 2 < sorteado`), porque o selo promete uma barra que caiu o **DOBRO** e num
golpe encolhido ela caiu o que sobrava. O relato daquele dia era um crítico mostrando **−9** ao
lado de um golpe comum de −152.

**⚠️ MAS NUM ALVO QUE ESTAVA CHEIO E FOI A ZERO NÃO HÁ CONTRADIÇÃO NENHUMA:** o número mostrado **É
o maxHp dele** — o maior que existe pra aquele alvo — e a barra caiu **100%**. Os exemplos medidos
são literais: *"tirou 250 de 250"*, *"tirou 435 de 435"*. Hoje o `cap` não vale nesse caso, e o
selo sai em **100%** deles.

**⚠️ E A CONDIÇÃO É "cheio E foi a zero", nunca só uma das duas** — as duas metades foram medidas:

| só | o que volta a quebrar |
|---|---|
| *"foi a zero"* | devolve o defeito de 12/09 — o golpe final que raspa os últimos 9 de HP volta a mostrar selo |
| *"estava cheio"* | põe selo num golpe **APARADO** pela trava, que é justamente um em que a barra caiu 30% e não o dobro |

**NA TELA, o mesmo par nos dois casos:**

```
COM crítico:  Fearow atacou Caterpie com Bicada e tirou −175 de HP. CRÍTICO
SEM crítico:  Fearow atacou Caterpie com Bicada e tirou −152 de HP.
              Caterpie atacou Fearow com Agulha Dupla 2x e tirou −12 de HP.
              Fearow atacou Caterpie com Bicada e tirou −23 de HP.
```

**⚠️ E ISSO MUDA A IMPRESSÃO DO MOTOR, e tem que mudar:** `MOTOR 5130995a7232 → 5481ce57abca`.
É mudança de MECÂNICA, não de apresentação — e o `cap`, que é só do selo, andou junto porque ele
entra no diário. **Os dois motores continuam concordando: 0 divergências em 300 batalhas** com a
mesma semente, que é o que mantém a liga e a animação de pé.

**⚠️ E CINCO TRAVAS MEDIAM A REGRA ANTIGA**, e caíram de uma vez — o invariante (*"com dif ≤ 15,
NINGUÉM de vida cheia morre no 1º golpe"*) e as quatro da curva. Elas não foram afrouxadas: o
invariante virou **duas metades** (*nenhum NÃO-crítico morre* **e** *todas as mortes são críticas,
e elas acontecem*), e a curva passou a cobrar o **par** — o não-crítico para no teto exato, o
crítico mata. Sem a segunda metade, um build que voltasse a segurar o crítico passaria medindo um
**conjunto vazio**, que é o "zero perfeito" que este arquivo já registra em cinco lugares.

**⚠️ E ELE CUSTOU UM DESSES ZEROS NO CAMINHO:** a primeira medição de frequência deu **0 aparadas**
em 8.639 confrontos — o que se lê como *"a mecânica não acontece"*. O contador estava sendo lido do
`globalThis` **deste processo**, e o sandbox é um contexto de `vm` próprio: o `globalThis` de
dentro dele **É** o objeto devolvido pelo `createSandbox`. Lido de `S.__c`, ele dá 1.468.
**Quem for instrumentar o sandbox: o contador se lê em `S.<nome>`, nunca no globalThis de fora.**

#### ⚠️ ELA APAGOU TRÊS CENÁRIOS DE TESTE, e os três pela mesma razão

Esta é a segunda vez que uma trava de "vida cheia" faz isso — o `MORIBUNDO_TETO_NO_CHEIO` já tinha
apagado um cenário inteiro em 14/09. **Trava que monta um caso de morte-num-golpe envelhece quando
o jogo para de matar num golpe.**

| trava | o que ela media | o que passou a acontecer |
|---|---|---|
| *"quem entra CHEIO não cura"* (drenagem) | o confronto INTEIRO | o Oddish cheio não mata mais de primeira, o confronto continua e ele cura na 2ª troca — **e ali curar está certo**. 292 de 400 "falhavam" |
| *"os dois primeiros golpes são de quem usou o sono"* | **a duração** | o Paras matava o Onix no golpe livre (Planta é 4× nele) e não havia segundo golpe. Hoje há |
| *"na tela ele acorda depois de apanhar"* | exigia a linha `sono` na mesma sequência | o adormecido **sobrevive** e leva o sono pro confronto seguinte, onde sai um `acordou` sem `sono` |

**⚠️ A DO SONO É A QUARTA VEZ QUE ESSA FAMÍLIA MEDE A DURAÇÃO EM VEZ DA REGRA** (as anteriores: o
sono virar de 1 a 3 trocas, a paralisia, e o despertar). A regra é *"enquanto ele dorme, só o dono
bate"* — e quem marca o fim disso é o `acordou`, não um número.

**⚠️ E A TERCEIRA REVELOU ALGO QUE JÁ ERA VERDADE: o `_dormindoPor` só é solto no fim da BATALHA**
(`encerrarBatalha`), então quem dorme e **sobrevive** ao confronto entra no seguinte ainda dormindo.
Isso é fiel (no jogo original o sono atravessa a troca de pokémon) e é anterior a esta mudança — o
que mudou é que ficou comum, porque o adormecido parou de morrer.

#### ⚠️ E DUAS TRAVAS MINHAS NASCERAM MEDINDO NADA — a armadilha do `simulateGymBattle`

As duas que montavam HP à mão (*"alvo machucado"* e *"quem raspa"*) davam verde sem testar coisa
alguma: **o `simulateGymBattle` CURA os dois times** na entrada (o A só sem `preservePlayerHp`, o B
**sempre**). É a mesma armadilha que o CLAUDE.md já registra em três medições anteriores, e ela
custou aqui `0 de 356` e `363 mortes de 363` — números que pareciam defeito do jogo.

**E uma delas ainda não mordia depois de consertada**: com o alvo a 50%, o próprio
`if(teto >= alvo.hp) return golpes` já o desprotege, então a trava passava **mesmo com a guarda do
'vida cheia' removida**. Ela só distingue os dois caminhos com o alvo a **90%** e o atacante **10
níveis acima** — a janela em que o teto morde e só a guarda decide. Conferido que ela acusa
(`0 de 356`).

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

## OS SELOS DO JOGO (17/09/2026) — o emoji virou desenho nosso

Pedido assim: *"tente trocar tudo quanto é emoji pronto, por desenhos próprios do nosso jogo, tente
fazer algo legal, se der diferente de como é o emoji hoje"*. São **54 selos** em pixel art: a
batalha inteira, a home, a Liga Clássica, a Trainers League, o Ginásio da Cidade, a Torre, as
conquistas, o botão Home e **a loja e a mochila inteiras** — os 11 itens, os 23 TMs e os 3 HMs.

### ⚠️ A PRIMEIRA LEVA FOI DESENHADA À MÃO, E FOI REPROVADA

Ela era 16×16, pixel a pixel, e o retorno foi *"não ficou muito bom"*. **A causa não era só a
resolução** — era que pixel a pixel **não se faz** um círculo redondo nem uma estrela simétrica, e
sem sombreado tudo fica chapado. Dois selos já tinham sido refeitos por isso mesmo (a medalha
parecia um inseto, a fúria era um X vermelho), e o problema ia continuar aparecendo um a um.

**Hoje quem desenha é o `tools/gerar-selos.js`.** Cada selo é descrito por FORMAS — círculo,
elipse, polígono, estrela de N pontas, traço grosso — e a ferramenta cuida das três coisas que dão
qualidade e que a mão não entrega:

| | |
|---|---|
| **a forma sai perfeita** | o círculo é redondo, a estrela é simétrica, o cone do remoinho é um cone |
| **o sombreado é automático e DIRECIONAL** | luz em cima à esquerda, sombra embaixo à direita, **na mesma direção nos 29** — sem uma direção só, cada selo pareceria de um jogo diferente |
| **o contorno é fechado e de um pixel** | em volta de tudo, sempre |

A paleta ganhou **três tons por cor** (claro/médio/escuro, a maiúscula é o claro): é com eles que
o gerador pinta a luz e a sombra. Com uma cor por material não haveria com o que sombrear.

`node tools/gerar-selos.js` cospe o bloco pronto; `--html` abre a prévia dos 29 nos três tamanhos
em que eles saem no jogo, e `--ver` mostra a grade em ASCII.
**⚠️ A PRÉVIA EXISTE PORQUE ASCII NÃO SE JULGA** — a primeira leva foi avaliada lendo a grade, e é
por isso que o sino saiu pinheiro e a garra saiu mão. **Três selos só foram consertados olhando a
prévia**: o sino (a cúpula redonda é o que o identifica, não o triângulo), o remoinho (faixas retas
empilhadas viram um funil de laboratório; elipses que encolhem E se deslocam viram um cone que
gira) e o dragão (três dedos grossos saem como uma pata — o que se lê como garra são três RISCOS
diagonais que afinam).

**A ferramenta é a fonte, mas o que vai pro jogo é a TABELA** — o mesmo desenho do
`tools/gerar-golpes.js` com o `data/golpes.json`. A grade continua legível no `index.html`, e
continua sendo onde se ajusta um pixel na mão.

### ⚠️ 24×24, E O viewBox SAI DA GRADE

A grade foi de 16 para **24**: em 16 não cabia sombreado — sobrava um pixel por tom.

O `viewBox` era **`0 0 16 16` escrito à mão**, e nessa virada isso teria mostrado **um quarto de
cada desenho, em silêncio**. Hoje ele é derivado de `grade.length`, e com isso grades de tamanhos
diferentes convivem. A trava que cobrava `=== 16` virou *"toda grade é QUADRADA"* pelo mesmo
motivo: **fixar o lado ali era o mesmo erro do viewBox, do outro lado**.

### ⚠️ O SVG PRECISOU DE RETÂNGULOS MÁXIMOS — 383 KB VIRARAM 66

Uma `<rect>` por corrida horizontal daria **6.976 formas e ~383 KB de DOM** com os selos em
24×24. Juntando também na **vertical** (retângulos máximos) e emitindo **um `<path>` por cor**
— um `M x y h w v h -w z` custa ~12 caracteres contra ~45 de uma `<rect>` — o mesmo desenho sai
em **66 KB**: **5,8× menor**.

⚠️ **ESTES NÚMEROS JÁ ESTIVERAM ERRADOS AQUI** (dizia "160 KB viraram 38", com 3.772 formas e
159 paths) — eram de uma versão intermediária, com menos selos, e sobreviveram ao arquivo
crescer. Foram medidos de novo em 18/09/2026, contra o código que está no ar. É a mesma
armadilha que este arquivo registra em outros três lugares: **número medido envelhece junto com
o que ele mede**.

| | |
|---|---|
| `<svg>` no DOM, injetado UMA vez | **66 KB** (295 paths, 4.302 retângulos) |
| cada uso na tela | **95 bytes** (um `<use>`) |
| `index.html` | **1,83 MB** |

**⚠️ UMA JUNÇÃO ERRADA NÃO APARECE COMO ERRO** — aparece como um pixel de cor trocada num desenho
de 24, que ninguém vê. Por isso a trava **desfaz o SVG de volta em grade** e compara com o
`DESENHOS` (16.704 pixels), e cobra também que **nenhum retângulo se sobreponha**: dois paths
pintando o mesmo pixel dariam o desenho certo por acaso, com a cor do último. Conferido — ela acusa
10.336 pixels com o "consumido" marcado errado.
**E há um teto de ~95 KB pro SVG** (1.800 bytes por selo), porque a trava do pixel **não pega** a otimização ser desfeita:
com uma `<rect>` por pixel o desenho continua certo e só o DOM cresce. Conferido: ela acusa com uma `<rect>` por pixel.

### ⚠️ AS SETAS DA MONTANHA CHAMAVAM UMA FUNÇÃO QUE NUNCA EXISTIU (18/09/2026)

Reportado: *"não está sendo possível trocar a ordem dos pokémons nas batalhas na montanha sagrada,
coloque que seja possível igual nas outras telas de ordenação"*.

**As setas estavam lá, desenhadas e habilitadas** — o que não existia era a função. Elas chamavam
`moveTeam`, que **não está declarada em lugar nenhum do arquivo**: o clique dava
`ReferenceError`, o erro ficava no console e **a tela continuava parecendo certa**.

- **⚠️ É A TERCEIRA DESTA FAMÍLIA EM DOIS DIAS**, e as três passam em qualquer asserção de estado
  porque o HTML sai perfeito: o `JSON.stringify` no `onclick` do botão da notificação da liga
  (17/09), o **slot sem aspas** no `onclick` do montador (hoje de manhã), e esta. Em todas, o
  atributo está sintaticamente quebrado ou aponta pro nada, e **só o navegador vê**.
- **⚠️ E ELA NASCEU DE UM COMENTÁRIO QUE MENTIA.** O da clareira da Vigília dizia que as setas eram
  *"as mesmas da tela de ordem do time (`moveTeam`)"* — **errado nas duas pontas**: a tela de ordem
  usa `moveOrder` (por **id**) e a clareira usa a sua própria (por **índice**). Quem escreveu a
  Montanha leu o comentário e copiou o nome.
  É a mesma classe do "59 espécies das quatro listas" da ficha da Pokédex: **texto que descreve
  código envelhece — e aqui ele nem era verdade no dia em que foi escrito.**

**O CONSERTO É A FUNÇÃO DA CLAREIRA, RENOMEADA:** ela passou de `moverNaVigilia` pra
**`moverNaFila`**, porque agora serve às **duas** telas que mostram a fila do adversário antes da
luta. Um `moverNaVigilia` numa tela de Montanha faria o próximo leitor procurar uma vigília que não
está ali.

- **As duas convivem de propósito:** `moveOrder` é por **id** (5 chamadas, a tela de ordem de
  batalha) e `moverNaFila` é por **índice** (4, as duas filas). Unificar exigiria escolher uma
  chave e mexer em 9 chamadas de telas que **funcionam** — e foi um nome inventado que causou este
  defeito, não a existência de duas funções.
- A Montanha **já estava no `SAFE_SAVE_SCREENS`**, então reordenar ali sempre gravou — o que
  faltava era reordenar.

**⚠️ A TRAVA NOVA VALE PROS 277 HANDLERS, e não só pra este:** ela varre **todo** `on*="nome(` do
`index.html` e cobra que `nome` esteja declarado. Medido: **277 handlers distintos**, e depois do
conserto **nenhuma órfã** (`if` aparece porque existe um `onclick="if(...)"`, e palavra-chave não é
função). Conferido que ela acusa: com o `moveTeam` religado ela reporta a órfã pelo nome.

**Medido no navegador, a 320px:** as setas reordenam e desfazem, **zero erros** no console, sem
rolagem lateral — e a fila dos **guardiões** continua sem setas, que é o certo: ela não se reordena.

**CONFERIDO QUE NÃO É MOTOR, por impressão:** o mesmo build antes e depois dá o **MESMO hash** em
900 batalhas semeadas.

### OS POKÉMONS COM O PROF. CARVALHO (18/09/2026)

Pedido junto com o delete do save: *"adicione um botão dentro da pokedex chamado (Pokemons com o
Prof. Carvalho), quando clicar, vai exibir a lista de todos os pokemons que estão aposentados,
exibindo nome, tipos, level, e ataques"*.

- **⚠️ ELES VÊM DA CONTA, e não de save nenhum** — aposentar apaga o save, então este arquivo é
  o **único lugar** onde esses pokémon ainda existem. É por isso que ele guarda o resumo em vez
  de apontar pra o save.
- **OS GOLPES SÃO OS QUE ELE TINHA**, lidos do `ataques` gravado — e não do que a espécie aprende
  hoje: a base de golpes muda, e o time foi aposentado com AQUELES. Quem não tem o campo (save
  antigo, ou quem nunca escolheu) sai sem a linha, que é o certo: ele lutava pelo motor de tipo.
- **⚠️ O `golpeSeloHtml` É `(especie, tipo, golpeId)`**, e a primeira versão desta tela passou o
  golpe no PRIMEIRO lugar: o selo nomeava outro golpe **em silêncio** (saiu "Chicote de Cipó" no
  lugar de "Raio Solar"). Há trava com o nome esperado, e não só com "tem algum selo".
- **O BOTÃO SÓ APARECE COM ALGUÉM LÁ**: a aposentadoria é rara, e uma tela que só diz "ninguém
  ainda" é pior que um botão que não existe. Ele traz a contagem junto.
- **A lista reusa o `.mon-name` e os selos de tipo/golpe** do resto do jogo: quem já sabe ler a
  fileira do time sabe ler esta. Medido a 320px: linha de **228×116px**, 12 aposentados em
  **822px**, sem rolagem lateral e sem texto cortado.

### A NOTIFICAÇÃO DE LIGA LEVA AO CHAVEAMENTO (18/09/2026)

Pedido: *"quando clicar na notificação para ir até a Liga Clássica, hoje esta levando para a tela
principal ... mude para levar para a mesma tela é exibida quando clica no botão Rever"*.

O `viewLeagueHistory` pede **quatro** coisas (tipo, ciclo, liga e a hora dela), e a notificação só
carregava o **tipo**. Hoje o servidor manda as outras três no `meta` — e é o mesmo trio que o
`pendingPlacements` já gravava dez linhas acima.

- **NOTIFICAÇÃO ANTIGA CAI NA TELA DA LIGA**, como sempre caiu: sem o endereço, o botão volta a
  ser o de antes. O mesmo vale pras que não falam de uma liga específica (`league_started`,
  `league_delayed`).
- **⚠️ A TRAINERS LEAGUE FICA DE FORA, e não é esquecimento:** ela é um round-robin de um grupo
  só e **não tem `leagueId` por partida** — o histórico dela é outro. O pedido nomeia a Clássica.
- **⚠️ O `cycleTime` TEVE QUE SUBIR DE ESCOPO.** Ele era declarado dentro do laço de
  participantes, e as notificações são criadas **antes** dele — deixado lá, seria **zona morta
  temporal**, o mesmo defeito que travou as quatro telas de revelação em 09/09/2026.
- E o `onclick` usa **`escJs`**, não `JSON.stringify` — a lição de 17/09, com trava própria.

### ⚠️ A FAIXA DE UPDATE MOSTRAVA O CÓDIGO (18/09/2026)

Reportado: *"o símbolo que aparece la no topo numa faixa azul, esta quebrado, fica aparecendo umas
coisas escritas"*. E era literal: a faixa vive no **`<body>` estático**, fora de qualquer template
literal — a interpolação que eu pôs ali quando os emojis viraram selo **nunca interpolou**, e o
jogador via o código escrito na tela.

- **O SELO ENTRA PELO JS**, no `mostrarAvisoDeVersao`, que é quem acende a faixa.
- **⚠️ A TRAVA DA INTERPOLAÇÃO NÃO PEGAVA**: ela varre o **SCRIPT** e não o `<body>` — o body tem
  apóstrofo em prosa e quebraria o parser dela. Hoje há uma trava própria, e ela é simples:
  **nada de interpolação pode sobrar no body**.
- **⚠️ E O COMENTÁRIO DO CONSERTO SE ACUSOU NA TRAVA DO SCRIPT** — a **quarta** vez que isso
  acontece neste projeto (o nome de líder na bifurcação, o código velho na trava do `slotDaConta`,
  a palavra "Máquina"). Ele foi reescrito sem a sequência literal.

### DUAS MEDIDAS DA LOJA (18/09/2026)

- **O quadro do item foi de 438 para 350px** (−20%, a pedido). Ele é uma coluna de três andares e
  quem cede é o **miolo**, que rola por dentro — o rodapé continua colado embaixo, que é a
  promessa que a altura fixa existe pra cumprir. Conferido nos 33 itens: **350px em todos**, sem
  rolagem lateral; o pior miolo a rolar é o do TM03, com 185px.
- **"Vender por 25" virou "Vender (25)"**, a pedido.

⚠️ **E O SANDBOX GANHOU `FieldValue`** (`arrayUnion`, `delete`, `increment`, `serverTimestamp`):
o jogo grava listas com `arrayUnion` em vários caminhos, e sem ele qualquer teste que escreva uma
lista morria com um TypeError sem relação com o que estava sendo testado. Ele devolve um objeto
**reconhecível**, pra a trava poder afirmar *"isto foi um arrayUnion destes valores"* em vez de só
não quebrar — a mesma lição do `fake-firestore`.

### ⚠️ A FRASE DE STATUS VOLTOU A PISCAR, E A CULPA FOI DO SELO (18/09/2026)

Reportado: *"as mensagens que aparece de estado dos pokemon como essa: Clefable está paralisado e
não consegue atacar!, quando elas aparecem, elas piscam 2x na tela"*.

**⚠️ A GUARDA JÁ EXISTIA desde 12/09/2026 — e ela parou de funcionar quando os emojis viraram
SVG, hoje de manhã.** Ela comparava `el.innerHTML` com o HTML gerado, e **o navegador NORMALIZA a
tag auto-fechada do selo**:

```
a função gera:  <use href="#s-raio"/>
o DOM devolve:  <use href="#s-raio"></use>
```

A comparação passou a dar **sempre diferente** em toda frase que tem selo — e **toda** frase de
status tem. Medido no navegador, com o mesmo par de desenhos: a animação de entrada rodava
**3 vezes** por frase, e voltou a **1**.

- **HOJE A COMPARAÇÃO É POR UMA CHAVE** (`chaveDaFrase` = classe + HTML), guardada num
  `data-frase`. Atributo o navegador devolve **literal**: não passa por parser, então não há o
  que normalizar. As duas pontas usam a mesma chave — o montador (`statusDoConfrontoHtml`) e o
  pintor (`pintarStatusDoConfronto`).
- **A CLASSE ENTRA NA CHAVE** porque duas frases de classes diferentes podem ter o mesmo texto, e
  a classe é o que decide a animação.
- **A frase NOVA continua entrando normalmente** — é o que separa um golpe do seguinte, e sem
  isso o conserto apagaria o que funciona.

**⚠️ A LIÇÃO É MAIS GERAL QUE O DEFEITO: comparar HTML gerado com `innerHTML` lido nunca é
exato.** O navegador reescreve a marcação ao parseá-la — tag auto-fechada, ordem de atributos,
aspas. Funcionou por seis dias porque as frases só tinham **texto e emoji**; na primeira tag de
verdade ela quebrou, e **em silêncio**: a guarda não falha, ela só deixa de pegar.

- **⚠️ E O SANDBOX NÃO NORMALIZA**, então uma trava de comportamento passaria com o defeito de
  volta. A trava **simula a normalização na mão** (expande o `<use/>`) e, além disso, **lê o
  código** pra cobrar que nenhuma das duas pontas volte a comparar `innerHTML`. Conferido: com o
  defeito religado ela acusa **3 falhas**.
- **O stub de elemento do sandbox ganhou `getAttribute`/`setAttribute`** — sem eles o pintor
  derrubava o teste com um TypeError sem relação com o que estava sendo testado. É a mesma lição
  do `fake-firestore`: **o dublê tem que fazer o que o de verdade faz.**
- **As duas impressões — MOTOR e DIÁRIO — continuam idênticas** em 900 batalhas semeadas.

### ⚠️ O CONTORNO TEM 2px, PORQUE 24 NÃO CABE EM 16 (18/09/2026)

Reportado com print a **zoom 100%**: *"o desenho da estrela e muitos outros ficam feios o contorno
quando ta assim, da onde eu to vendo não parece uma estrela"*.

**⚠️ A CAUSA É UM NÚMERO: 0,67.** A grade é 24×24 e o selo sai a **16px** na fileira do time —
ou seja **0,67 pixel de tela por pixel de grade**. Um contorno de 1px vira 0,67px, e aí ele
**não cabe**: com `crispEdges` o navegador o pinta em alguns lugares e descarta em outros, e as
pontas da estrela viram **perninhas pretas**; a moeda vira um polígono.

**Medido nos OITO contextos onde o selo aparece: SEIS REDUZEM a grade** (0,60× a 0,77×) e só dois
ampliam (os de 32px). O `crispEdges` estava certo em dois lugares e errado em seis — justamente
os que o jogador mais vê.

**⚠️ E A PRIMEIRA CORREÇÃO FOI A ERRADA, o que vale registrar:** tirar o `crispEdges` deixa o
navegador suavizar, e o contorno de 1px vira um **cinza esfumado** — a estrela sai borrada em vez
de quebrada. Trocou um defeito por outro.

**AS QUATRO COMBINAÇÕES, comparadas no navegador a 16px:**

| | resultado |
|---|---|
| 1px + `crispEdges` (como era) | contorno **tracejado**, pontas viram perninhas |
| 1px + suave | contorno **cinza claro**, desenho borrado |
| 2px + `crispEdges` | contorno **pesado**: o preto engorda e a estrela some dentro dele |
| **2px + suave** | **contorno escuro e contínuo, fino o bastante pra o desenho aparecer** |

**⚠️ AS DUAS METADES ANDAM JUNTAS, e foram DUAS voltas até acertar.** Com 2px o contorno vira
**1,33px** na tela — sempre sobra um pixel inteiro, em qualquer posição. Mas com `crispEdges` o
navegador **não interpola**: os 2px viram 2px de tela CHEIOS, e o preto engorda até dominar o
desenho. Foi o segundo print do dia, e o pedido foi direto: *"eu gostei mais do 2px suave ao inves
do Crisp"*.
Só o suave, com 1px, vira cinza esfumado; só o 2px, com crisp, fica pesado. **É a combinação.**

#### ⚠️ E A ESTRELA FICOU CHEIA, porque a forma também não cabia

Com o contorno de 2px **de cada lado**, uma ponta fina vira quase só contorno — e as duas pontas
de baixo da estrela saíam como **"perninhas pretas"** a 16px. Isso é do DESENHO, não do rendering.

O raio interno foi de **4,4 para 6,0** (de 10,5), comparando quatro razões no navegador: 6,0 é a
que se lê como estrela a 16px.

**E o BRILHO BRANCO saiu junto** — ele é um detalhe de 2px que a 56px enfeita e a 16px vira uma
**mancha cinza** na ponta esquerda. Dá pra ver nas variantes que o mantinham.

⚠️ **A regra que fica: num selo de 16px, detalhe menor que ~3px da grade não é detalhe, é
sujeira.** Vale pro próximo desenho.

O raio interno acabou em **5,4** (e não 6,0): a estrela cheia lia bem mas ficava pesada ao lado do
nome — *"pode deixar a estrela um pouco menos gorda"*. 5,4 é o ponto em que ela ainda tem ponta e
já não tem perninha.

#### ⚠️ E OS DOIS Z DO SONO PRECISAM DE 5px DE FOLGA

Eles saíam **colados** — e a causa é a mesma do contorno: ele cresce **2px pra fora de cada um**,
então dois desenhos a 4px de distância se encostam pelo contorno e viram um borrão só. Os dois Z
ainda por cima se **sobrepunham** em x=8..9.

Hoje o pequeno fica em cima à esquerda e o grande embaixo à direita, com **5,5px** entre eles — e
é essa a conta pra qualquer selo que tenha duas formas soltas: **2 + 2 de contorno, mais 1 de
vazio.**

- **CUSTO: 1 KB** (o SVG vai de 65 para 66) e ~65 retângulos a mais. O contorno come um pouco
  da área interna de cada desenho, o que é o preço — e em 16px ninguém vê o interior, vê a
  silhueta.
- **As duas impressões — MOTOR e DIÁRIO — continuam idênticas** em 900 batalhas semeadas.
- **⚠️ SE UM DIA A GRADE MUDAR**, este número muda junto: o que importa é o contorno ter pelo
  menos **1 pixel de tela** depois da redução. Numa grade de 16 (1:1 a 16px) ele voltaria a
  poder ser 1px.
- A trava é **geométrica**, e não um texto: ela varre a borda do desenho e cobra que **todo**
  ponto de contorno que encosta no desenho tenha um vizinho de contorno do lado de fora. Mais uma
  que **lê o código** (o `contornar` dá duas voltas), porque uma volta só geraria um desenho
  válido — só que fino — e nada mais acusaria. E ela cobra a outra metade junto: **nenhum selo
  sai com `crispEdges`**, nem pelo atributo nem por classe no CSS.

### ⚠️ A FÚRIA É A VEIA DO PRIMEAPE, E O TERRENO É UM GALÃO (18/09/2026)

Reportado com print: *"aquele emoji do Snubbull é de fúria, melhore o sinal, faça algo parecendo
com fúria mesmo, e não uma seta, no desenho do Primeape, ele possui em cima de um dos olhos na
diagonal, uma espécie de 4 V onde as pontas estão juntos"* e *"o sinal de buff do terreno de
batalha também está feio"*.

**A FÚRIA ERA UMA SETA PRA CIMA**, que dizia o que ela FAZ (+10 em tudo) e não o que ela É — e
seta é vocabulário de **buff**, não de raiva. Hoje ela é a **veia saltada** (💢), o símbolo de
raiva do anime e literalmente a marca que o Primeape tem sobre o olho.

- **⚠️ ELA FOI DESENHADA OLHANDO O SPRITE, não de cabeça.** O #57 foi baixado do mesmo
  `PokeAPI/sprites` que o jogo usa e ampliado pixel a pixel: são **quatro cantos em L**, um por
  quadrante, com as quinas apontando pro centro e os braços indo pra fora, deixando um **vazio em
  cruz** no meio. É exatamente o *"4 V onde as pontas estão juntos"* do pedido.
- A cor continua vermelha, que é a convenção do símbolo e já era a da fúria.

**O TERRENO ERA UMA MONTANHA com neve no pico**, e o problema dela era de TAMANHO: o selo sai a
1em (~13px) na fileira do time, e ali o recorte branco do pico sumia — sobrava um triângulo verde
chapado.

**⚠️ A ESCOLHA FOI MEDIDA NO NAVEGADOR, e só por isso ela é o que é.** Foram desenhadas **seis**
variantes e comparadas **a 13px**, que é o tamanho que importa:

| variante | a 13px |
|---|---|
| hexágono, losango | viram **um pontinho** |
| dois galões + chão, seta + chão, losango + galão | viram **mancha** — três elementos empilhados não cabem em 13 pixels |
| triângulo | lê bem, mas é o 🔺 do emoji, que *"não dizia nada"* |
| **um galão só** | **lê nos três tamanhos** |

É a mesma razão pela qual a **estrela do shiny** funciona: uma forma **única e sólida**. E o
galão não é a seta que saiu da fúria — aquela era CHEIA (triângulo + haste) e esta é **vazada**.

- **⚠️ OS GALÕES SÃO POLÍGONO, e não `traco` diagonal:** com traços, o sombreado direcional
  pinta o interior de cada um em separado e o meio do selo vira ruído. Isso apareceu já no ASCII,
  antes do navegador.
- **CUSTO: nada.** O SVG fica nos mesmos **65 KB**. **As duas impressões — MOTOR e DIÁRIO —
  são idênticas** em 900 batalhas semeadas: selo é apresentação inteira.

#### ⚠️ E O GALÃO SAI NA COR DO TERRENO

Pedido logo depois: *"deixe a cor da setinha que indica que ele ta buffado pelo terreno, da mesma
cor que a cor do selo do terreno"*.

A faixa do terreno usa `terrainColor(t)`, que é a cor do **primeiro tipo** dele — e agora o
galão do quadro do lutador sai na mesma. Ou seja, num Vulcão ele é laranja, na Usina Elétrica
amarelo, no Dojo Tradicional vermelho.

- **O CORPO É `currentColor`**, como o disco do TM — é o que faz UM desenho servir 17 cores.
  Sem isso seriam 17 desenhos iguais de cor diferente.
- **⚠️ MAS ELE NÃO LEVA VOLUME, e isso separa os dois:** o disco do TM tem brilho e sombra
  translúcidos porque ele é um **círculo GRANDE**; num galão FINO a mesma técnica pinta **metade
  do desenho de branco** — foi o que apareceu na tela, e o relato foi literal (*"as setas estão
  metade de uma cor e metade branca, ela deve ser inteira da mesma cor"*).
  Hoje a cor é chapada e quem define a forma é o **contorno preto**, que toda a pixel art do jogo
  já tem. Dentro do símbolo só existem duas coisas: a cor e o contorno — e é isso que a trava
  cobra, em vez de nomear o branco.
- **⚠️ HÁ UM VERDE PADRÃO** (`COR_TERRENO_PADRAO`), e ele não é enfeite: sem cor nenhuma o
  `currentColor` herdaria a cor do **NOME do lutador** — azul no jogador e vermelho no
  adversário —, e o selo mudaria de cor conforme o lado. Ele também é o que mantém as chamadas
  antigas (as que passam só `comTerreno: true`) desenhando o que sempre desenharam.
- **Conferido nos 17 tipos, no navegador a 320px:** o galão sai na mesma cor da faixa nos 17, e
  o contorno preto o segura mesmo nas claras (o Ferro-Velho e a Montanha Nevada).
- **A trava do pixel a pixel pegou os dois de graça**: ela desfaz o SVG de volta em grade e
  compara com o `DESENHOS` (31.104 pixels), então um desenho novo entra coberto sem uma linha.

### ⚠️ O DISCO DO TM SAI NA COR DO TIPO — um desenho, 17 cores

Pedido assim: *"para os TMs, deixe o disco da cor do tipo do ataque que ele ensina"*.

**São 23 TMs e 17 tipos, e o desenho é UM só.** A cor entra no **uso**, não no símbolo:

| na paleta | vira | serve pra |
|---|---|---|
| `*` | `currentColor` | o corpo do disco — o `<use>` herda do `style="color:…"` do `<svg>` de fora |
| `+` | `#ffffff55` | o brilho |
| `-` | `#00000038` | a sombra |

**⚠️ O VOLUME PRECISA SER TRANSLÚCIDO, e é isso que faz a técnica funcionar:** o sombreado normal
usa três tons de uma cor conhecida, e aqui a cor **ainda não se conhece**. Branco e preto com alpha
clareiam e escurecem *o que estiver embaixo*, seja qual for — então o mesmo disco fica com volume
em Fogo, em Água e em Dragão.

Sem isso seriam **23 símbolos idênticos de cor diferente**, e o próximo TM nasceria sem cor.

- **O HM usa o MESMO disco**, também na cor do tipo (ele também ensina um golpe). O que separa os
  dois na tela é o **risco branco**: HM não se gasta.
- **A cor do HM é aplicada num laço DEPOIS da tabela**: dentro dela o `GOLPES` ainda não foi lido.
- **A Poção e a Super Poção são o MESMO frasco**, com o líquido de cor diferente — elas são o mesmo
  item em duas forças, e formas diferentes fariam procurar duas coisas.
- **O Atk Up e o Def Up reusam a espada e o escudo da BATALHA**: é a mesma ideia, e um segundo
  desenho pra ela faria procurar duas coisas onde há uma.
- **A troca foi na TABELA, não nos 12 renders** — todos leem `it.icone`/`hm.icone`. Mexer em cada
  um seria garantir que o próximo nascesse com emoji, e o ícone do TM depende do tipo do golpe, que
  só a tabela sabe.

A trava cobra os 23 na cor certa, **que as cores VARIAM mesmo** (14 distintas — um bug que pintasse
todos de Normal passaria na primeira metade), os 3 HMs, o `currentColor` no símbolo, o alpha nos
dois tons de volume, e os 11 itens comuns sem emoji. Conferido que ela acusa com um TM de cor fixa.

### ⚠️ O QUE FICA COM EMOJI, E POR QUÊ — a linha é INTERFACE × CONTEÚDO

Depois de fechar as telas, sobraram **52 emojis**, e nenhum deles é acidente. Eles vêm de **TABELA**,
não de marcação — ali o emoji não é ícone de interface, é **conteúdo**:

| | |
|---|---|
| os **51 TERRENOS** (`TERRAINS[].icon`) | 🌋 Vulcão, 🐍 Pântano, 🪸 Recifes de Coral… são **lugares diferentes**, e em 24×24 "Pântano", "Pântano Radioativo" e "Manguezal" virariam três manchas verdes iguais. O card já traz os **selos de tipo coloridos** logo abaixo, que é a informação mecânica |
| as **250 espécies** (`SPECIES[].emoji`) | vai pro `sprite-fallback`, que é **TEXTO** — um `<svg>` apareceria escrito |
| as **69 conquistas** (`icon`) | cada uma tem a sua, e o que virou selo ali foi o **cadeado** da trancada e as **medalhas** do prêmio, que são a interface |
| ~~os itens da loja~~ | **viraram desenho em 17/09/2026** — ver a seção do disco do TM, acima |
| os **32 lugares do mapa** e os 4 membros da Elite | mesma família |

**E os símbolos NEUTROS ficam**: `⬅` (34 botões de voltar), `➜`, `★`, `✔`, `⚠`, `❔`. Eles não são
"emoji pronto colorido" — são sinais que já se leem como parte do texto.

### ⚠️ O TAMANHO DO SELO NÃO PODE SER SEMPRE `1em` — o emoji é desenhado MAIOR que a fonte

Isso custou dois relatos. O emoji tem **métricas próprias** e é pintado maior que a caixa da fonte,
então trocá-lo por um `<svg>` de `1em` **ENCOLHE o ícone** — e nos lugares onde a fonte é pequena
ele some.

| onde | tamanho | por quê |
|---|---|---|
| no meio de uma frase | `1em` | ali ele é uma palavra |
| no quadro do lutador (`.selo-g`) | `1.15em` | |
| **no asterisco do cartão de golpe** | **15px fixos** | a observação é `.6rem` (~10px): em `1em` a chama saía com **10 pixels de lado**, e ela é justamente a informação que o asterisco existe pra dar. Reportado com print |
| em título, banner e `h2` | `1.4em` | |
| no `eyebrow` | **`2em`** | é a menor fonte de título do jogo (~8px) — em 1.4em o selo saía com 12px |
| nos cards da home (`.selo-menu`) | **32px fixos** | os outros dois cards da fileira usam o `.dex-icon.menu`, que é 32 |

### ⚠️ A ARMADILHA PRINCIPAL: o `${selo(...)}` numa string de ASPAS

O selo é um `<svg>`, então ele só funciona em HTML — e `${...}` só interpola dentro de **crase**.
Numa string de aspas ele sai **ESCRITO na tela**, e o **`node --check` passa** (a não ser que a aspa
por acaso feche a string antes). **Aconteceu três vezes só no dia em que isso foi escrito**: a moeda
da loja, o raro da rota e o cadeado das duas rotas com chave.

Por isso existe uma trava que **lê o código** e diz em que tipo de string cada `${selo(` cai.
**Ela precisou de uma PILHA**, e a primeira versão deu falso positivo em 4 linhas certas: dentro de
`${...}` o parser **volta pro modo código**, e ali cabe outro template — com um estado só, a crase
de dentro fechava o template de fora. E ela precisou **pular regex literal**: um `/['"]/g` tem aspa
DENTRO, e sem isso o parser abre uma string que nunca fecha.
**Ela varre o SCRIPT, não o `index.html` inteiro** — o `<body>` tem apóstrofo em texto corrido, que
abre string falsa.

#### ⚠️ E A SEGUNDA ARMADILHA SÓ UM PRINT PEGOU: O SELO **ESCAPADO**

Reportado no mesmo dia, com print da tela de golpe novo do Charmander:

```
* 10% de chance de causar queimadura <svg class="selo " shape-rendering="crispEdges"
  aria-hidden="true"><use href="#s-fogo"/></svg>
```

**Aqui o `${selo(...)}` estava CERTO no código** — ele interpolou, gerou o `<svg>`, e o
`cartaoDeGolpe` passou um **`escapeHtmlSafe` em cima depois**. Nenhuma das travas de código viu,
porque o código estava certo: elas olham onde a chamada CAI, não o que acontece com o resultado.

- **A observação do cartão deixou de ser escapada**, e isso é o certo: **ela é HTML da casa, não
  dado de fora** — o texto sai de constantes (`pct()` mais as tabelas de status) e o selo sai do
  `ICONES_ESPECIAIS`. Não há um único pedaço ali que venha do jogador. **O nome do golpe continua
  escapado**, que é o que um dia pode vir de outro lugar.
  ⚠️ Quem acrescentar observação ao `obsDoGolpe` tem que saber disso: o que entrar na lista vai pra
  tela como HTML.
- **A trava nova olha o HTML PRONTO** (procura `&lt;svg`), que é onde este defeito aparece — nas
  telas do sandbox, nos montadores avulsos e nos **61 cartões de golpe com asterisco**. Conferido
  que ela acusa com o `escapeHtmlSafe` de volta.
- **Varrido no navegador depois: 152 funções que devolvem HTML, os 61 cartões e as 250 fichas da
  Pokédex — zero escapes.**

**A lição das duas juntas:** o selo é HTML, então ele quebra de dois jeitos opostos — **caindo numa
string** (não interpola, sai o código) e **caindo num escape** (interpola, e sai o HTML escrito).
A primeira se vê lendo o código; a segunda, só olhando a tela.

### AS OUTRAS TRÊS TRAVAS

| | |
|---|---|
| **grade quadrada e cor da paleta** | o gerador não reclama: ele só desenha errado, ou nada. Ela NÃO fixa o lado — ver acima |
| **todo desenho tem chamador** | letra morta — a mesma decisão que manteve os estágios 2 a 4 do crítico e o Rock Tomb fora do jogo. Ela pegou 3 órfãos no dia (moeda, coroa, brilho) e os três ganharam destino |
| **o SVG bate pixel a pixel, sem sobreposição, e cabe em 60 KB** | ver a seção da otimização, acima |
| **o servidor não conhece selo** | ele é apresentação pura, e o servidor não tem tela |
| **⚠️ o GERADOR e a TABELA concordam** | ela roda `node tools/gerar-selos.js` e compara com o `DESENHOS` do `index.html` |

⚠️ **A ÚLTIMA NASCEU DE UM ACIDENTE DE VERDADE** (18/09/2026): um `git checkout
tools/gerar-selos.js` no meio de uma conferência reverteu o **gerador** e deixou o `index.html`
com os desenhos novos. As duas metades ficaram discordando **em silêncio**, e o estrago só
apareceria na próxima vez que alguém regenerasse as tabelas — que **apagaria os desenhos novos**
sem ninguém ver. Este arquivo já dizia *"a ferramenta é a fonte, mas o que vai pro jogo é a
TABELA"*; o que faltava era alguém conferir que as duas dizem a mesma coisa. É o mesmo papel que
o `tools/test-golpes.js` faz entre o `data/golpes.json` e as tabelas do jogo.

Mais a varredura que **roda 112 das 127 telas** procurando o literal — ela não basta sozinha
(a `renderLoja` é justamente uma das 15 que não rodam sem estado), e é por isso que a de código existe.

### ⚠️ AS TRAVAS PARARAM DE PROCURAR O CARACTERE

**23 travas quebraram** no dia, todas pelo mesmo motivo: elas procuravam `'🔥'`, `'⚡'`, `'😴'`.
Hoje elas procuram o **id do `<symbol>`** (`#s-fogo`), que é a identidade do selo — assim o desenho
pode ser reajustado sem derrubar 23 travas de uma vez.

- **As de FRASE continuam cobrando a frase inteira**, palavra por palavra: o que mudou é o ícone vir
  do `ICONES_ESPECIAIS` em vez de escrito à mão (`=== S.ICONES_ESPECIAIS.boom + ' Golem usou
  auto-destruição!'`). Assim elas não envelhecem junto com o desenho.
- **As de IDENTIDADE ficaram melhores:** `congelou === '❄️'` virou *"as três dividem o MESMO selo"*,
  que é o que aquela trava sempre quis provar.
- **⚠️ E METADE DELAS GUARDAVA O EMOJI COMO ESCAPE** (`'\ud83d\ude24'`), não como caractere — uma
  varredura que procure só o caractere **não as encontra**. Foi isso que fez a primeira passada
  deixar 9 de 23 para trás.

### O QUE FICOU DE FORA, E POR QUÊ

- **Os `emoji:'X'` das tabelas de espécie** — aquele valor vai pro `sprite-fallback`, que é **texto**:
  um `<svg>` apareceria escrito. Ali o emoji é o certo.
- **A seta `⬅` dos 67 botões de voltar, o `⚠`, o `❔` e o `★` do título** — não são "emoji pronto
  colorido", são símbolos neutros que já se leem como parte do texto (o `★` é tipografia do
  título, na fonte de pixel).
- **Os cabeçalhos** (`⚔️ BATALHA ONLINE`, `💀 Difícil`) — ali o emoji funciona como ilustração de
  título, não como ícone de estado.

### CUSTO: NADA NO MOTOR, e está conferido

**O mesmo build antes e depois dá o MESMO hash** em 900 batalhas semeadas — os selos são
apresentação inteira, e isso foi conferido de novo depois da troca pro 24×24 e da otimização do SVG.
Medido a 320px: um confronto mostra **6 selos**, a tela não passa a rolar pro lado, e o selo
acompanha o tamanho da fonte (`1em`, ou `1.15em` com `.selo-g` no quadro do lutador).
**⚠️ O DA HOME É A EXCEÇÃO: `.selo-menu` é 32px FIXOS**, porque os outros dois cards da fileira
(Pokédex e Conquistas) usam o `.dex-icon.menu`, que é 32 — em `1em` o selo saía 27 e a fileira
ficava desalinhada.

