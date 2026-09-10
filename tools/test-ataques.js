/**
 * OS GOLPES ESCOLHIDOS PELO JOGADOR.
 *
 * Cada pokemon leva ate DOIS golpes, escolhidos na captura e trocados quando o nivel traz um golpe
 * novo. E a primeira vez que uma escolha do jogador entra na conta de DANO -- ate aqui todo golpe
 * valia 60 (MOVE_POWER) e o motor so escolhia o TIPO.
 *
 * O que este teste tranca, e por que cada coisa some em silencio se quebrar:
 *   - QUEM NAO TEM GOLPE cai no motor de tipo. Sao 8 especies que nao aprendem UM golpe de dano em
 *     nivel nenhum, mais todo save gravado antes desta feature. Sem a queda, elas nao atacam.
 *   - A TELA SO ABRE QUANDO HA ESCOLHA. Com 2 ou menos disponiveis nao ha o que escolher, e no
 *     comeco da jornada isso e a regra: no nivel 5, 176 das 250 especies tem menos de dois.
 *   - A RECUSA E GRAVADA. Sem isso a pergunta volta no proximo nivel, pra sempre.
 *   - O DESTINO SOBREVIVE A TELA. A tela de aprendizado entra no meio do continueFromEvolution, e
 *     limpar o evolucaoDepois antes dela mandaria a jornada pro teamOrder.
 *   - OS CAMPOS ESTAO NO SAVE. As duas telas sao ponto seguro de gravacao; fechar a aba ali nao
 *     pode perder a captura nem repetir a pergunta.
 *
 *   node tools/test-ataques.js
 */
const path = require('path');
const fs = require('fs');
const { createSandbox } = require('./game-sandbox');
const RAIZ = path.join(__dirname, '..');
const S = createSandbox(path.join(RAIZ, 'index.html'));
const g = S.__getGame();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
let seq = 0;
function inst(id, nivel){ const p = S.createInstance(id, nivel); p.id = 'mon' + (++seq); return p; }

console.log('=== A LISTA DE GOLPES DE CADA ESPECIE ===');
{
  /* A ordem e por PODER decrescente, e nao por nivel: quem escolhe quer ver primeiro o que bate
     mais. Se ela virar ordem de nivel, a tela passa a mostrar Investida antes de Hidro Bomba. */
  const gy = S.ataquesDisponiveis('gyarados', 40);
  ok('vem ordenada do mais forte pro mais fraco',
     gy.every((id, i) => i === 0 || S.GOLPES[gy[i-1]][1] >= S.GOLPES[id][1]),
     gy.map(id => S.nomeDoAtaque(id) + ' ' + S.GOLPES[id][1]).join(', '));

  ok('e so traz o que a especie ja aprendeu ATE aquele nivel',
     S.ataquesDisponiveis('bulbasaur', 20).indexOf('solarbeam') < 0 &&
     S.ataquesDisponiveis('bulbasaur', 46).indexOf('solarbeam') >= 0,
     'Raio Solar e nivel ' + S.nivelDoAtaque('bulbasaur', 'solarbeam'));

  /* Autodestruicao e Explosao ficam FORA: elas ja sao a mecanica de autodestruicao do jogo, nas
     mesmas 9 especies. Como golpe comum de 200 e 250 de poder, sem o custo de cair junto, seriam a
     escolha obvia de todo mundo que as tem. */
  const comBoom = Object.keys(S.SPECIES).filter(id =>
    S.ataquesDisponiveis(id, 99).some(x => x === 'selfdestruct' || x === 'explosion'));
  ok('a autodestruicao e a explosao NAO sao golpes escolhiveis', comBoom.length === 0, comBoom.join(','));

  const semNome = Object.keys(S.GOLPES).filter(id => !S.GOLPES_PT[id]);
  ok('todo golpe da tabela tem nome em portugues', semNome.length === 0, semNome.join(','));

  /* O tipo do golpe tem que existir no TYPE_CHART, senao o multiplicador sai indefinido e o dano
     vira NaN -- e um NaN de dano nao aparece como erro, aparece como barra que nao se move. */
  const tipoSolto = Object.keys(S.GOLPES).filter(id => !S.TYPE_CHART[S.GOLPES[id][0]]);
  ok('e um tipo que o motor conhece', tipoSolto.length === 0, tipoSolto.join(','));
}

console.log('\n=== AS DOZE QUE NAO ESCOLHEM CAEM NO MOTOR DE TIPO ===');
{
  /* SOBRA UMA, e ela e o Ditto. Foram oito ate 09/09/2026 (a regra de cobertura de tipo deu golpe
     de dano a Kakuna, Metapod, Abra, Unown, Wobbuffet, Delibird e Smeargle) e voltaram a ser
     DOZE por um dia, quando as quatro do Metronomo passaram a devolver lista vazia de proposito.
     Em 10/09/2026 isso acabou: o Metronomo passou a DISPUTAR com os golpes proprios em vez de
     substitui-los, entao quem tem Metronomo escolhe golpe como todo mundo.
     O DITTO e a excecao de sempre: o golpe dele e o tipo de quem ele copiou, e essa mecanica so
     roda quando o melhorAtaque devolve null. */
  const semGolpe = Object.keys(S.SPECIES).filter(id => S.ataquesDisponiveis(id, 99).length === 0);
  ok('so o Ditto fica sem golpe de dano', semGolpe.join(',') === 'ditto', semGolpe.join(', '));

  const alvo = inst('onix', 50);
  let atacaram = 0;
  semGolpe.forEach(id => {
    const p = inst(id, 50);
    p.ataques = S.ataquesPadrao(p);
    const best = S.bestAttackType(p, alvo);
    if(best && best.type && !best.golpe) atacaram++;
  });
  ok('e todas continuam achando um golpe pelo TIPO', atacaram === semGolpe.length, atacaram + '/8');

  /* O melhorAtaque devolve null pra quem nao tem golpe -- e o null e o que faz o bestAttackType
     seguir pro motor de sempre. Um objeto vazio no lugar dele deixaria o pokemon sem atacar. */
  const vazio = inst('ditto', 50);
  ok('o melhorAtaque devolve null quando nao ha o que escolher',
     S.melhorAtaque(vazio, alvo) === null && S.melhorAtaque(Object.assign(inst('pikachu',50),{ataques:[]}), alvo) === null);
}

console.log('\n=== O PODER DO GOLPE ENTRA NO DANO ===');
{
  /* E o unico efeito mecanico da feature: o poder do golpe escolhido substitui o 60 fixo. Se ele
     nao entrar, a escolha vira decoracao e ninguem descobre. */
  const alvo = () => inst('snorlax', 50);
  const forte = inst('gyarados', 50); forte.ataques = ['hydropump'];   // 120
  const fraco = inst('gyarados', 50); fraco.ataques = ['bubble'];      // 20  (nao aprende, mas serve pro motor)
  const dF = S.calcDamageNew(forte, alvo(), () => 0.5);
  const df = S.calcDamageNew(fraco, alvo(), () => 0.5);
  ok('golpe forte tira mais que golpe fraco, mesma especie e nivel', dF > df, dF + ' contra ' + df);

  const semGolpe = inst('gyarados', 50);
  const dS = S.calcDamageNew(semGolpe, alvo(), () => 0.5);
  ok('e quem nao tem golpe continua batendo com o poder implicito de sempre',
     dS > 0 && dS !== dF, 'sem golpe: ' + dS + ' | MOVE_POWER = ' + S.MOVE_POWER);

  /* "O que tira MAIS DANO" e nao "o melhor tipo": um golpe fraco de tipo super eficaz pode perder
     pra um golpe forte neutro, e e isso que a escolha do jogador passa a decidir. */
  const dois = inst('gyarados', 50); dois.ataques = ['hydropump','bite'];
  const contraGengar = S.melhorAtaque(dois, inst('gengar', 50));
  ok('escolhe entre os DOIS golpes que ele leva, nunca fora deles',
     ['hydropump','bite'].indexOf(contraGengar.golpe) >= 0, 'contra Gengar saiu ' + S.nomeDoAtaque(contraGengar.golpe));
}

console.log('\n=== A TELA DA CAPTURA ===');
{
  g.team = []; g.screen = ''; g.escolhaDeAtaques = null; g.ataquesMarcados = [];
  const p = inst('gyarados', 40); p.escolherAtaques = true;
  g.team.push(p);
  ok('abre quando ha mais de 2 golpes disponiveis',
     S.resolverEscolhaDeAtaques() === true && g.screen === 'escolhaDeAtaques' && g.escolhaDeAtaques === p.id);

  const html = S.renderEscolhaDeAtaques();
  const disp = S.ataquesDisponiveis('gyarados', 40);
  ok('lista TODOS os golpes disponiveis, um botao cada',
     (html.match(/onclick="marcarAtaque\(/g) || []).length === disp.length, disp.length + ' golpes');
  /* O poder vem no cartao ("PODER" em cima, o numero embaixo), nao mais no texto corrido. */
  ok('e cada um mostra o poder', disp.every(id => html.indexOf('<b>' + S.GOLPES[id][1] + '</b>') >= 0));
  /* O NIVEL saiu dos cards a pedido em 09/09/2026: dizia em que nivel a especie ensina o golpe,
     que e informacao de tabela e nao ajuda a escolher entre golpes que ele JA tem. */
  ok('e o "Nivel N" saiu de cada card', html.indexOf('Nível ') < 0);
  ok('e a frase e a pedida', html.indexOf('o resto será esquecido') >= 0);
  /* O CARD CLICAVEL E O MESMO DO POKEMON na tela que mostra a ordem do time: a FAIXA da cor do
     tipo fica na borda esquerda do BOTAO, nao do cartao de dentro. Ela ja esteve no cartao, e ali
     ficava DENTRO da moldura do botao -- lia-se como um risco solto no meio do card. */
  ok('cada opcao carrega a faixa da cor do tipo no BOTAO',
     disp.every(id => html.indexOf('style="border-left-color:' + S.corDoGolpe(id) + '"') >= 0),
     disp.map(id => S.nomeDoAtaque(id) + '=' + S.corDoGolpe(id)).join(' '));
  ok('e a cor e a MESMA do selo do tipo daquele golpe',
     disp.every(id => S.corDoGolpe(id) === S.TYPE_COLORS[S.GOLPES[id][0]]));
  ok('o confirmar nasce desabilitado', /success[^>]*disabled/.test(html));

  /* O TETO SAI DA CONSTANTE, nao de um numero repetido aqui: ele ja foi 2 e virou 3 em
     09/09/2026, e um teste que repete o numero so troca um lugar de falhar por outro. */
  const TETO = S.MAX_GOLPES;
  ok('a tela conhece o teto e ele e maior que 1', TETO >= 2, 'MAX_GOLPES = ' + TETO);
  for(let i = 0; i <= TETO; i++) S.marcarAtaque(disp[i]);   // um a MAIS que o teto
  ok('nao deixa marcar alem do teto', g.ataquesMarcados.length === TETO, g.ataquesMarcados.join(','));
  S.marcarAtaque(disp[0]);
  ok('e clicar de novo desmarca', g.ataquesMarcados.length === TETO - 1 && g.ataquesMarcados[0] === disp[1]);

  S.marcarAtaque(disp[TETO]);
  g.gymIndex = 1; g.pendingGymVictoryPool = 10;
  S.confirmarAtaques();
  ok('confirmar grava o teto de golpes e libera a marca',
     p.ataques.length === TETO && p.escolherAtaques === false && g.escolhaDeAtaques === null,
     p.ataques.map(S.nomeDoAtaque).join(' + '));
  ok('e o nivelDosAtaques nasce no nivel dele', p.nivelDosAtaques === 40);
  ok('e a jornada segue pra distribuicao de niveis', g.screen === 'levels');

  /* A FUNCAO E A REGRA, a tela e a apresentacao: um golpe que a especie nao tem nao pode passar
     por uma chamada direta -- e o botao continua sendo o unico caminho normal. */
  const q = inst('gyarados', 40); q.escolherAtaques = true;
  g.team = [q]; g.screen = ''; S.resolverEscolhaDeAtaques();
  g.ataquesMarcados = ['hydropump', 'thunderbolt'];   // o Gyarados nao aprende Raio
  S.confirmarAtaques();
  ok('e recusa golpe que a especie nao aprende', !q.ataques && q.escolherAtaques === true);
}

console.log('\n=== QUEM NAO TEM O QUE ESCOLHER NAO VE TELA ===');
{
  /* Uma tela de escolha com uma resposta so e pior que tela nenhuma -- e no nivel 5 isso e o caso
     da maioria esmagadora. */
  const noNivel5 = Object.keys(S.SPECIES).filter(id => S.ataquesDisponiveis(id, 5).length > 2).length;
  ok('poucas especies tem escolha no nivel 5', noNivel5 < 100, noNivel5 + ' de 250 tem mais de 2 golpes no Lv.5');

  g.team = []; g.screen = 'x';
  const b = inst('bulbasaur', 5); b.escolherAtaques = true;
  g.team.push(b);
  g.gymIndex = 0;
  ok('quem tem 2 ou menos recebe sem tela',
     S.resolverEscolhaDeAtaques() === false && b.escolherAtaques === false,
     'ficou com: ' + (b.ataques.map(S.nomeDoAtaque).join(',') || '(nenhum)'));

  const a = inst('abra', 20); a.escolherAtaques = true;
  g.team = [a];
  ok('e quem nao tem golpe nenhum tambem nao ve tela',
     S.resolverEscolhaDeAtaques() === false && a.ataques.length === 0 && a.escolherAtaques === false);

  /* Dois capturados na mesma leva viram duas telas em sequencia, sem ninguem guardar ordem: a fila
     e derivada da marca na instancia. */
  const x = inst('gyarados', 40), y = inst('nidoking', 40);
  x.escolherAtaques = true; y.escolherAtaques = true;
  g.team = [x, y];
  S.resolverEscolhaDeAtaques();
  ok('dois recem-capturados viram duas telas', S.escolhasDeAtaquePendentes().length === 2 && g.escolhaDeAtaques === x.id);
  g.ataquesMarcados = S.ataquesDisponiveis('gyarados', 40).slice(0, S.MAX_GOLPES);
  S.confirmarAtaques();
  ok('e a segunda abre sozinha depois da primeira', g.screen === 'escolhaDeAtaques' && g.escolhaDeAtaques === y.id);
}

console.log('\n=== O GOLPE NOVO PELO NIVEL ===');
{
  g.team = []; g.screen = ''; g.aprenderAtaque = null;
  /* O BICHO TEM QUE ESTAR CHEIO: com vaga livre ele aprende sozinho e a tela de TROCA -- que e o
     que este bloco testa -- nao abre. O Ivysaur servia quando o teto era 2 (ele tem 2 golpes ate o
     nivel 21); com o teto em 3 ele passou a ter vaga.
     O RATTATA e a fixture certa: cheio no 13 (Investida + Ataque Rapido + Presa Veloz) e cruza
     EXATAMENTE UM golpe novo no 27, a Perseguicao -- dois golpes no mesmo nivel fariam a fila ter
     dois itens e a assercao de baixo deixaria de dizer o que ela quer dizer.
     A lista sai do APRENDIZADO, nao escrita a mao, pra acompanhar o teto se ele mudar de novo. */
  const iv = inst('ratata', 20);
  iv.ataques = S.ataquesDisponiveis('ratata', 20).slice(0, S.MAX_GOLPES);
  iv.nivelDosAtaques = 20;
  g.team.push(iv);
  ok('nasce cheio ate o teto', iv.ataques.length === S.MAX_GOLPES, iv.ataques.join(','));
  ok('parado no nivel, nao pergunta nada', S.aprendizadosPendentes().length === 0);

  iv.level = 30;
  const fila = S.aprendizadosPendentes();
  ok('subiu de nivel e cruzou um golpe novo', fila.length === 1 && fila[0].golpe === 'pursuit',
     fila.map(f => S.nomeDoAtaque(f.golpe) + ' Lv.' + f.nivel).join(', '));

  /* O DESTINO da jornada tem que sobreviver a tela: a pergunta acontece DENTRO do
     continueFromEvolution, e limpar o evolucaoDepois antes dela mandaria a jornada pro teamOrder. */
  g.evolucaoDepois = 'continueJourney';
  ok('abre a tela', S.resolverAprendizados() === true && g.screen === 'aprenderAtaque');
  ok('e o destino da jornada continua guardado', g.evolucaoDepois === 'continueJourney');

  const html = S.renderAprenderAtaque();
  ok('a tela nomeia o golpe novo', html.indexOf(S.nomeDoAtaque('pursuit')) >= 0);
  /* Oferece os golpes ATUAIS pra trocar -- tantos quantos o teto permitir carregar. */
  ok('e oferece os golpes atuais pra trocar',
     (html.match(/responderAprendizado\('/g) || []).length === S.MAX_GOLPES,
     (html.match(/responderAprendizado\('/g) || []).length + ' de ' + S.MAX_GOLPES);
  ok('mais a saida de nao aprender', html.indexOf('responderAprendizado(null)') >= 0);

  g.evolucaoDepois = null;
  S.responderAprendizado(null);
  ok('recusar guarda a recusa', (iv.ataquesRecusados || []).indexOf('pursuit') >= 0);
  ok('e os golpes ficam como estavam',
     iv.ataques.join(',') === S.ataquesDisponiveis('ratata', 20).slice(0, S.MAX_GOLPES).join(','),
     iv.ataques.join(','));
  ok('e a pergunta NAO volta', S.aprendizadosPendentes().length === 0);

  const iv2 = inst('ratata', 20);
  iv2.ataques = S.ataquesDisponiveis('ratata', 20).slice(0, S.MAX_GOLPES);
  iv2.nivelDosAtaques = 20; iv2.level = 30;
  g.team = [iv2]; g.evolucaoDepois = null;
  S.resolverAprendizados();
  S.responderAprendizado('tackle');
  /* O golpe TROCADO some, o novo entra e os outros ficam onde estavam -- a lista de referencia sai
     da propria fixture pra acompanhar o teto. */
  const esperado = S.ataquesDisponiveis('ratata', 20).slice(0, S.MAX_GOLPES)
                    .map(id => id === 'tackle' ? 'pursuit' : id);
  ok('trocar poe o novo no lugar do escolhido',
     iv2.ataques.slice().sort().join(',') === esperado.slice().sort().join(','),
     iv2.ataques.map(S.nomeDoAtaque).join(' + '));
  ok('e continua no teto de golpes', iv2.ataques.length === S.MAX_GOLPES, iv2.ataques.length + ' de ' + S.MAX_GOLPES);
  ok('e a marca alcanca o nivel', iv2.nivelDosAtaques === iv2.level);

  /* Quem tem VAGA aprende sozinho: nao ha o que trocar, e PERGUNTAR seria a tela de uma resposta so
     de novo. Mas ele AVISA -- ate 09/09/2026 o golpe entrava sem uma linha em lugar nenhum, e foi
     isso que o jogador relatou. A diferenca importa: a tela do anuncio nao tem escolha, so um
     "Continuar". */
  const geo = inst('geodude', 30);
  geo.ataques = ['tackle']; geo.nivelDosAtaques = 5; geo.level = 30;
  g.team = [geo]; g.evolucaoDepois = null; g.golpesAprendidos = [];
  const abriuGeo = S.resolverAprendizados();
  ok('vaga vazia aprende sem perguntar', geo.ataques.length > 1 && g.aprenderAtaque === null,
     geo.ataques.map(S.nomeDoAtaque).join(' + '));
  ok('mas AVISA numa tela de anuncio', abriuGeo === true && g.screen === 'golpeAprendido', g.screen);
  S.seguirDoGolpeAprendido();
  /* Depois do Continuar a fila NÃO precisa estar vazia -- na Gen 3 o Geodude aprende mais golpes
     de dano do que cabem em dois, então o que vem depois do anúncio é a tela de TROCA. O que se
     cobra aqui é que o fluxo TERMINE, não que ele acabe num passo só. */
  let voltasGeo = 0;
  while(S.resolverAprendizados() && voltasGeo++ < 20){
    if(g.screen === 'golpeAprendido'){ S.seguirDoGolpeAprendido(); continue; }
    S.responderAprendizado(null);
  }
  ok('e o fluxo TERMINA depois do Continuar', voltasGeo < 20, voltasGeo + ' voltas');

  /* A JANELA E O QUE ELE CRUZOU AGORA. Sem o nivelDosAtaques, um pokemon nivel 40 abrindo o save
     receberia de uma vez a pergunta de tudo que aprendeu no caminho. */
  const velho = inst('nidoking', 50);
  velho.ataques = ['tackle', 'thrash'];
  velho.nivelDosAtaques = 50;
  g.team = [velho]; g.evolucaoDepois = null;
  ok('save antigo nao vira uma fila de dez perguntas', S.aprendizadosPendentes().length === 0);
}

console.log('\n=== A EVOLUCAO DESTRAVA O QUE E NOVO NA FORMA NOVA ===');
{
  /* O problema: a Gen 2 lista quase tudo de quem evolui por pedra NO NIVEL 1, e a janela conta so
     nivel -- entao esses golpes ficavam inalcancaveis pra sempre. Medido: 28 dos 112 degraus. */
  let afetados = 0, golpes = 0, pior = 0;
  Object.keys(S.EVOLUTIONS).forEach(de => {
    const ev = S.EVOLUTIONS[de];
    if(!S.SPECIES[ev.into]) return;
    const tinha = new Set(S.ataquesDisponiveis(de, ev.level));
    const novos = S.ataquesDisponiveis(ev.into, ev.level).filter(id => !tinha.has(id));
    if(novos.length){ afetados++; golpes += novos.length; pior = Math.max(pior, novos.length); }
  });
  /* A GEN 3 ENGORDOU ISTO: eram 28 degraus e 38 golpes na Gen 2, hoje são 34 e 58. A causa é que
     a Gen 3 deu golpe novo a muita forma evoluída (Garra de Metal ao Charizard, Onda de Calor,
     Ás Aéreo) e a regra de cobertura de tipo acrescentou mais alguns. */
  ok('um terço dos degraus tem golpe novo na forma nova', afetados >= 30 && afetados <= 38,
     afetados + ' de 112 degraus, ' + golpes + ' golpes, pior caso ' + pior);
  /* O pior caso subiu de 3 pra 5, e ele NÃO vira cinco telas: os que cabem em vaga livre entram
     juntos num anúncio só; tela de troca só existe pra quem já tem os dois golpes. */
  ok('e o pior caso cabe em poucas telas', pior <= 5, pior + ' golpes no pior degrau');

  g.team = []; g.evolucaoDepois = null; g.aprenderAtaque = null;
  const mk = inst('magikarp', 19);
  mk.ataques = S.ataquesDisponiveis('magikarp', 19).slice(0, 2);
  mk.nivelDosAtaques = 19; mk.especieDosAtaques = 'magikarp';
  g.team = [mk];
  mk.level = 20; S.tryEvolve(mk);
  ok('o Magikarp virou Gyarados', mk.speciesId === 'gyarados');
  ok('e a janela ainda aponta pra forma ANTIGA', mk.especieDosAtaques === 'magikarp');
  const destravados = S.golpesDaEvolucao(mk);
  ok('a evolucao destrava Pancadaria e Mordida (o Gyarados nunca as tinha)',
     destravados.indexOf('thrash') >= 0 && destravados.indexOf('bite') >= 0,
     destravados.map(S.nomeDoAtaque).join(', '));

  let telas = 0;
  while(S.resolverAprendizados() && telas < 8){
    telas++;
    /* A tela de ANUNCIO entra no mesmo laco: ela tambem devolve true, e quem responde e outro
       botao. Sem este ramo o teste morre num aprenderAtaque nulo -- foi assim que ele acusou a
       tela nova pela primeira vez. */
    if(g.screen === 'golpeAprendido'){ S.seguirDoGolpeAprendido(); continue; }
    const p2 = g.team.find(x => x.id === g.aprenderAtaque.id);
    const fraco = p2.ataques.slice().sort((a,b)=>S.GOLPES[a][1]-S.GOLPES[b][1])[0];
    S.responderAprendizado(S.GOLPES[g.aprenderAtaque.golpe][1] > S.GOLPES[fraco][1] ? fraco : null);
  }
  ok('e o Gyarados termina com Pancadaria', mk.ataques.indexOf('thrash') >= 0,
     mk.ataques.map(S.nomeDoAtaque).join(' + '));
  ok('a janela alcanca a especie nova', mk.especieDosAtaques === 'gyarados');
  ok('e a pergunta NAO volta na distribuicao seguinte', S.aprendizadosPendentes().length === 0);

  /* A ORDEM IMPORTA: destravar nao pode virar "reabrir tudo". Um Charmeleon que escolheu 2 entre 5
     nao pode ser perguntado de novo sobre os outros 3 so por ter evoluido. */
  const ch = inst('charmeleon', 35);
  ch.ataques = ['flamethrower','slash']; ch.nivelDosAtaques = 35; ch.especieDosAtaques = 'charmeleon';
  g.team = [ch]; g.evolucaoDepois = null;
  ch.level = 36; S.tryEvolve(ch);
  const novos = S.golpesDaEvolucao(ch);
  /* Na Gen 2 era só o Ataque de Asa; a Gen 3 acrescentou a Onda de Calor ao Charizard. O que o
     teste cobra continua sendo o mesmo: só entra o que a forma NOVA ensina e a antiga não. */
  ok('so entra o que a forma NOVA tem e a antiga nao tinha',
     novos.length === 2 && novos.indexOf('wingattack') >= 0 && novos.indexOf('heatwave') >= 0,
     novos.map(S.nomeDoAtaque).join(', ') || '(nenhum)');
  ok('e nao o que o jogador ja tinha recusado ou deixado passar',
     novos.every(id => S.ataquesDisponiveis('charmeleon', 36).indexOf(id) < 0));

  /* O CASO REPORTADO EM 09/09/2026, e a resposta MUDOU. Na Gen 2 a Starmie não ensinava um golpe
     de dano novo por nível (tudo dela era nível 1 e o Staryu já tinha), e a resposta registrada foi
     "o Psychic que você espera dela é TM". Com a base na Gen 3 isso continua verdade PELO NÍVEL --
     mas a regra de cobertura de tipo passou a dar Psíquico à Starmie, porque ela é Água/Psíquico e
     não batia com o próprio tipo. Ou seja, o incômodo do jogador se resolveu por outro caminho. */
  const st = inst('staryu', 37);
  st.ataques = ['bubblebeam','swift']; st.nivelDosAtaques = 37; st.especieDosAtaques = 'staryu';
  g.team = [st]; st.level = 43; S.tryEvolve(st);
  ok('a Starmie AGORA tem Psiquico -- pela cobertura de tipo, nao pelo nivel',
     st.speciesId === 'starmie' && S.ataquesDisponiveis('starmie', 99).indexOf('psychic') >= 0,
     'lista dela: ' + S.ataquesDisponiveis('starmie', 45).map(S.nomeDoAtaque).join(', '));
  ok('e o Staryu continua sem ele (a lacuna era so da Starmie, que e Psiquico)',
     S.ataquesDisponiveis('staryu', 99).indexOf('psychic') < 0);
}

console.log('\n=== O QUE AS TELAS DIZEM ===');
{
  /* O CARTÃO é o bloco que as TRÊS telas de golpe usam (captura, aprendizado e anúncio). O tipo
     sai por extenso num selo proprio: a cor sozinha nao diz qual e -- o roxo do Fantasma e o do
     Psiquico se parecem, e e justamente entre esses dois que a escolha decide.
     O selo é o typePill DE VERDADE, o mesmo da Pokedex e da batalha: se alguem trocar por uma cor
     recriada na mao, Sombrio aqui deixa de ser o marrom de la. */
  const cartao = S.cartaoDeGolpe('rockslide', true);
  ok('o cartao do golpe traz o nome, o TIPO e o poder',
     cartao.indexOf('Deslizamento de Rochas') >= 0 && cartao.indexOf('>Pedra<') >= 0 && cartao.indexOf('<b>75</b>') >= 0,
     cartao.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  ok('e o selo do tipo e o typePill do jogo, com a cor de la',
     cartao.indexOf('class="type-pill" style="background:' + S.TYPE_COLORS.Rock) >= 0);
  ok('sem o "true" ele nao repete o tipo (o cabecalho ja tem o selo embaixo)',
     S.cartaoDeGolpe('rockslide').indexOf('type-pill') < 0);

  const on2 = inst('onix', 40);
  on2.ataques = ['rockslide','bind']; on2.nivelDosAtaques = 30;
  g.team = [on2];
  g.aprenderAtaque = { id: on2.id, golpe: 'ancientpower', nivel: 37 };
  const h = S.renderAprenderAtaque();
  /* AS FRASES SÃO AS PEDIDAS, palavra por palavra (09/09/2026). Saiu daqui o "Aprendido no level
     N, porém ele já possui 2 golpes": ele existia pra justificar a pergunta, e a pergunta se
     justifica sozinha com os dois golpes atuais logo abaixo. */
  ok('a tela de aprendizado usa a frase pedida',
     h.indexOf('quer aprender um golpe novo!') >= 0 &&
     h.indexOf('Escolha qual será substituído') >= 0);
  ok('e o nivel do golpe NAO aparece mais', h.indexOf('Aprendido no level') < 0);
  ok('e o "Esquecer este" saiu de cada card', h.indexOf('Esquecer este') < 0);
  /* O TIPO POR EXTENSO continua em cada card, e isso é a regra da casa: a cor sozinha não separa
     Fantasma de Psíquico. No cabeçalho ele vem no selo "Tipo: X"; nos dois cards de escolha, numa
     linha embaixo do nome. */
  /* O selo do tipo perdeu o rotulo "Tipo:" e virou o typePill do jogo -- a MESMA cor da Pokedex,
     da fileira do time e da batalha. */
  ok('o golpe novo traz o selo do tipo, sem o rotulo "Tipo:"',
     h.indexOf('>Pedra<') >= 0 && h.indexOf('Tipo: ') < 0);
  ok('e o selo usa a cor do tipo que o jogo ja tem',
     h.indexOf('style="background:' + S.TYPE_COLORS.Rock) >= 0);
  ok('e cada card de escolha mostra o tipo por extenso',
     (h.match(/>Pedra</g) || []).length >= 2 && h.indexOf('>Normal<') >= 0);
  ok('e o poder de cada golpe aparece', h.indexOf('<b>75</b>') >= 0 && h.indexOf('<b>60</b>') >= 0);
  g.aprenderAtaque = null;
}

console.log('\n=== O SAVE ANTIGO E O INICIAL ===');
{
  /* Todo pokemon que ja existe hoje entra sem golpe escolhido, e nao pode ganhar seis telas de
     escolha so por abrir o save: ele recebe os dois que mais batem. */
  /* O SAVE ANTIGO NAO GANHA GOLPE ESCOLHIDO POR NOS -- ele ganha A TELA, uma por pokemon, ao abrir.
     Escolher no lugar do jogador seria decidir a coisa mais forte do jogo por ele: medido, o par de
     golpes vale 79 pontos de taxa de vitoria entre o melhor e o pior. */
  const p = { speciesId:'gyarados', level:40, name:'Gyarados', id:'x1' };
  const h = S.hydrateTeamMember(p);
  ok('o save antigo e MARCADO pra escolher, nao preenchido', !h.ataques && h.escolherAtaques === true);
  ok('e a janela de nivel ja nasce no nivel dele', h.nivelDosAtaques === 40);
  ok('e a janela de ESPECIE tambem', h.especieDosAtaques === 'gyarados');

  const meio = S.hydrateTeamMember({ speciesId:'gyarados', level:40, escolherAtaques:true, id:'x2' });
  ok('e quem parou NO MEIO da escolha continua escolhendo', !meio.ataques && meio.escolherAtaques === true);

  /* Abrir o save abre a fila e VOLTA pra tela em que o save estava -- sem isso o jogador responderia
     as perguntas e cairia numa tela qualquer. */
  const time = [['venusaur',60],['charizard',58],['caterpie',5],['abra',20]]
    .map(([id, lv], i) => ({ id:'sv'+i, speciesId:id, level:lv, name:S.SPECIES[id].name }));
  g.team = S.hydrateTeam(time);
  g.screen = 'walkNext'; g.escolhaDepois = null; g.escolhaDeAtaques = null; g.ataquesMarcados = [];
  let telas = 0, abriu = S.escolhaDoSavePendente();
  ok('abrir um save antigo abre a tela do primeiro', abriu === true && g.screen === 'escolhaDeAtaques');
  ok('e guarda pra onde voltar', g.escolhaDepois === 'walkNext');
  while(abriu && telas < 10){
    telas++;
    const q = g.team.find(x => x.id === g.escolhaDeAtaques);
    S.ataquesDisponiveis(q.speciesId, q.level).slice(0, S.MAX_GOLPES).forEach(id => S.marcarAtaque(id));
    S.confirmarAtaques();
    abriu = (g.screen === 'escolhaDeAtaques');
  }
  /* QUANTAS TELAS sai da propria fixture, nao de um numero escrito aqui: quem tem MAX_GOLPES ou
     menos disponiveis e preenchido sozinho. Com o teto em 2 eram dois (Venusaur e Charizard); com
     o teto em 3 o Venusaur passou a ter exatamente 3 e some da fila -- e e isso que a conta abaixo
     acompanha sozinha se o teto mudar de novo. */
  const comEscolha = g.team.filter(p => S.ataquesDisponiveis(p.speciesId, p.level).length > S.MAX_GOLPES).length;
  ok('uma tela por pokemon COM escolha, e so por eles', telas === comEscolha,
     telas + ' telas para ' + comEscolha + ' com escolha (teto ' + S.MAX_GOLPES + ')');
  ok('e no fim volta pra tela do save', g.screen === 'walkNext' && !g.escolhaDepois);
  ok('o Caterpie Lv.5 recebeu o unico golpe dele sem tela',
     (g.team[2].ataques || []).length === 1, (g.team[2].ataques || []).map(S.nomeDoAtaque).join(','));
  ok('e o Abra ficou sem golpe, caindo no motor de tipo', (g.team[3].ataques || []).length === 0);
  ok('abrir o save de novo nao pergunta mais nada', S.escolhaDoSavePendente() === false);

  /* O inicial nao escolhe: no nivel 5 os sete tem UM golpe de dano so. */
  const semEscolha = ['bulbasaur','charmander','squirtle','chikorita','cyndaquil','totodile','pichu']
    .filter(id => S.ataquesDisponiveis(id, 5).length > 1);
  ok('nenhum dos sete iniciais tem escolha no nivel 5', semEscolha.length === 0, semEscolha.join(','));

  g.team = []; g.startersShiny = {};
  S.chooseStarter('charmander');
  const st = g.team[0];
  ok('e o inicial ja sai com o golpe dele', (st.ataques || []).length === 1 && !st.escolherAtaques,
     (st.ataques || []).map(S.nomeDoAtaque).join(','));
}

console.log('\n=== O CAMPO SOBREVIVE AO SAVE E AO CODIGO DE TIME ===');
{
  const txt = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  ['escolhaDeAtaques','ataquesMarcados','aprenderAtaque'].forEach(campo => {
    const noSerialize = new RegExp(campo + ':\\s*game\\.' + campo).test(txt);
    const noLoad = new RegExp('game\\.' + campo + '\\s*=\\s*data\\.' + campo).test(txt);
    ok('o ' + campo + ' e gravado e relido', noSerialize && noLoad);
  });
  ok('as duas telas sao ponto seguro de gravacao',
     /SAFE_SAVE_SCREENS[\s\S]{0,400}'escolhaDeAtaques'/.test(txt) &&
     /SAFE_SAVE_SCREENS[\s\S]{0,400}'aprenderAtaque'/.test(txt));
  ok('e as duas estao no switch do render',
     /case 'escolhaDeAtaques':/.test(txt) && /case 'aprenderAtaque':/.test(txt));

  /* O CODIGO DE TIME (ligas, ginasio da cidade, online) carrega so "especie:nivel:shiny" -- os
     golpes NAO viajam nele, de proposito: o decodeTeamCode recusa um quarto campo e o
     sanitizeTeamCode existe pra apagar o que nao esta no codigo. Ali a batalha continua exatamente
     como e hoje, no motor de tipo. Se um dia isso mudar, e aqui que se descobre. */
  const decodificado = S.decodeTeamCode(S.encodeTeamCode([inst('gyarados', 40)]));
  ok('o codigo de time NAO carrega golpe (as ligas seguem no motor de tipo)',
     decodificado.length === 1 && !decodificado[0].ataques);
}

console.log('\n=== O SERVIDOR TAMBEM CARREGA OS GOLPES ===');
{
  /* A Torre e o Ginasio da Cidade montam o time a partir dos SAVES, e o pokemon leva os golpes
     escolhidos junto. Se o campo se perder no caminho, o mesmo pokemon luta de um jeito na jornada
     e de outro na Torre -- e nada acusa. */
  const srv = fs.readFileSync(path.join(RAIZ, 'functions', 'index.js'), 'utf8');
  ok('o resolverTimeDosSaves devolve os ataques', /ataques:\s*Array\.isArray\(real\.ataques\)/.test(srv));
  ok('e o createInstance da Torre recola o campo', /if\(Array\.isArray\(p\.ataques\)\)\s*inst\.ataques/.test(srv));

  /* A tabela GOLPES e a SEXTA duplicada. Divergir nela e a mesma batalha com resultado diferente
     no cliente e no servidor. Comparada por VALOR: os dois arquivos tem comentarios proprios. */
  const daqui = (t) => {
    const m = t.match(/const GOLPES = \{[\s\S]*?\n\};/);
    if(!m) return null;
    const o = {}; (new Function('const GOLPES_X = ' + m[0].replace('const GOLPES =', '') + '; return GOLPES_X;'))();
    return JSON.stringify(new Function(m[0] + ' return GOLPES;')());
  };
  const cli = daqui(txtCliente());
  const ser = daqui(srv);
  ok('e a tabela GOLPES e IDENTICA nos dois motores', cli !== null && cli === ser,
     cli === ser ? Object.keys(JSON.parse(cli)).length + ' golpes' : 'divergem');
}
function txtCliente(){ return fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8'); }

console.log('\n=== O LOG NOMEIA O GOLPE QUE SAIU ===');
{
  /* O motor manda o id, o cliente escolhe a palavra -- a mesma regra do MOVE_BY_TYPE. Sem o id, o
     log nomeava o golpe DEDUZIDO do tipo, e um Gyarados de Hidro Bomba aparecia batendo de
     "Jato d'Agua". */
  const meu = [inst('gyarados', 50)]; meu[0].ataques = ['hydropump','bite'];
  S.equiparItens(meu, null);
  const dele = [inst('onix', 50)];
  S.equiparItens(dele, null);
  const r = S.simulateGymBattle(meu, dele, S.makeSeededRng('log-1'));
  const m = (r.matchups || [])[0];
  ok('o confronto carrega o ID do golpe', !!m && ['hydropump','bite'].indexOf(m.playerMoveId) >= 0,
     m ? String(m.playerMoveId) : 'sem matchup');
  ok('e o selo sai com o nome dele',
     S.golpeSeloHtml('gyarados', m.playerMove, m.playerMoveId).indexOf(S.nomeDoAtaque(m.playerMoveId)) >= 0,
     S.golpeSeloHtml('gyarados', m.playerMove, m.playerMoveId));

  /* Quem nao tem golpe escolhido cai no nome deduzido do tipo, como sempre foi -- log antigo nao
     pode sumir nem sair sem golpe. */
  /* SEM ID, O SELO TEM QUE SAIR IDENTICO ao que saia antes desta feature -- em todas as especies e
     em todos os tipos. E o que garante que log velho e pokemon sem golpe escolhido nao mudam. */
  let mudou = 0, exemplo = '';
  Object.keys(S.SPECIES).forEach(id => (S.SPECIES[id].types || []).forEach(tp => {
    const antes = S.seloDeGolpe(S.nomeDoGolpe(id, tp), tp);
    if(S.golpeSeloHtml(id, tp, null) !== antes){ mudou++; if(!exemplo) exemplo = id + '/' + tp; }
  }));
  ok('e sem id o selo sai exatamente como saia antes', mudou === 0, exemplo || '250 especies');
}

console.log('\n=== O FLUXO PASSA PELAS DUAS PERGUNTAS ===');
{
  /* Ler o CODIGO, e nao so o comportamento: e a mesma trava do equiparItens/applySpecialtyBuff. Um
     caminho novo que suba nivel sem passar por aqui deixa a pergunta pra nunca. */
  const txt = txtCliente();
  /* Recortado por INDICE e nao por regex de corpo de funcao: o corpo tem chaves internas, e um
     "\n}" preguicoso para na primeira delas -- o teste daria FALHA com o codigo certo. */
  const trecho = (nome, n) => { const i = txt.indexOf('function ' + nome + '(){'); return i < 0 ? '' : txt.slice(i, i + n); };
  const funil = trecho('startLevelDistribution', 900);
  ok('o funil da captura chama a escolha antes de distribuir nivel',
     /resolverEscolhaDeAtaques\(\)\)\s*return;/.test(funil));

  const cont = trecho('continueFromEvolution', 1200);
  ok('e o despachante da evolucao pergunta pelo golpe novo',
     /resolverAprendizados\(\)\)\s*return;/.test(cont));
  ok('e SO consome o destino depois disso',
     cont.indexOf('resolverAprendizados') < cont.indexOf('game.evolucaoDepois = null'));

  ok('o recem-capturado nasce marcado', /mon\.escolherAtaques = true;/.test(txt));

  /* Os DOIS caminhos que abrem um save chamam a fila. Deixar num so era garantir que o outro
     ficasse sem -- e o continueCompleteSave e justamente o do save campeao, que e o que mais tem
     pokemon de nivel alto esperando escolha. */
  ok('os dois caminhos de abrir save chamam a fila da escolha',
     (txt.match(/if\(escolhaDoSavePendente\(\)\) return;/g) || []).length === 2);
  ok('e a volta passa pelo destino guardado',
     /function seguirDaEscolhaDeAtaques\(\)\{[\s\S]{0,400}?game\.escolhaDepois = null;/.test(txt));

  /* O Bonus de Kanto e a ULTIMA coisa que sobe nivel na jornada. Sem ele na condicao, um golpe
     cruzado ali so seria perguntado depois da primeira luta da Elite. */
  ok('e o Bonus de Kanto tambem pergunta',
     /evs\.length \|\| evolucoesPendentes\(\)\.length \|\| aprendizadosPendentes\(\)\.length/.test(txt));
}

console.log('\n=== O ANUNCIO DO GOLPE QUE ENTRA DE GRACA ===');
{
  /* Reportado em 09/09/2026: "no level 12 ela aprendeu Folha Navalha, deveria aparecer uma tela
     dizendo que ela aprendeu Folha Navalha". Aprender com VAGA LIVRE nao precisa de pergunta --
     nao ha o que trocar --, mas precisa de AVISO: e o segundo golpe de TODOS os sete iniciais. */
  g.team = []; g.evolucaoDepois = null; g.aprenderAtaque = null; g.golpesAprendidos = [];
  const chk = inst('chikorita', 12);
  chk.ataques = ['tackle']; chk.nivelDosAtaques = 5; chk.especieDosAtaques = 'chikorita';
  g.team = [chk];
  ok('a fila abre tela', S.resolverAprendizados() === true);
  ok('e a tela e o ANUNCIO, nao a de troca', g.screen === 'golpeAprendido', g.screen);
  ok('o golpe entrou na vaga livre', chk.ataques.join('+') === 'tackle+razorleaf', chk.ataques.join('+'));
  ok('e o anuncio nomeia a Folha Navalha', S.renderGolpeAprendido().indexOf('Folha Navalha') >= 0);
  S.seguirDoGolpeAprendido();
  ok('depois do Continuar a lista esvazia', (g.golpesAprendidos||[]).length === 0);
  ok('e a pergunta nao volta', S.aprendizadosPendentes().length === 0);
}

console.log('\n=== O GOLPE NAO SOME NA EVOLUCAO ===');
{
  /* A Gen 2 re-lista no NIVEL 1 quase tudo que a forma anterior ensinava mais tarde: Folha Navalha
     e 8 na Chikorita e 1 na Bayleef. Com a janela contando so a tabela nova esses golpes caiam
     abaixo do nivelDosAtaques e ficavam inalcancaveis PRA SEMPRE quando a evolucao e o nivel do
     golpe caiam na mesma distribuicao -- 61 dos 117 degraus perdiam pelo menos um golpe assim. */
  g.team = []; g.evolucaoDepois = null; g.aprenderAtaque = null; g.golpesAprendidos = [];
  const ck = inst('chikorita', 5);
  ck.ataques = ['tackle']; ck.nivelDosAtaques = 5; ck.especieDosAtaques = 'chikorita';
  g.team = [ck];
  ck.level = 16; S.tryEvolve(ck);                  // salta 5 -> 16: evolui ANTES de aprender
  ok('a Chikorita virou Bayleef sem ter aprendido Folha Navalha',
     ck.speciesId === 'bayleef' && ck.ataques.indexOf('razorleaf') < 0);
  const filaCk = S.aprendizadosPendentes().filter(x => x.p === ck).map(x => x.golpe);
  ok('e a Folha Navalha continua na fila depois de evoluir', filaCk.indexOf('razorleaf') >= 0,
     filaCk.map(S.nomeDoAtaque).join(', ') || '(fila vazia)');
  let voltasCk = 0;
  while(S.resolverAprendizados() && voltasCk++ < 8){
    if(g.screen === 'golpeAprendido'){ S.seguirDoGolpeAprendido(); continue; }
    S.responderAprendizado(ck.ataques[0]);
  }
  ok('e a Bayleef termina COM ela', ck.ataques.indexOf('razorleaf') >= 0, ck.ataques.join('+'));

  /* O QUE DECIDE E SE ELE TERIA APRENDIDO ANTES DE EVOLUIR, e nao se a forma nova ensina.
     Reportado em 09/09/2026: a Cleffa foi do 15 pro 20 de uma vez, evoluiu, e perdeu a Folha
     Magica que ela aprende no 17. A Clefairy nao ensina esse golpe -- mas 17 e MENOR que o 20 da
     evolucao, entao subindo de um em um ela teria a Folha Magica tres niveis antes de virar
     Clefairy. Sao 26 golpes em 20 degraus nessa situacao. */
  g.team = []; g.evolucaoDepois = null; g.aprenderAtaque = null; g.golpesAprendidos = [];
  const cf = inst('cleffa', 15);
  cf.ataques = []; cf.nivelDosAtaques = 15; cf.especieDosAtaques = 'cleffa';
  g.team = [cf]; cf.level = 20; S.tryEvolve(cf);
  ok('a Cleffa virou Clefairy pulando o nivel 17', cf.speciesId === 'clefairy');
  ok('e a Folha Magica do 17 continua na fila -- ela e ANTERIOR a evolucao (20)',
     S.aprendizadosPendentes().filter(x => x.p === cf && x.golpe === 'magicalleaf').length === 1,
     S.aprendizadosPendentes().filter(x => x.p === cf).map(x => S.nomeDoAtaque(x.golpe)).join(', '));

  /* O CONTRA-EXEMPLO, e ele e que faz a regra ser uma regra: o Trovao do Pikachu e nivel 41 e o
     Pikachu evolui no 40 -- quem chega la ja e Raichu, e a Raichu nao ensina. Continua perdido, e
     e assim no jogo original. Sao 22 golpes nessa situacao. */
  g.team = []; const pk = inst('pikachu', 40);
  pk.ataques = ['thunderbolt','quickattack']; pk.nivelDosAtaques = 40; pk.especieDosAtaques = 'pikachu';
  g.team = [pk]; pk.level = 41; S.tryEvolve(pk);
  ok('mas o que vem DEPOIS da evolucao nao volta (Raichu sem Trovao)',
     S.aprendizadosPendentes().filter(x => x.p === pk && x.golpe === 'thunder').length === 0);
  /* E a Batida, que o Pikachu aprende no 20 (antes do 40), ESSA volta. */
  g.team = []; const pk2 = inst('pikachu', 19);
  pk2.ataques = ['thundershock']; pk2.nivelDosAtaques = 19; pk2.especieDosAtaques = 'pikachu';
  g.team = [pk2]; pk2.level = 40; S.tryEvolve(pk2);
  ok('e a Batida do nivel 20 volta, porque e anterior a evolucao',
     S.aprendizadosPendentes().filter(x => x.p === pk2 && x.golpe === 'slam').length === 1,
     pk2.speciesId + ': ' + S.aprendizadosPendentes().filter(x => x.p === pk2).map(x => S.nomeDoAtaque(x.golpe)).join(', '));
}

console.log('\n=== O CARROSSEL QUE TRAVAVA O JOGO ===');
{
  /* Tirar um golpe TAMBEM e recusar ele. Sem isso o golpe retirado voltava pra fila no instante
     seguinte -- ele esta sempre dentro da janela quando os dois foram aprendidos na mesma
     distribuicao -- e a tela reabria pros dois alternadamente, sem fim e sem saida. Medido com um
     Nidoran macho nivel 30: 40 telas em 40 voltas, a jornada parava ali. */
  g.team = []; g.aprenderAtaque = null; g.golpesAprendidos = [];
  const nd = inst('nidoranm', 30);
  nd.ataques = ['tackle']; nd.nivelDosAtaques = 5; nd.especieDosAtaques = 'nidoranm';
  g.team = [nd];
  let telasNd = 0;
  while(S.resolverAprendizados() && telasNd < 30){
    telasNd++;
    if(g.screen === 'golpeAprendido'){ S.seguirDoGolpeAprendido(); continue; }
    S.responderAprendizado(nd.ataques[0]);        // troca sempre o primeiro: o pior caso
  }
  ok('a fila TERMINA em vez de girar pra sempre', telasNd < 30, telasNd + ' telas');
  ok('e o golpe retirado fica recusado', (nd.ataquesRecusados||[]).length > 0,
     (nd.ataquesRecusados||[]).map(S.nomeDoAtaque).join(', '));
}

console.log('\n=== O METRONOMO SORTEIA E DEPOIS ESCOLHE ===');
{
  /* COMO ERA ATE 10/09/2026: as especies do METRONOMO atacavam com um TIPO sorteado, poder
     implicito de 60, e NUNCA chegavam no melhorAtaque -- o golpe escolhido delas nao valia um
     ponto de dano, entao o `ataquesDisponiveis` devolvia lista vazia pra elas e a fileira anunciava
     o Metronomo NO LUGAR dos golpes.
     COMO E AGORA, a pedido: a cada golpe o Metronomo sorteia um ATAQUE DE VERDADE da tabela (com
     tipo e poder proprios) e ele entra na MESMA disputa dos golpes escolhidos. Sai o que tira mais
     dano. Quem ainda nao tem golpe proprio (Togepi antes do nivel 21) continua so no Metronomo. */
  ok('a lista e a pedida', S.METRONOMO.join(',') === 'snorlax,cleffa,clefairy,clefable,mew,togepi,togetic',
     S.METRONOMO.join(','));

  /* AGORA ELAS ESCOLHEM GOLPE COMO TODO MUNDO. */
  ok('o Togepi tem Poder Ancestral a partir do 21',
     S.ataquesDisponiveis('togepi', 21).indexOf('ancientpower') >= 0 &&
     S.ataquesDisponiveis('togepi', 20).length === 0,
     'Lv.20: ' + JSON.stringify(S.ataquesDisponiveis('togepi', 20)) + '   Lv.21: ' + JSON.stringify(S.ataquesDisponiveis('togepi', 21)));
  ok('e o Snorlax leva o moveset inteiro dele', S.ataquesDisponiveis('snorlax', 60).length >= 5,
     S.ataquesDisponiveis('snorlax', 60).join(', '));

  /* O QUE SAI NA BATALHA E O QUE TIRA MAIS DANO. Contra um alvo em que o golpe proprio e OTIMO ele
     ganha quase sempre; contra um em que e pessimo, quase nunca. E disso que a mecanica trata --
     se o sorteado saisse sempre, o Poder Ancestral continuaria decorativo. */
  {
    const escolheu = (alvo) => {
      let ap = 0;
      for(let i = 0; i < 1500; i++){
        const a = S.createInstance('togepi', 25); a.ataques = S.ataquesDisponiveis('togepi', 25);
        if(S.tipoDoGolpe(a, S.createInstance(alvo, 25), S.makeSeededRng('esc' + alvo + i)).golpe === 'ancientpower') ap++;
      }
      return 100 * ap / 1500;
    };
    /* Charizard e Fogo/Voador: Pedra bate 4x nele. Geodude e Pedra/Terra: Pedra bate 0,5x. */
    const bom = escolheu('charizard'), ruim = escolheu('geodude');
    ok('contra quem o golpe proprio arrebenta, ele sai quase sempre', bom > 80, bom.toFixed(1) + '%');
    ok('e contra quem ele e ruim, o sorteado assume', ruim < 40, ruim.toFixed(1) + '%');
  }

  /* QUEM AINDA NAO TEM GOLPE continua so no Metronomo -- e o Togepi antes do 21, que era o caso
     do pedido. O sorteio cobre a tabela inteira. */
  {
    const vistos = new Set();
    for(let i = 0; i < 2000; i++){
      const a = S.createInstance('togepi', 10); a.ataques = S.ataquesDisponiveis('togepi', 10);
      vistos.add(S.tipoDoGolpe(a, S.createInstance('onix', 25), S.makeSeededRng('so' + i)).golpe);
    }
    ok('sem golpe proprio ele so sorteia, e sorteia MUITO golpe', vistos.size > 100, vistos.size + ' golpes distintos');
  }

  /* A FILEIRA MOSTRA OS DOIS: os golpes escolhidos MAIS o selo do Metronomo. Antes ele aparecia NO
     LUGAR deles, porque ali eles nao valiam nada. */
  {
    const p = S.createInstance('togepi', 30); p.ataques = S.ataquesDisponiveis('togepi', 30);
    const html = S.golpesDoTimeHtml(p);
    ok('a fileira anuncia o Metronomo', html.indexOf('Metr\u00f4nomo') >= 0);
    ok('e mostra o golpe escolhido junto', html.indexOf(S.nomeDoAtaque('ancientpower')) >= 0, html.replace(/<[^>]*>/g, ' ').trim());
  }

  /* A FICHA DA POKEDEX nao diz mais chance nenhuma pro Metronomo: ele sai em TODO golpe -- o que e
     sorteado e QUAL golpe, nao SE ele sai. */
  {
    const metro = S.especiaisDaEspecie('togepi').find(e => e.nome === 'Metr\u00f4nomo');
    ok('a ficha traz o Metronomo sem chance', !!metro && metro.chance == null, JSON.stringify(metro));
    /* E o resto do bloco continua com a chance -- ela so saiu de quem sai sempre. */
    const sono = S.especiaisDaEspecie('gengar').find(e => e.chance != null);
    ok('e os outros especiais continuam dizendo a chance', !!sono, JSON.stringify(sono));
  }

  /* Quem nao tem golpe NEM especial continua saindo vazio: uma linha em cada fileira da defesa do
     ginasio da cidade (que vem de codigo de time e nunca carrega golpe) seria pior que nenhuma. */
  ok('quem nao tem golpe nem especial continua vazio',
     S.golpesDoTimeHtml(S.createInstance('abra', 20)) === '');
}

console.log('\n=== O GOLPE DA FORMA ANTERIOR NAO SE PERDE NA EVOLUCAO ===');
{
  /* Reportado em 09/09/2026: a Staryu aprende Raio de Bolhas no 28 e a Starmie nao ensina esse
     golpe em nivel NENHUM. Quem evolui com ele tem que continuar com ele -- e so dali pra frente
     passa a valer o moveset da forma nova. */
  ok('a Starmie realmente nao ensina Raio de Bolhas',
     S.ataquesDisponiveis('starmie', 99).indexOf('bubblebeam') < 0);

  g.team = []; g.evolucaoDepois = null; g.aprenderAtaque = null; g.golpesAprendidos = [];
  const st2 = inst('staryu', 28);
  st2.ataques = ['watergun','bubblebeam']; st2.nivelDosAtaques = 28; st2.especieDosAtaques = 'staryu';
  g.team = [st2];
  st2.level = 40; S.tryEvolve(st2);
  ok('a evolucao em si nao tira golpe nenhum',
     st2.speciesId === 'starmie' && st2.ataques.indexOf('bubblebeam') >= 0,
     st2.ataques.map(S.nomeDoAtaque).join(' + '));
  let v2 = 0;
  while(S.resolverAprendizados() && v2++ < 10){
    if(g.screen === 'golpeAprendido'){ S.seguirDoGolpeAprendido(); continue; }
    S.responderAprendizado(null);   // recusa tudo: quer ficar com o que trouxe
  }
  ok('e a fila de aprendizado tambem nao', st2.ataques.indexOf('bubblebeam') >= 0,
     st2.ataques.map(S.nomeDoAtaque).join(' + '));

  /* QUEM TIRAVA ERA A TELA DE ESCOLHA, e so ela: ela listava o moveset da forma NOVA e o golpe
     herdado nao estava la. Hoje o ataquesEscolhiveis junta os dois. */
  const sm = inst('starmie', 40);
  sm.ataques = ['bubblebeam','swift']; sm.escolherAtaques = true;
  g.team = [sm]; g.escolhaDeAtaques = null; g.escolhaDepois = null; g.screen = 'teamOrder';
  ok('o herdado entra na lista da tela de escolha',
     S.ataquesEscolhiveis(sm).indexOf('bubblebeam') >= 0,
     S.ataquesEscolhiveis(sm).map(S.nomeDoAtaque).join(', '));
  S.escolhaDoSavePendente();
  ok('e a tela mostra ele', S.renderEscolhaDeAtaques().indexOf('Raio de Bolhas') >= 0);
  S.marcarAtaque('bubblebeam'); S.marcarAtaque('watergun'); S.confirmarAtaques();
  ok('e o jogador consegue MANTER ele', sm.ataques.indexOf('bubblebeam') >= 0,
     sm.ataques.map(S.nomeDoAtaque).join(' + '));

  /* O auto-preenchimento (2 ou menos disponiveis) tambem nao pode descartar o herdado. */
  const kk = inst('kakuna', 12);
  kk.ataques = ['poisonsting']; kk.escolherAtaques = true;
  g.team = [kk]; g.escolhaDeAtaques = null; g.escolhaDepois = null; g.screen = 'teamOrder';
  S.resolverEscolhaDeAtaques();
  ok('o auto-preenchimento mantem o que ele ja trazia',
     kk.ataques.indexOf('poisonsting') >= 0, kk.ataques.map(S.nomeDoAtaque).join(' + '));
}

console.log('\n=== A OBSERVACAO DO CARTAO E O CARTAO DO TOPO ===');
{
  /* A observacao diz o que os numeros do cartao NAO contam -- a mecanica propria do golpe. Ela sai
     de uma funcao e nao de um `if` no cartao porque ja tem duas entradas e vai ter mais. */
  ok('o golpe multiplo avisa que repete', S.obsDoGolpe('doubleslap') === 'Golpe repete entre 2-5x',
     S.obsDoGolpe('doubleslap'));
  /* A FURIA NAO TEM OBSERVACAO, e isso e o desenho de hoje: ela virou PASSIVA da especie em
     10/09/2026 e saiu do cartao do golpe. Quem escolhe golpe nao escolhe passiva -- ela e anunciada
     na ficha da Pokedex, junto do sono e da anulacao. Uma observacao aqui prometeria uma escolha
     que nao existe. */
  ok('a Furia NAO avisa nada no cartao (virou passiva)', S.obsDoGolpe('rage') === '', S.obsDoGolpe('rage'));
  ok('e golpe comum nao avisa nada', S.obsDoGolpe('tackle') === '');
  ok('a observacao chega no cartao', S.cartaoDeGolpe('doubleslap', true).indexOf('Golpe repete entre 2-5x') >= 0);
  ok('e o golpe comum sai sem ela', S.cartaoDeGolpe('tackle', true).indexOf('golpe-cartao-obs') < 0);

  /* O CARTAO DO TOPO (o golpe OFERECIDO) usa o MESMO desenho dos de baixo desde 10/09/2026: fundo
     branco, faixa do tipo e o SELO DENTRO. Ele era cinza, sem moldura, com o selo pendurado FORA --
     e numa tela que existe pra COMPARAR o novo com os atuais, dois desenhos faziam a comparacao
     comecar pela pergunta errada. */
  {
    g.team = []; g.aprenderAtaque = null;
    const p = inst('growlithe', 30); p.id = 'mon1'; p.ataques = ['bite', 'ember'];
    g.team = [p]; g.aprenderAtaque = { id:'mon1', golpe:'rage' };
    const html = S.renderAprenderAtaque();
    ok('o cartao do topo usa a classe de destaque', html.indexOf('golpe-cartao destaque') >= 0);
    ok('e o selo do tipo esta DENTRO dele',
       (function(){
         const iCartao = html.indexOf('golpe-cartao destaque');
         const iSelo = html.indexOf('type-pill', iCartao);
         return iCartao >= 0 && iSelo > iCartao && (iSelo - iCartao) < 200;
       })(),
       'distancia entre o cartao e o selo: ' +
       (html.indexOf('type-pill', html.indexOf('golpe-cartao destaque')) - html.indexOf('golpe-cartao destaque')));
    ok('e nao sobrou selo pendurado do lado de fora',
       html.indexOf('<div>' + S.seloDoTipoDoGolpe('rage') + '</div>') < 0);
  }
}

console.log('\n=== O SKETCH DO SMEARGLE ===');
{
  /* No jogo oficial o Smeargle nao aprende golpe de dano NENHUM por nivel -- ele aprende Sketch,
     que copia PERMANENTEMENTE o golpe do adversario. Aqui e a mesma coisa, e de QUALQUER adversario
     que ele enfrentar (nao so de quem ele derrota), que e o que o jogo original faz.
     Medido antes: com so o Tapa Duplo (poder 15, inventado pela nossa regra de cobertura) ele ganha
     5,9% no Lv.30 e 0,2% no Lv.50 contra um painel do tamanho dele; com o Sketch, 21,9% e 26,4%. */
  g.team = []; g.screen = ''; g.aprenderAtaque = null; g.golpesAprendidos = [];
  const sm = inst('smeargle', 30);
  sm.ataques = ['doubleslap']; sm.nivelDosAtaques = 30;
  g.team = [sm];
  ok('nasce sem nada copiado', !(sm.sketch && sm.sketch.length));

  /* enfrenta tres adversarios; o golpe de cada um entra na lista */
  const copiados = [];
  ['pidgey', 'geodude', 'psyduck'].forEach(id => {
    const b = inst(id, 30); b.ataques = S.ataquesDisponiveis(id, 30);
    const r = S.simulateGymBattle([sm], [b]);
    S.registrarSketch(r.matchups).forEach(x => copiados.push(x));
    sm.hp = sm.maxHp;
  });
  ok('copiou o golpe de quem enfrentou', copiados.length >= 2, copiados.join(','));
  ok('e todos existem na tabela GOLPES', (sm.sketch || []).every(id => !!S.GOLPES[id]));
  ok('sem repetir', (sm.sketch || []).length === new Set(sm.sketch || []).size);

  /* A FILA e a TELA passam a oferecer o que ele copiou -- e essa e a graca: o fluxo de aprender
     golpe ja existia, so mudou de onde vem a oferta. */
  const fila = S.aprendizadosPendentes().filter(f => f.p === sm).map(f => f.golpe);
  ok('a fila de aprendizado oferece os copiados',
     (sm.sketch || []).every(id => fila.indexOf(id) >= 0), fila.join(','));
  const naTela = S.ataquesEscolhiveis(sm);
  ok('a tela de escolha tambem', (sm.sketch || []).every(id => naTela.indexOf(id) >= 0), naTela.join(','));
  ok('e o golpe que ele JA leva nao some da tela', naTela.indexOf('doubleslap') >= 0);

  /* RECUSAR um sketch tem que valer, como vale pra qualquer golpe -- senao a pergunta volta pra
     sempre, que foi o carrossel infinito de 09/09/2026. */
  {
    const alvo = (sm.sketch || [])[0];
    sm.ataquesRecusados = [alvo];
    const depois = S.aprendizadosPendentes().filter(f => f.p === sm).map(f => f.golpe);
    ok('sketch RECUSADO nao volta pra fila', depois.indexOf(alvo) < 0, depois.join(','));
    sm.ataquesRecusados = [];
  }

  /* O RESTO DO JOGO NAO PODE MUDAR: so o Smeargle tem sketch. */
  {
    const gy = inst('gyarados', 30); gy.ataques = ['bite'];
    g.team = [gy];
    S.registrarSketch([{ playerSpecies:'gyarados', enemyMoveId:'hyperbeam' }]);
    ok('quem nao e Smeargle nao copia nada', !(gy.sketch && gy.sketch.length));
    ok('e a tela dele continua saindo do APRENDIZADO da especie',
       S.ataquesEscolhiveis(gy).every(id => S.ataquesDisponiveis('gyarados', 30).indexOf(id) >= 0 || id === 'bite'));
  }

  /* ADVERSARIO SEM GOLPE ESCOLHIDO (liga, online, save antigo) ataca pelo motor de tipo e nao tem
     id -- ali nao ha o que copiar, e o registrador tem que aguentar isso sem inventar. */
  {
    const sm2 = inst('smeargle', 30); sm2.ataques = ['doubleslap'];
    g.team = [sm2];
    const novos = S.registrarSketch([{ playerSpecies:'smeargle', enemyMoveId:null },
                                     { playerSpecies:'smeargle', enemyMoveId:'naoexiste' }]);
    ok('adversario sem golpe nao vira sketch', novos.length === 0 && !(sm2.sketch && sm2.sketch.length));
  }
}

console.log(falhas ? '\n' + falhas + ' FALHA(S).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
