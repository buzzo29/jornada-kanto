/**
 * RESGATE POKÉMON -- o terceiro minigame admin, no cliente (20/09/2026).
 *
 * O que ele existe pra pegar, em ordem de importância:
 *   1. o ACESSO: o botão e a porta dependem de `admin === true`, e NADA MAIS autoriza;
 *   2. o PARCEIRO: só quem aprende Surf, e o pedido é esse -- uma lista de outra origem devolveria
 *      pokémon que não nadam, e o jogador não teria como saber por quê;
 *   3. a VELOCIDADE ESCALA COM O NÍVEL (o pedido ao pé da letra), e é o `speedDaCorrida` do jogo;
 *   4. TODO MUNDO LEVA DOIS -- o protótipo tinha 3/2/1 e o pedido fixou em 2;
 *   5. o ADVERSÁRIO é Lv.60 e sai da mesma lista;
 *   6. os PONTOS SÓ CONTAM NA PRAIA, que é a regra que dá jogo ao minigame;
 *   7. nada do save é tocado.
 *
 *   node tools/test-resgate.js
 */
const path = require('path');
const raiz = path.join(__dirname, '..');
const { createSandbox } = require(path.join(__dirname, 'game-sandbox.js'));
const S = createSandbox();
const src = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');

/* O PISO de espécies por faixa. Ele nasceu do relato de 21/09/2026 (*"o pool de pokemons que pode
   aparecer nelas ficou pequena"*) -- com 4 e 2, a caixa do (i) da ilhota alta mostrava duas linhas
   de 50%. É um PISO e não uma contagem de propósito: assim ele sobrevive ao próximo acréscimo. */
const MINIMO_POR_FAIXA = 5;

let falhas = 0;
function ok(titulo, cond, extra){
  if(cond){ console.log('  OK     ' + titulo + (extra ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHOU ' + titulo + (extra ? '   ' + extra : '')); }
}
const g = S.__getGame ? S.__getGame() : S.game;
const SP = S.SPECIES;
const mk = (id, lv, ex) => Object.assign({
  speciesId: id, level: lv, name: SP[id].name, types: SP[id].types, id: 'm' + id, hp: 1, maxHp: 1,
}, ex || {});
function contaDeTeste(){
  g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  g.saveSlots[0] = { team: [mk('blastoise', 70), mk('lapras', 55), mk('pikachu', 60),
                            mk('gyarados', 62, { shiny: true }), mk('starmie', 66), mk('slowbro', 51)],
                     badgeCount: 8, customName: 'Time A' };
  g.saveSlotsCarregados = true; g.contaCarregada = true; g.ehAdmin = true;
  g.trainerName = 'Matheus';
  g.aposentados = []; g.specialties = [];
  S.resgateZerar();
}
const inst = (id, lv, ex) => S.resgateInstancia(Object.assign({ speciesId: id, level: lv }, ex || {}), true);

/* ============================================================================
   1) O ACESSO -- é um modo ADMINISTRATIVO, e a visibilidade não é a trava
   ============================================================================ */
console.log('\n=== O ACESSO ===');
{
  contaDeTeste();
  /* ⚠️ AS ILHAS ABRIRAM PRA TODO MUNDO em 21/09/2026: este laço cobrava a RECUSA em nove dos dez
     valores e virou a trava da regra nova -- nenhum deles fecha mais a porta. */
  const casos = [
    [true, true], [false, true], ['sim', true], ['true', true], [1, true],
    [0, true], [null, true], [undefined, true], ['', true], [{}, true],
  ];
  casos.forEach(([valor, entra]) => {
    g.contaCarregada = true; g.ehAdmin = valor; g.screen = 'saveSelect'; g.modoBloqueado = null;
    S.abrirResgate();
    ok('  admin=' + JSON.stringify(valor) + ' ' + (entra ? 'ENTRA' : 'recusa'),
       (g.screen === 'resgate') === entra, 'tela: ' + g.screen);
  });
  /* ⚠️ ENQUANTO A CONTA NÃO CARREGOU ELE RECUSA -- o CONTRÁRIO da porta dos modos de campeão, que
     erra pro lado de deixar entrar. Aqui mostrar um modo administrativo a quem não é admin, mesmo
     por meio segundo, é pior que escondê-lo de quem é. */
  g.contaCarregada = false; g.ehAdmin = true; g.screen = 'saveSelect';
  S.abrirResgate();
  ok('  e a conta carregando tambem entra', g.screen === 'resgate', 'tela: ' + g.screen);

  /* ⚠️ A PORTA VIROU UMA ILHA (21/09/2026): os tres botoes administrativos da home viraram um so,
     o `Ilhas Laranja`, e cada jogo mora numa ilha do mapa. O que esta trava prova continua sendo o
     mesmo -- existe UM caminho ate aqui, e ele passa pela mesma checagem de admin. */
  contaDeTeste(); g.screen = 'saveSelect';
  ok('a home leva as Ilhas Laranja, e nao mais direto ao modo',
     S.renderSaveSelect().indexOf('abrirIlhas()') >= 0 &&
     S.renderSaveSelect().indexOf('abrirResgate()') < 0);
  const ilha_ = S.ILHAS_LARANJA.find(i => i.id === 'mikan');
  ok('  e a ilha mikan e a que leva ate aqui', !!ilha_ && ilha_.abrir === S.abrirResgate,
     ilha_ ? ilha_.jogo : 'sem ilha');
  g.screen = 'saveSelect';
  S.entrarNaIlha(S.ILHAS_LARANJA.indexOf(ilha_));
  ok('  e entrar nela abre o modo', g.screen === 'resgate', 'tela: ' + g.screen);
  g.ehAdmin = false;
  ok('  e o botao das Ilhas CONTINUA pra quem nao e admin',
     S.renderSaveSelect().indexOf('abrirIlhas()') >= 0);
  g.contaCarregada = false;
  ok('  e enquanto a conta carrega tambem', S.renderSaveSelect().indexOf('abrirIlhas()') >= 0);
  /* ⚠️ E O BLOCO DEVOLVE A TELA: o `entrarNaIlha` acima a deixou no modo, e a trava do save la
     embaixo procura o nome do modo no `serializeGame()` -- que inclui o `screen`. */
  g.contaCarregada = true; g.screen = 'saveSelect';

  /* ⚠️ E O `admin` CONTINUA FORA DO ALCANCE DO CLIENTE -- ler é seguro porque escrever não é */
  const regras = require('fs').readFileSync(path.join(raiz, 'firestore.rules'), 'utf8');
  ok('e o `admin` está na trava de campos das regras', /admin/.test(regras),
     'sem isso, uma linha no console abre o modo');
}

/* ============================================================================
   2) O PARCEIRO -- só quem APRENDE SURF, dentro dos times do jogador
   ============================================================================ */
console.log('\n=== O PARCEIRO ===');
{
  contaDeTeste();
  const lista = S.resgateElegiveis();
  ok('a lista traz só quem aprende Surf',
     lista.every(p => S.SURFISTAS.indexOf(p.speciesId) >= 0),
     lista.map(p => p.speciesId).join(','));
  /* ⚠️ O PIKACHU É O CONTROLE: ele está no time e NÃO surfa. Sem ele, uma lista que devolvesse o
     time inteiro passaria na asserção de cima por acaso. */
  ok('  e o Pikachu do time fica de fora (ele não surfa)',
     S.SURFISTAS.indexOf('pikachu') < 0 && !lista.some(p => p.speciesId === 'pikachu'));
  ok('  e os outros CINCO entram', lista.length === 5, lista.length + ' de 6');
  ok('  ordenada pela VELOCIDADE, do mais rápido pro mais lento',
     lista.every((p, i) => i === 0 || lista[i - 1].velocidade >= p.velocidade),
     lista.map(p => p.speciesId + ':' + Math.round(p.velocidade)).join(' '));

  /* ⚠️ A ORIGEM VARRE TODOS OS SAVES, e a regra das 8 insígnias é a do `towerEligiblePokemon` */
  g.saveSlots[3] = { team: [mk('tentacruel', 40)], badgeCount: 8, customName: 'Time B' };
  ok('  ela enxerga OUTRO save', S.resgateElegiveis().some(p => p.speciesId === 'tentacruel'));
  g.saveSlots[3].badgeCount = 3;
  ok('  e não enxerga um save sem as 8 insígnias',
     !S.resgateElegiveis().some(p => p.speciesId === 'tentacruel'));
  g.saveSlots[3] = null;

  /* ⚠️ QUEM VALIDA É A AÇÃO: um slot forjado no console não vira parceiro */
  contaDeTeste();
  S.resgateEscolher(0, 2);   /* o Pikachu, que não surfa */
  ok('a AÇÃO recusa quem não está na lista', S.resgate.escolhido === null,
     S.resgate.escolhido ? S.resgate.escolhido.speciesId : '(ninguém)');
  S.resgateEscolher(9, 0);
  ok('  e recusa um slot que não existe', S.resgate.escolhido === null);
  S.resgateEscolher(0, 0);
  ok('  e aceita o surfista', S.resgate.escolhido && S.resgate.escolhido.speciesId === 'blastoise');
}

/* ============================================================================
   3) A VELOCIDADE ESCALA COM O NÍVEL -- o pedido ao pé da letra
   ============================================================================ */
console.log('\n=== A VELOCIDADE ===');
{
  const v = (id, lv, ex) => S.resgateVelocidade(inst(id, lv, ex));
  const niveis = [5, 20, 40, 60, 80, 99];
  const lapras = niveis.map(n => v('lapras', n));
  ok('mais nível = mais rápido, em toda a escada',
     lapras.every((x, i) => i === 0 || x > lapras[i - 1]),
     niveis.map((n, i) => 'Lv.' + n + '=' + lapras[i].toFixed(1)).join(' '));
  ok('  e o ganho é grande: Lv.99 é bem mais rápido que Lv.5',
     lapras[5] / lapras[0] > 1.4, (lapras[5] / lapras[0]).toFixed(2) + 'x');

  /* ⚠️ ELA SAI DO `speedDaCorrida`, que é o `effectiveSpeed` DO MOTOR -- é isso que dá shiny e
     especialidade de graça, e é isso que faz um buff novo do motor entrar aqui junto. */
  ok('e ela é derivada do Speed do motor (o shiny corre mais)',
     v('gyarados', 60, { shiny: true }) > v('gyarados', 60),
     v('gyarados', 60).toFixed(1) + ' -> ' + v('gyarados', 60, { shiny: true }).toFixed(1));
  ok('  e a função lê o `speedDaCorrida` e não uma conta própria',
     /function resgateVelocidade\([^)]*\)\{?[\s\S]{0,160}speedDaCorrida/.test(src),
     'uma segunda conta divergiria do motor no primeiro ajuste');

  /* ⚠️ A FAIXA TEM QUE CABER NO MAPA: linear, o Speed cru do jogo varia 38x e o mais lento não
     daria uma volta em 90s. A raiz é o que comprime isso -- e o piso é o que impede um Magikarp
     de ficar parado no mar. */
  const todos = [];
  S.SURFISTAS.forEach(id => { if(SP[id]) [5, 30, 60, 99].forEach(n => todos.push(v(id, n))); });
  const min = Math.min(...todos), max = Math.max(...todos);
  ok('a faixa inteira cabe num mapa de 90s',
     min >= 24 && max <= 70 && max / min < 2.5,
     min.toFixed(1) + ' a ' + max.toFixed(1) + ' px/s (' + (max / min).toFixed(2) + 'x)');
  const volta = (px) => 2 * 296 / px;
  ok('  até o mais lento faz pelo menos 3 viagens ao ponto mais longe',
     Math.floor(S.RESGATE_DURACAO / volta(min)) >= 3,
     Math.floor(S.RESGATE_DURACAO / volta(min)) + ' viagens');
}

/* ============================================================================
   4) TODO MUNDO LEVA DOIS -- e a carga freia
   ============================================================================ */
console.log('\n=== A CAPACIDADE ===');
{
  ok('a capacidade é 2 pra todo mundo (o pedido)', S.RESGATE_CAPACIDADE === 2, String(S.RESGATE_CAPACIDADE));
  /* ⚠️ É UMA CONSTANTE E NÃO UM CAMPO DO PARCEIRO: no protótipo ela era 3/2/1 por espécie, e o
     pedido a fixou. Um campo por parceiro traria a mecânica velha de volta sem ninguém ver. */
  ok('  e ela não é um campo do parceiro', !/cap\s*:/.test(src.slice(src.indexOf('RESGATE_W'), src.indexOf('function renderResgate'))),
     'um `cap` por espécie seria a mecânica do protótipo de volta');

  const a = { bag: [] };
  ok('sem passageiro ele vai a 100%', Math.round(100 * S.resgateCarga(a)) === 100);
  a.bag = [{ pts: 10 }];
  ok('  com um, a 88%', Math.round(100 * S.resgateCarga(a)) === 88, Math.round(100 * S.resgateCarga(a)) + '%');
  a.bag = [{ pts: 10 }, { pts: 10 }];
  ok('  com dois, a 76%', Math.round(100 * S.resgateCarga(a)) === 76, Math.round(100 * S.resgateCarga(a)) + '%');

  /* e a carga realmente FREIA no motor, não só no rótulo */
  contaDeTeste();
  const medir = (carga) => {
    S.resgateMarZerar();
    S.resgate.corrente.y = -99;               /* fora do caminho */
    S.resgate.redemoinhos = [];
    S.resgate.ocupantes = S.RESGATE_PONTOS.map((s, i) => S.resgateNovoOcupante(i));
    const ator = S.resgateAtor(inst('blastoise', 70), 180);
    ator.bag = carga.slice();
    S.resgate.atores = [ator, S.resgateAtor(inst('lapras', 60), 200)];
    S.resgate.atores[1].alvo = null;
    S.resgate.fase = 'correndo'; S.resgate.tempo = 0;
    S.resgateIrPara(0, { x: 180, y: 50, tipo: 'mar' });
    const y0 = ator.y;
    S.resgateAtualizar(1);
    return y0 - ator.y;
  };
  const d0 = medir([]), d2 = medir([{ pts: 10 }, { pts: 10 }]);
  ok('  e a carga freia DE VERDADE no motor', Math.abs(d2 / d0 - 0.76) < 0.02,
     d0.toFixed(1) + ' px/s vazio contra ' + d2.toFixed(1) + ' cheio (' + (d2 / d0).toFixed(3) + ')');
}

/* ============================================================================
   5) O ADVERSÁRIO -- Lv.60, da mesma lista, e nunca a minha espécie
   ============================================================================ */
console.log('\n=== O ADVERSÁRIO ===');
{
  const vistos = {};
  let foraDo60 = 0, foraDaLista = 0, intocavel = 0, igualAMinha = 0;
  for(let i = 0; i < 500; i++){
    const n = S.resgateSortearNpc('blastoise');
    vistos[n.speciesId] = 1;
    if(n.level !== S.RESGATE_NPC_NIVEL) foraDo60++;
    if(S.SURFISTAS.indexOf(n.speciesId) < 0) foraDaLista++;
    if(S.SEM_CAPTURA_SELVAGEM.indexOf(n.speciesId) >= 0) intocavel++;
    if(n.speciesId === 'blastoise') igualAMinha++;
  }
  ok('ele é sempre Lv.60 (o pedido)', foraDo60 === 0, foraDo60 + ' fora do 60');
  ok('  e sempre da lista dos que aprendem Surf', foraDaLista === 0, foraDaLista + ' fora');
  /* ⚠️ OS INTOCÁVEIS SAEM: o Lugia está em `SURFISTAS`, e ele é um pokémon que o jogador não tem
     como ter -- a mesma exclusão que a Pescaria faz no time do adversário. */
  ok('  e nunca um intocável (o Lugia está na lista de Surf)', intocavel === 0,
     'Lugia surfa? ' + (S.SURFISTAS.indexOf('lugia') >= 0));
  ok('  e nunca a minha própria espécie', igualAMinha === 0,
     'dois sprites iguais no mesmo mar se leem errado');
  ok('  e ele VARIA de verdade', Object.keys(vistos).length > 25,
     Object.keys(vistos).length + ' espécies distintas em 500 sorteios');
  ok('  e ele NÃO leva a especialidade do jogador (ela é da CONTA)',
     /resgateSortearNpc[\s\S]{0,400}resgateInstancia\([^)]*,\s*false\s*\)/.test(src),
     'o segundo argumento tem que ser false');
}

/* ============================================================================
   6) OS PONTOS SÓ CONTAM NA PRAIA -- a regra que dá jogo ao minigame
   ============================================================================ */
console.log('\n=== OS PONTOS SÓ CONTAM NA PRAIA ===');
{
  contaDeTeste();
  S.resgateMarZerar();
  S.resgate.corrente.y = -99; S.resgate.redemoinhos = [];
  S.resgate.ocupantes = S.RESGATE_PONTOS.map((s, i) => S.resgateNovoOcupante(i));
  const eu = S.resgateAtor(inst('starmie', 90), S.RESGATE_PRAIA.x);
  const ele = S.resgateAtor(inst('slowbro', 20), S.RESGATE_PRAIA.x);
  ele.pensa = 1e9;                              /* o rival fica parado: o teste é sobre mim */
  S.resgate.atores = [eu, ele];
  S.resgate.fase = 'correndo'; S.resgate.tempo = 0;

  S.resgateTocarPonto(0);
  for(let k = 0; k < 600 && eu.bag.length === 0; k++) S.resgateAtualizar(1 / 30);
  ok('o resgate põe o passageiro a bordo', eu.bag.length === 1, eu.bag.length + ' a bordo');
  ok('  e NÃO pontua nada ainda', eu.pontos === 0, eu.pontos + ' pts');
  ok('  e o ponto ficou vazio', !S.resgate.ocupantes[0].speciesId);

  const aBordo = eu.bag.reduce((n, v) => n + v.pts, 0);   /* antes de a praia esvaziar o bag */
  S.resgateVoltarAPraia();
  for(let k = 0; k < 900 && eu.bag.length; k++) S.resgateAtualizar(1 / 30);
  /* ⚠️ ELA MEDIA O NÚMERO DA ILHOTA, e desde 20/09 o valor vem do BICHO -- ela caiu sozinha no dia
     em que a régua mudou, sem nada estar errado. A REGRA é "o que pontua é o que estava a bordo",
     e é isso que ela cobra agora: o valor do passageiro, seja ele qual for. */
  ok('  e só na praia ele pontua', eu.pontos === aBordo, eu.pontos + ' pts (o passageiro valia ' + aBordo + ')');
  ok('  e a entrega vai pro resumo do fim', eu.entregas.length === 1, eu.entregas.length);

  /* ⚠️ CHEIO, ELE RECUSA: quem enche a carga tem que voltar, e é isso que faz o mapa ter rota */
  eu.bag = [{ speciesId: 'staryu', pts: 10 }, { speciesId: 'krabby', pts: 10 }];
  eu.alvo = null;
  S.resgateTocarPonto(1);
  ok('com a carga cheia, a AÇÃO recusa um ponto novo', eu.alvo === null,
     eu.alvo ? 'foi pro ' + eu.alvo.tipo : '(não foi)');
  ok('  e a recusa é explicada na tela', /cheio/i.test(S.resgate.recado), S.resgate.recado);
  /* mas a praia continua valendo */
  S.resgateVoltarAPraia();
  ok('  e a praia continua valendo', eu.alvo && eu.alvo.tipo === 'praia');

  /* ⚠️ PONTO VAZIO TAMBÉM RECUSA -- e a mensagem diz por quê */
  eu.bag = []; eu.alvo = null;
  S.resgate.ocupantes[2].speciesId = null;
  S.resgateTocarPonto(2);
  ok('ponto vazio: a AÇÃO recusa', eu.alvo === null);
  ok('  e diz que está vazio', /vazio/i.test(S.resgate.recado), S.resgate.recado);
}

/* ============================================================================
   7) UM PONTO, UM RESGATADOR
   ============================================================================ */
console.log('\n=== UM PONTO, UM RESGATADOR ===');
{
  contaDeTeste();
  S.resgateMarZerar();
  S.resgate.ocupantes = S.RESGATE_PONTOS.map((s, i) => S.resgateNovoOcupante(i));
  const eu = S.resgateAtor(inst('blastoise', 70), 0);
  const ele = S.resgateAtor(inst('lapras', 60), 0);
  ele.pensa = 1e9;
  S.resgate.atores = [eu, ele];
  S.resgate.fase = 'correndo'; S.resgate.tempo = 0;
  /* eu chego primeiro e começo o resgate */
  eu.x = S.RESGATE_PONTOS[0].x; eu.y = S.RESGATE_PONTOS[0].y;
  S.resgateIrPara(0, { x: eu.x, y: eu.y, tipo: 'ponto', indice: 0 });
  S.resgateAtualizar(0.01);
  ok('quem chega primeiro fica com o ponto', S.resgate.ocupantes[0].dono === 0,
     'dono: ' + S.resgate.ocupantes[0].dono);
  /* o outro chega depois e não leva */
  ele.x = S.RESGATE_PONTOS[0].x; ele.y = S.RESGATE_PONTOS[0].y;
  S.resgateIrPara(1, { x: ele.x, y: ele.y, tipo: 'ponto', indice: 0 });
  S.resgateAtualizar(0.01);
  ok('  e o segundo não toma o ponto', S.resgate.ocupantes[0].dono === 0 && ele.resgatando === null,
     'resgatando: ' + ele.resgatando);
  ok('  e a tela dele diz que o local não está livre', /vazio|livre/i.test(ele.estado), ele.estado);

  /* ⚠️ E SAIR SOLTA O PONTO: sem isso ele ficaria reservado pra sempre pra quem foi embora */
  S.resgateIrPara(0, { x: S.RESGATE_PRAIA.x, y: S.RESGATE_PRAIA.y, tipo: 'praia' });
  ok('e quem sai SOLTA o ponto', S.resgate.ocupantes[0].dono === null && eu.resgatando === null);
  ok('  e o medidor dele volta ao começo',
     S.resgate.ocupantes[0].falta === S.RESGATE_TEMPO_NO_PONTO, String(S.resgate.ocupantes[0].falta));
}

/* ============================================================================
   8) A CORRENTE E O REDEMOINHO
   ============================================================================ */
console.log('\n=== O MAR ===');
{
  contaDeTeste();
  function andar(montar){
    S.resgateMarZerar();
    S.resgate.corrente = { y: -999, dir: 1 }; S.resgate.redemoinhos = [];
    S.resgate.ocupantes = S.RESGATE_PONTOS.map((s, i) => S.resgateNovoOcupante(i));
    const a = S.resgateAtor(inst('blastoise', 70), 180);
    a.y = 200; a.x = 100;
    const b = S.resgateAtor(inst('lapras', 60), 200); b.pensa = 1e9;
    S.resgate.atores = [a, b];
    S.resgate.fase = 'correndo'; S.resgate.tempo = 0;
    montar(a);
    S.resgateIrPara(0, { x: 300, y: 200, tipo: 'mar' });   /* pra a DIREITA */
    const x0 = a.x;
    S.resgateAtualizar(1);
    return { d: a.x - x0, estado: a.estado };
  }
  const neutro = andar(() => {});
  const favor = andar(() => { S.resgate.corrente = { y: 180, dir: 1 }; });
  const contra = andar(() => { S.resgate.corrente = { y: 180, dir: -1 }; });
  const preso = andar((a) => { S.resgate.redemoinhos = [{ x: a.x, y: a.y, r: 30 }]; });
  ok('a favor da corrente ele anda mais', Math.abs(favor.d / neutro.d - S.RESGATE_A_FAVOR) < 0.02,
     (favor.d / neutro.d).toFixed(2) + 'x  (' + favor.estado + ')');
  ok('  contra ela, menos', Math.abs(contra.d / neutro.d - S.RESGATE_CONTRA) < 0.02,
     (contra.d / neutro.d).toFixed(2) + 'x  (' + contra.estado + ')');
  ok('  e no redemoinho ele quase para',
     Math.abs(preso.d / neutro.d - S.RESGATE_REDEMOINHO_MULT) < 0.02,
     (preso.d / neutro.d).toFixed(2) + 'x  (' + preso.estado + ')');
  ok('  e a tela DIZ o que está acontecendo com ele',
     /corrente/i.test(favor.estado) && /corrente/i.test(contra.estado) && /redemoinho/i.test(preso.estado));

  /* ⚠️ O PRÓXIMO MAR É AVISADO COM ANTECEDÊNCIA -- sem isso um redemoinho nasce em cima de quem
     está nadando e não há jogada possível. */
  S.resgateMarZerar();
  S.resgate.relogioMar = S.resgate.proximaMudanca - S.RESGATE_MAR_AVISO - 0.1;
  S.resgateMarAtualizar(0.05);
  ok('antes do aviso não há mudança pendente', S.resgate.mudancaPendente === null);
  S.resgateMarAtualizar(0.2);
  ok('  e o aviso sai ' + S.RESGATE_MAR_AVISO + 's antes', S.resgate.mudancaPendente !== null);
  const planejado = S.resgate.mudancaPendente;
  S.resgateMarAtualizar(S.RESGATE_MAR_AVISO + 0.1);
  ok('  e o mar que chega é EXATAMENTE o que foi avisado',
     S.resgate.corrente.y === planejado.y && S.resgate.corrente.dir === planejado.dir
     && S.resgate.redemoinhos[0].x === planejado.redemoinhos[0].x,
     'senão o tracejado prometeria um mar e viria outro');
  ok('  e a pendência é limpa depois', S.resgate.mudancaPendente === null);
  /* e os redemoinhos nunca nascem em cima de um ponto de resgate */
  let emCima = 0;
  for(let i = 0; i < 200; i++){
    const m = S.resgateMarPlano();
    m.redemoinhos.forEach(w => S.RESGATE_PONTOS.forEach(p => {
      if(Math.hypot(w.x - p.x, w.y - p.y) <= 43) emCima++;
    }));
  }
  ok('e nenhum redemoinho nasce em cima de um ponto', emCima === 0, emCima + ' em 400 sorteios');
}

/* ============================================================================
   9) O RELÓGIO -- aos 90s os dois voltam e entregam
   ============================================================================ */
console.log('\n=== O RETORNO AUTOMÁTICO ===');
{
  contaDeTeste();
  S.resgateMarZerar();
  S.resgate.corrente.y = -99; S.resgate.redemoinhos = [];
  S.resgate.ocupantes = S.RESGATE_PONTOS.map((s, i) => S.resgateNovoOcupante(i));
  const eu = S.resgateAtor(inst('blastoise', 70), 120);
  const ele = S.resgateAtor(inst('lapras', 60), 240);
  ele.pensa = 1e9;
  eu.x = 100; eu.y = 100; ele.x = 260; ele.y = 90;
  eu.bag = [{ speciesId: 'staryu', pts: 30 }];
  ele.bag = [{ speciesId: 'krabby', pts: 20 }];
  S.resgate.atores = [eu, ele];
  S.resgate.fase = 'correndo'; S.resgate.tempo = S.RESGATE_DURACAO - 0.5;
  /* e um deles estava no meio de um resgate: ele é interrompido */
  eu.resgatando = 2; S.resgate.ocupantes[2].dono = 0;
  S.resgateAtualizar(1);
  ok('aos 90s a fase vira o retorno', S.resgate.fase === 'voltando', S.resgate.fase);
  ok('  e o resgate em andamento é interrompido',
     eu.resgatando === null && S.resgate.ocupantes[2].dono === null);
  ok('  e os dois vão pra praia',
     S.resgate.atores.every(a => a.alvo && a.alvo.tipo === 'praia'));
  for(let k = 0; k < 3000 && S.resgate.fase !== 'fim'; k++) S.resgateAtualizar(1 / 30);
  ok('  e a prova termina quando os DOIS chegam', S.resgate.fase === 'fim', S.resgate.fase);
  ok('  e os dois entregaram o que tinham a bordo',
     eu.pontos === 30 && ele.pontos === 20 && !eu.bag.length && !ele.bag.length,
     eu.pontos + ' × ' + ele.pontos);
  /* ⚠️ E O RELÓGIO NÃO PASSA DE 90: o `dt` é aparado, senão o contador da tela ficaria negativo */
  ok('  e o relógio para nos ' + S.RESGATE_DURACAO + 's', S.resgate.tempo <= S.RESGATE_DURACAO + 1e-9,
     S.resgate.tempo.toFixed(3));
}

/* ============================================================================
   10) O DUELO INTEIRO -- ele termina, e o parceiro melhor ganha mais
   ============================================================================ */
console.log('\n=== O DUELO INTEIRO ===');
{
  contaDeTeste();
  function duelo(meuId, meuLv){
    S.resgateMarZerar();
    S.resgate.ocupantes = S.RESGATE_PONTOS.map((s, i) => S.resgateNovoOcupante(i));
    S.resgate.atores = [S.resgateAtor(inst(meuId, meuLv), 166),
                        S.resgateAtor(inst('blastoise', 60), 194)];
    S.resgate.tempo = 0; S.resgate.fase = 'correndo';
    let voltas = 0;
    while(S.resgate.fase !== 'fim' && voltas < 20000){
      const a = S.resgate.atores[0];
      if(!a.alvo && a.resgatando === null && a.descarga <= 0){
        if(a.bag.length >= S.RESGATE_CAPACIDADE) S.resgateVoltarAPraia();
        else {
          const livres = S.resgate.ocupantes.map((p, i) => ({ p, i })).filter(v => v.p.speciesId && v.p.dono === null);
          if(livres.length){
            livres.sort((v, w) => Math.hypot(a.x - v.p.x, a.y - v.p.y) / v.p.pts
                                - Math.hypot(a.x - w.p.x, a.y - w.p.y) / w.p.pts);
            S.resgateTocarPonto(livres[0].i);
          } else if(a.bag.length) S.resgateVoltarAPraia();
        }
      }
      S.resgateAtualizar(1 / 30); voltas++;
    }
    return { fim: S.resgate.fase === 'fim', voltas,
             eu: S.resgate.atores[0].pontos, npc: S.resgate.atores[1].pontos };
  }
  const rapido = [], lento = [];
  for(let i = 0; i < 12; i++){ rapido.push(duelo('starmie', 99)); lento.push(duelo('slowbro', 20)); }
  ok('o duelo sempre termina', rapido.concat(lento).every(d => d.fim),
     'mais voltas: ' + Math.max(...rapido.concat(lento).map(d => d.voltas)));
  const media = (a, k) => a.reduce((s, d) => s + d[k], 0) / a.length;
  ok('  e o parceiro RÁPIDO pontua mais que o lento',
     media(rapido, 'eu') > media(lento, 'eu') * 1.4,
     media(rapido, 'eu').toFixed(0) + ' contra ' + media(lento, 'eu').toFixed(0));
  ok('  e o adversário joga de verdade (ele pontua)', media(rapido, 'npc') > 50,
     media(rapido, 'npc').toFixed(0) + ' pts de média');
  /* ⚠️ E O RÁPIDO NÃO GANHA DE GRAÇA: o rival Lv.60 continua brigando */
  ok('  e o duelo não é decidido de antemão', media(lento, 'npc') > media(lento, 'eu'),
     'com o parceiro lento o rival ganha, como tem que ser');
}

/* ============================================================================
   11) NADA DO SAVE É TOCADO
   ============================================================================ */
console.log('\n=== O SAVE ===');
{
  contaDeTeste();
  const antes = JSON.stringify(g.saveSlots[0]);
  S.resgateMarZerar();
  S.resgate.ocupantes = S.RESGATE_PONTOS.map((s, i) => S.resgateNovoOcupante(i));
  S.resgate.atores = [S.resgateAtor(inst('blastoise', 70), 166), S.resgateAtor(inst('lapras', 60), 194)];
  S.resgate.tempo = 0; S.resgate.fase = 'correndo';
  for(let k = 0; k < 4000 && S.resgate.fase !== 'fim'; k++){
    const a = S.resgate.atores[0];
    if(!a.alvo && a.resgatando === null){
      if(a.bag.length >= S.RESGATE_CAPACIDADE) S.resgateVoltarAPraia();
      else S.resgateTocarPonto(k % S.RESGATE_PONTOS.length);
    }
    S.resgateAtualizar(1 / 30);
  }
  ok('o time do save fica byte a byte igual', JSON.stringify(g.saveSlots[0]) === antes);
  /* ⚠️ E O ESTADO VIVE FORA DO `game`: nada disto pode ir pro Firestore */
  ok('  e o estado não entra no save', JSON.stringify(S.serializeGame()).indexOf('resgate') < 0,
     'o minigame é offline: nenhuma Cloud Function, nada gravado');
}

/* ============================================================================
   12) O LAÇO E O PINTOR -- lidos do código, porque os casos chamam as funções na mão
   ============================================================================ */
console.log('\n=== O LAÇO ===');
{
  const fatia = src.slice(src.indexOf('async function resgateComecar'), src.indexOf('function resgateTexto'));
  ok('(a fatia do laço tem o que ler)', fatia.length > 500, fatia.length + ' chars');
  /* ⚠️ ELE PARA QUANDO A TELA MUDA, não só quando a prova acaba: um convite online aceito no meio
     troca a `game.screen` e o pintor continuaria escrevendo nos ids de uma tela que saiu. */
  ok('o laço para quando a tela muda', /game\.screen !== 'resgate'/.test(fatia),
     'sem isso ele pinta por cima de outra tela');
  ok('  e o `dt` é limitado', /Math\.min\(0\.1,/.test(fatia),
     'com a aba em segundo plano o primeiro quadro traria os segundos todos de uma vez');
  ok('  e ele espera os DOIS sprites antes de largar',
     /Promise\.all\(\[pmdCarregar[\s\S]{0,80}pmdCarregar/.test(fatia));
  ok('  e um sprite que falha NÃO é substituído: a tela diz qual faltou',
     /fase = 'setup'[\s\S]{0,200}aviso[\s\S]{0,120}SPECIES\[falhou\]/.test(fatia),
     'o pedido do modo é explícito nisso');

  /* ⚠️ O PINTOR É POR DOM, e o laço NUNCA chama render(): ele recriaria o canvas e os botões 60
     vezes por segundo, e o toque no ponto se perderia no meio. */
  /* ⚠️ A FATIA PARA NO FIM DO LAÇO, e não na próxima função: larga demais, ela alcança o
     comentário do pintor -- e foi exatamente assim que esta trava acusou um comentário meu em
     vez do código. É a armadilha do padrão largo demais, de novo. */
  const doPasso = fatia.slice(fatia.indexOf('const passo'));
  const laco = doPasso.slice(0, doPasso.indexOf('};') + 2);
  ok('(a fatia do laço fecha no laço)', laco.length > 300 && laco.length < 1400, laco.length + ' chars');
  ok('e o laço não chama render()', laco.indexOf('render()') < 0,
     'o pintor mexe no DOM; render() é só nas viradas de fase');
  ok('  e quem pinta é o `resgatePintar`', /resgatePintar\(\)/.test(laco));
}

/* ============================================================================
   13) O SPRITE PMD DE OITO DIREÇÕES
   ============================================================================ */
console.log('\n=== OS SPRITES ===');
{
  /* ⚠️ A LINHA CASA COM A ORDEM DO PMD, e a prova é o `PMD_LINHA_COSTAS` da Corrida: rumo pra CIMA
     tem que devolver exatamente ele, senão as duas telas discordariam sobre a mesma folha. */
  const d8 = { linhas: 8 };
  const P2 = Math.PI / 2;
  ok('rumo pra cima = a linha que a Corrida já usa',
     S.pmdLinhaDoRumo(d8, -P2) === S.PMD_LINHA_COSTAS, String(S.pmdLinhaDoRumo(d8, -P2)));
  ok('  pra baixo = 0', S.pmdLinhaDoRumo(d8, P2) === 0, String(S.pmdLinhaDoRumo(d8, P2)));
  ok('  pra direita = 2', S.pmdLinhaDoRumo(d8, 0) === 2, String(S.pmdLinhaDoRumo(d8, 0)));
  ok('  pra esquerda = 6', S.pmdLinhaDoRumo(d8, Math.PI) === 6, String(S.pmdLinhaDoRumo(d8, Math.PI)));
  const todas = new Set();
  for(let k = 0; k < 64; k++) todas.add(S.pmdLinhaDoRumo(d8, -Math.PI + k * Math.PI / 32));
  ok('  e as oito direções são alcançadas', todas.size === 8, todas.size + ' linhas');
  /* ⚠️ E UMA FOLHA COM MENOS DIREÇÕES NÃO ESTOURA: `drawImage` com o retângulo fora da imagem não
     desenha NADA e não dá erro -- o sprite sumiria em silêncio. */
  const d1 = { linhas: 1 };
  let fora = 0;
  for(let k = 0; k < 64; k++) if(S.pmdLinhaDoRumo(d1, -Math.PI + k * Math.PI / 32) !== 0) fora++;
  ok('e uma folha de uma direção só nunca sai do índice 0', fora === 0, fora + ' fora');

  /* a Corrida continua chamando o `pmdCaixas` sem a linha, e ela é o padrão */
  ok('o `pmdCaixas` tem a linha como PARÂMETRO com padrão',
     /function pmdCaixas\(img, w, h, quantos, linha\)/.test(src)
     && /if\(linha == null\) linha = PMD_LINHA_COSTAS/.test(src),
     'sem o padrão, a Corrida teria que mudar junto');
  ok('  e as caixas de cada linha são guardadas', /caixasPorLinha/.test(src));

  /* ============================================================================
     ⚠️ A ESCALA É PROPORCIONAL AO BICHO (20/09/2026, reportado com print: *"o squirtle que é um
     pokemon pequeno ta muito grande, e a lugia que é um pokemon grande ta muito pequeno"*).
     Ela era `min(46/sw, 46/sh)`, ou seja TODO mundo saía com 46px de maior lado.
     ⚠️ A TRAVA MEDE A REGRA, não os números: ela usa as caixas REAIS medidas no navegador nos 65
     surfistas e cobra (1) que maior caixa dê maior desenho, (2) que os dois extremos caibam no
     mapa e (3) que a razão entre eles seja de VERDADE -- uma escala que voltasse a normalizar
     todo mundo daria razão 1,00 e passaria em qualquer trava de "o sprite aparece". */
  const CAIXAS = { qwilfish: [15, 17], squirtle: [16, 19], starmie: [21, 21], totodile: [18, 23],
                   blastoise: [26, 29], kingdra: [16, 35], lapras: [43, 40], mantine: [56, 44],
                   gyarados: [39, 72], lugia: [73, 63] };
  const falso = (c) => ({ caixas: [[0, 0, c[0], c[1]]] });
  const desenhado = {};
  Object.keys(CAIXAS).forEach(n => {
    const d = falso(CAIXAS[n]);
    desenhado[n] = Math.max(CAIXAS[n][0], CAIXAS[n][1]) * S.resgateEscalaDoSprite(d);
  });
  const nomes = Object.keys(CAIXAS).sort((a, b) => desenhado[a] - desenhado[b]);
  ok('maior caixa, maior sprite desenhado',
     nomes.every((n, i) => i === 0
       || Math.max(...CAIXAS[n]) >= Math.max(...CAIXAS[nomes[i - 1]])),
     nomes.map(n => n + ':' + desenhado[n].toFixed(0)).join(' '));
  const menor = desenhado[nomes[0]], maior = desenhado[nomes[nomes.length - 1]];
  ok('  o menor continua visível', menor >= 24, menor.toFixed(1) + 'px (Qwilfish)');
  ok('  o maior cabe no mapa', maior <= 62, maior.toFixed(1) + 'px (Lugia)');
  ok('  e a razão entre eles é real', maior / menor >= 1.7 && maior / menor <= 2.6,
     (maior / menor).toFixed(2) + 'x');
  /* ⚠️ E ELA NÃO PODE SER LINEAR: com a caixa indo de 17 a 73 (4,3x medido), o linear que caiba o
     maior no mapa deixa o menor com 13px. A trava cobra que a compressão exista. */
  ok('  (ou seja: não é linear)', maior / menor < 73 / 17 * 0.8,
     'a caixa varia ' + (73 / 17).toFixed(1) + 'x e o desenho ' + (maior / menor).toFixed(2) + 'x');

  /* ⚠️ O TAMANHO É POR ESPÉCIE, nunca por quadro nem por direção: lido do quadro, a escala mudava
     a cada passo da animação e o bicho respirava. A trava dá QUATRO caixas de tamanhos diferentes
     e cobra que a escala seja UMA só. */
  const varios = { caixas: [[0, 0, 20, 24], [0, 0, 26, 21], [0, 0, 18, 30], [0, 0, 24, 22]] };
  const e1 = S.resgateEscalaDoSprite(varios), e2 = S.resgateEscalaDoSprite(varios);
  ok('a escala é a mesma em todos os quadros da espécie', e1 === e2 && S.resgateLadoDoSprite(varios) === 30,
     'lado ' + S.resgateLadoDoSprite(varios) + ' (o maior dos quatro quadros)');
  /* ⚠️ E UMA FOLHA QUEBRADA NÃO MANDA A ESCALA PRO INFINITO: caixa de lado zero dá 1/0. */
  ok('  e uma caixa vazia cai no piso', isFinite(S.resgateEscalaDoSprite({ caixas: [[0, 0, 0, 0]] })),
     'escala ' + S.resgateEscalaDoSprite({ caixas: [[0, 0, 0, 0]] }).toFixed(2));

  /* ⚠️ E O DESENHO USA ESSA ESCALA, não a caixa fixa: a conta velha ainda passaria nas travas
     acima se ela tivesse ficado no `drawImage`. */
  const ator = (src.match(/function resgateDesenharAtor\(ctx, a, i, t\)\{[\s\S]*?\n\}/) || [''])[0];
  ok('  (e a trava lê o desenhista do ator)', ator.length > 400, ator.length + ' chars');
  ok('  o `drawImage` usa a escala da espécie', /esc = resgateEscalaDoSprite\(dados\)/.test(ator));
  ok('  e a caixa fixa de 46px não voltou', ator.indexOf('46 / sw') < 0 && ator.indexOf('46 / sh') < 0);
  /* a sombra acompanha, senão ela desfaz na elipse a proporção que o sprite ganhou */
  ok('  e a sombra acompanha o tamanho', /resgateLadoDoSprite\(dados\) \* resgateEscalaDoSprite\(dados\)/.test(ator));
}

/* ============================================================================
   14) A TELA
   ============================================================================ */
console.log('\n=== A TELA ===');
{
  contaDeTeste();
  g.screen = 'resgate';
  /* o setup */
  let html = S.renderResgate();
  ok('o setup mostra o mapa em modo ILUSTRAÇÃO', html.indexOf('resg-mapa') >= 0);
  /* ⚠️ NO SETUP OS PONTOS NÃO CLICAM: um botão que não faz nada convida um toque que não responde.
     É a mesma decisão da ilha da Pescaria. */
  ok('  e os pontos dele não clicam', html.indexOf('resgateTocarPonto') < 0);
  ok('  e ele pede o parceiro', html.indexOf('resgateAbrirPicker') >= 0);
  ok('  e o botão de começar nasce desabilitado', /onclick="resgateComecar\(\)"/.test(html)
     && /disabled[^>]*onclick="resgateComecar/.test(html.replace(/\n/g, ' ')));

  /* o picker */
  S.resgate.picker = true;
  html = S.renderResgate();
  ok('o picker lista só os surfistas do time', (html.match(/mont-card/g) || []).length === 5,
     (html.match(/mont-card/g) || []).length + ' cards');
  ok('  e mostra a velocidade de cada um', (html.match(/corrida-speed-badge/g) || []).length === 5);
  /* ⚠️ O SLOT VAI ENTRE ASPAS no onclick: ele pode ser `ap:3` (um aposentado), e sem as aspas o
     atributo vira sintaxe inválida e o clique não faz NADA, sem erro no console. */
  ok('  e o slot vai entre aspas no onclick',
     /onclick="resgateEscolher\('[^']*',\d+\)"/.test(html)
     && !/onclick="resgateEscolher\([^'"]/.test(html),
     'é a família do botão da notificação e das setas da Montanha');
  S.resgate.picker = false;

  /* o jogo */
  S.resgateEscolher(0, 0);
  S.resgateMarZerar();
  S.resgate.ocupantes = S.RESGATE_PONTOS.map((s, i) => S.resgateNovoOcupante(i));
  S.resgate.atores = [S.resgateAtor(inst('blastoise', 70), 166), S.resgateAtor(inst('lapras', 60), 194)];
  S.resgate.fase = 'correndo';
  html = S.renderResgate();
  ok('a tela do jogo tem o canvas', html.indexOf('id="resgateMar"') >= 0);
  ok('  os seis pontos clicáveis', (html.match(/resgateTocarPonto\(/g) || []).length === 6);
  ok('  e a praia', html.indexOf('resgateVoltarAPraia()') >= 0);
  ok('  e o relógio e o placar dos dois', html.indexOf('id="resgateRelogio"') >= 0
     && html.indexOf('id="resgatePtsA"') >= 0 && html.indexOf('id="resgatePtsB"') >= 0);
  /* ⚠️ O NOME DO TREINADOR, nunca "VOCÊ" -- a mesma decisão de 20/09/2026 na Pescaria */
  ok('  e ela usa o NOME do treinador', html.indexOf('Matheus') >= 0 && !/>VOCÊ</.test(html),
     'o "Você" só volta quando não há nome');
  g.trainerName = '';
  ok('  e sem nome ele volta pro "Você"', S.nomeDoTreinador() === 'Você');
  g.trainerName = 'Matheus';

  /* o fim */
  S.resgate.atores[0].pontos = 240;
  S.resgate.atores[0].entregas = [{ speciesId: 'staryu', pts: 30 }, { speciesId: 'krabby', pts: 20 }];
  S.resgate.atores[1].pontos = 150;
  S.resgate.atores[1].entregas = [{ speciesId: 'horsea', pts: 20 }];
  S.resgate.fase = 'fim';
  html = S.renderResgate();
  ok('o fim diz quem venceu, pelo nome', html.indexOf('Matheus venceu') >= 0);
  ok('  e traz o resumo dos DOIS', (html.match(/pesc-resumo-lado/g) || []).length === 2);
  /* ⚠️ A CLASSE INTEIRA, e não o prefixo: `pesc-hist` casa também com `pesc-hist-txt` e
     `pesc-hist-pts`, e a conta saía em 3x -- a trava media outra coisa e passava por acaso. */
  ok('  com uma linha por resgate', (html.match(/class="pesc-hist"/g) || []).length === 3,
     (html.match(/class="pesc-hist"/g) || []).length + ' linhas');
  /* ⚠️ E NO FIM O MAPA SAI DA TELA: o canvas fica em BRANCO ali, porque quem o mantinha vivo era o
     pintor -- é a lição que a Corrida pagou com um print. */
  ok('  e o mapa não fica na tela em branco', html.indexOf('id="resgateMar"') < 0);
  S.resgateZerar();
}

/* ============================================================================
   15) OS DADOS -- o que o minigame supõe do jogo
   ============================================================================ */
console.log('\n=== OS DADOS ===');
{
  ok('os ' + S.RESGATE_RESGATADOS.length + ' resgatados existem no SPECIES',
     S.RESGATE_RESGATADOS.every(id => !!SP[id]),
     S.RESGATE_RESGATADOS.filter(id => !SP[id]).join(',') || 'todos');
  /* ⚠️ TODO SURFISTA PRECISA DE `dex`: é dele que sai a pasta do sprite PMD, e sem ele a largada
     é bloqueada -- o modo ficaria inalcançável pra quem escolhesse aquele parceiro. */
  ok('e todo surfista tem número de Pokédex (o sprite PMD sai dele)',
     S.SURFISTAS.every(id => (SP[id] || {}).dex > 0),
     S.SURFISTAS.filter(id => !(SP[id] || {}).dex).join(',') || 'todos');
  /* ⚠️ O VALOR SAIU DA ILHOTA E FOI PRO BICHO (20/09/2026, a pedido). A escada 10/20/30 era o que
     criava a decisão no mapa; hoje quem decide é o que CAIU em cada ilhota, e o custo continua
     sendo a distância. A trava velha ("quem vale mais está mais longe") media a escada, e caiu
     sozinha no dia em que a régua mudou. */
  ok('as seis ilhotas NÃO carregam mais pontos',
     S.RESGATE_PONTOS.length === 6 && S.RESGATE_PONTOS.every(p => p.pts === undefined));
  /* ⚠️ E O VALOR É DERIVADO DO BST, nunca uma tabela à mão -- ela envelheceria no dia em que o
     `GEN2_SPECIAL` mudasse. A trava mexe no divisor e cobra que o número acompanhe: um valor
     escrito na mão passaria em todos os casos nomeados e falharia só nesse. */
  ok('o ponto é o BST dividido por ' + S.RESGATE_PTS_DIVISOR,
     S.RESGATE_RESGATADOS.every(id => S.resgatePontosDe(id) === Math.round(S.bstOf(id) / S.RESGATE_PTS_DIVISOR)));
  ok('  e ele é DERIVADO (mexendo no bst, o ponto acompanha)', (() => {
     const antes = S.resgatePontosDe('pichu');
     return antes === Math.round(S.bstOf('pichu') / S.RESGATE_PTS_DIVISOR) && antes > 0;
  })(), S.resgatePontosDe('pichu') + ' pts pro Pichu (BST ' + S.bstOf('pichu') + ')');
  /* ⚠️ A FAIXA QUE ISSO PRODUZ -- e a trava cobra a RAZÃO, não os extremos: os números mudam
     toda vez que a lista cresce (já foram 41-87 com 23 espécies e são 36-93 com 40), e uma
     trava que os fixasse cairia sozinha no próximo acréscimo sem nada estar errado. É a mesma
     lição das cinco que caíram quando o trecho da Corrida virou 150 m.
     O que NÃO pode mudar é ela continuar mais estreita que a escada velha das ilhotas (30/10 =
     3x), que foi o que a mudança de 20/09 comprou: a distância é o custo, e nenhum bicho pode
     tornar a viagem longa obrigatória. */
  const vals = S.RESGATE_RESGATADOS.map(S.resgatePontosDe);
  const razao = Math.max(...vals) / Math.min(...vals);
  ok('  e a faixa continua mais estreita que a escada velha de 3x', razao < 3,
     Math.min(...vals) + ' a ' + Math.max(...vals) + ' = ' + razao.toFixed(2) + 'x');
  /* ⚠️ E NENHUMA FAIXA PODE FICAR PEQUENA: foi isso que trouxe os 17 de 21/09/2026 (*"o pool de
     pokemons que pode aparecer nelas ficou pequena"*). Com 4 e 2 espécies, a caixa do (i) da
     ilhota alta mostrava DUAS linhas de 50% cada. A trava é um PISO, não uma contagem: ela
     sobrevive ao próximo acréscimo, e cai no dia em que alguém esvaziar uma faixa. */
  ok('nenhuma faixa fica com menos de ' + MINIMO_POR_FAIXA + ' espécies',
     S.RESGATE_BOLO_DA_FAIXA.every(b => b.length >= MINIMO_POR_FAIXA),
     S.RESGATE_BOLO_DA_FAIXA.map(b => b.length).join(' / '));
  /* ⚠️ A REGRA QUE NINGUÉM TINHA ESCRITO ATÉ 21/09/2026: todo resgatado é forma BASE. Era
     verdade nos 23 originais por acaso de escolha, e é ela que explica por que a faixa alta
     nascia com duas espécies -- formas base de BST alto são poucas. Escrita, o próximo
     acréscimo que puser um Charizard na lista fica barulhento. */
  ok('todo resgatado é forma BASE',
     S.RESGATE_RESGATADOS.every(id => S.raizDaLinha(id) === id),
     S.RESGATE_RESGATADOS.filter(id => S.raizDaLinha(id) !== id).join(',') || 'todos');
  /* ⚠️ E NINGUÉM DE ÁGUA NEM VOADOR (21/09/2026, a pedido): quem nada ou voa não precisa de
     resgate. O DODUO é a exceção HERDADA -- ele já estava na lista antes da regra existir, e no
     original ele não voa. Ele é NOMEADO aqui de propósito: sem isso, o próximo Voador entraria
     de carona na exceção dele. */
  ok('ninguém de Água nem Voador, fora o Doduo herdado', (() => {
     const molhados = S.RESGATE_RESGATADOS.filter(id =>
       (S.SPECIES[id].types || []).some(t => t === 'Water' || t === 'Flying'));
     return molhados.length === 1 && molhados[0] === 'doduo';
  })(), S.RESGATE_RESGATADOS.filter(id =>
     (S.SPECIES[id].types || []).some(t => t === 'Water' || t === 'Flying')).join(','));
  /* os dois Nidoran porque o pedido de 20/09 diz "nidorans", no plural */
  ok('  com os dois Nidoran',
     S.RESGATE_RESGATADOS.indexOf('nidoranm') >= 0 && S.RESGATE_RESGATADOS.indexOf('nidoranf') >= 0);
  ok('  e sem repetir ninguém',
     new Set(S.RESGATE_RESGATADOS).size === S.RESGATE_RESGATADOS.length);
  /* ⚠️ E NENHUM DELES É INTOCÁVEL: eles vão pro abrigo, não pra a Pokédex, mas listar um bicho
     que o jogo inteiro mantém fora de alcance seria a mesma incoerência da Pescaria. */
  ok('  e nenhum é intocável',
     S.RESGATE_RESGATADOS.every(id => (S.ESPECIES_INTOCAVEIS || []).indexOf(id) < 0));
  /* o selo do modo existe e é o que o botão usa */
  ok('o selo `resgate` existe', !!S.DESENHOS.resgate);
  ok('  e o pino da ilha dele o usa', /selo\(ilha\.selo,'selo-ilha'\)/.test(src.replace(/\s/g, '')));
  ok('  e a tela do modo também', /selo\('resgate'\)/.test(src));
}

console.log('\n=== O MAPA JÁ MOSTRA QUEM ESTÁ LÁ, DESDE O SETUP (20/09/2026) ===');
{
  contaDeTeste();
  S.abrirResgate();
  /* ⚠️ O PROTÓTIPO CRIA OS OCUPANTES NO `reset()` e desenha desde o modo `ready`; aqui eles só
     nasciam no `resgateComecar`, e a tela de setup mostrava seis círculos com um número e o canvas
     VAZIO. Foi isso que o jogador leu como "não está exibindo o mapa". */
  ok('os ocupantes existem no SETUP', S.resgate.ocupantes.length === S.RESGATE_PONTOS.length,
     S.resgate.ocupantes.length + ' ilhotas ocupadas');
  ok('  e todos têm espécie', S.resgate.ocupantes.every(o => !!o.speciesId));
  ok('  e a fase continua sendo setup', S.resgate.fase === 'setup');

  const html = S.renderResgate();
  const mapa = html.slice(html.indexOf('resg-mapa'), html.indexOf('resg-legenda'));
  /* ⚠️ E O SETUP NÃO MOSTRA MAIS UM BICHO POR ILHOTA (21/09/2026, a pedido). Ele era descartável
     e enganoso: os ocupantes são sorteados de NOVO no `resgateComecar`, então o que a tela
     mostrava ali não era o que o jogador ia encontrar. */
  ok('o mapa do setup NÃO mostra um Pokémon por ilhota', !/sprite-img|sprite-fallback/.test(mapa),
     'o bicho do setup voltou');
  ok('  e cada ilhota tem o (i)',
     (mapa.match(/abrirIlhotaDoResgate\(/g) || []).length === S.RESGATE_PONTOS.length,
     (mapa.match(/abrirIlhotaDoResgate\(/g) || []).length + ' de ' + S.RESGATE_PONTOS.length);
  /* ⚠️ MAS ELE MOSTRA A FAIXA: seis ilhotas vazias se leriam iguais, e é justamente a ESCADA que
     o mapa tem a dizer antes da largada. O rótulo sai das constantes. */
  ok('  e a faixa dela', mapa.indexOf(S.resgateRotuloDaFaixa(0)) >= 0 && mapa.indexOf(S.resgateRotuloDaFaixa(4)) >= 0,
     S.resgateRotuloDaFaixa(0) + ' / ' + S.resgateRotuloDaFaixa(2) + ' / ' + S.resgateRotuloDaFaixa(4));
  /* ⚠️ E O (i) É IRMÃO do ponto, nunca filho: no jogo o ponto é um <button>, e <button> dentro de
     <button> é HTML inválido -- o navegador fecha o de fora e o clique de dentro se perde. */
  ok('  e o (i) é irmão do ponto, não filho',
     /<span class="resg-ponto so-faixa">[\s\S]*?<\/span>\s*<button class="pesc-info"/.test(mapa));
  /* ⚠️ E ELE CONTINUA SENDO ILUSTRAÇÃO: um botão que não faz nada convida um toque que não
     responde -- a mesma decisão da ilha da Pescaria. O (i) é a exceção, e é o que a tela oferece. */
  ok('  mas os pontos não clicam no setup', mapa.indexOf('resgateTocarPonto') < 0);

  /* A CAIXA DO (i): o bolo inteiro da faixa daquela ilhota, com o valor e a chance */
  S.abrirIlhotaDoResgate(4);
  const cx = S.renderResgate();
  const bolo = S.RESGATE_BOLO_DA_FAIXA[S.RESGATE_FAIXA_DO_PONTO[4]];
  ok('a caixa do (i) lista o bolo inteiro da faixa',
     bolo.every(id => cx.indexOf((S.SPECIES[id] || {}).name) >= 0), bolo.join(','));
  ok('  e ninguém de outra faixa',
     S.RESGATE_BOLO_DA_FAIXA[0].every(id => cx.indexOf((S.SPECIES[id] || {}).name) < 0));
  ok('  com o valor de cada um', cx.indexOf(S.resgatePontosDe(bolo[0]) + ' pts') >= 0);
  ok('  e a chance, que é uniforme', cx.indexOf(Math.round(100 / bolo.length) + '%') >= 0);
  ok('  e a linha abre a ficha da Pokédex', cx.indexOf('abrirPokedexFicha') >= 0);
  S.fecharIlhotaDoResgate();
  ok('  e ela fecha', S.resgate.ilhotaAberta === null && S.renderResgate().indexOf('rota-mons-box') < 0);

  /* ⚠️ E O CANVAS É PINTADO A CADA RENDER, não só ao abrir (20/09/2026, reportado: *"depois que
     eu escolho meu parceiro, o desenho do mapa some e fica somente aquela toda azul"*). Quem o
     desenha no jogo é o pintor, que só roda dentro do laço -- e `app.innerHTML = html` cria um
     <canvas> NOVO e vazio, então QUALQUER ação da tela apagava o mapa.
     ⚠️ A TRAVA TEM DUAS METADES, e ela precisa das duas: o `render` do sandbox é um NO-OP (o
     epílogo o substitui), então um caso de comportamento nunca alcançaria o gancho -- quem prova
     que ele existe é a leitura do código. */
  const cv = S.document.getElementById('resgateMar');
  S.resgateDesenharMapa();
  ok('o mapa é desenhado de verdade',
     !!(cv && cv.__ctx && cv.__ctx.__ops.length > 100),
     (cv && cv.__ctx ? cv.__ctx.__ops.length : 0) + ' operações de desenho');
  ok('  e ele desenhou as ilhas (formas, não só retângulos)',
     !!(cv && cv.__ctx && cv.__ctx.__ops.indexOf('ellipse') >= 0 && cv.__ctx.__ops.indexOf('fill') >= 0));
  /* ⚠️ LENDO O CÓDIGO: o gancho mora no fim do `render()`, DEPOIS do `innerHTML` -- é ele que
     cria o <canvas>, e antes dele o desenho seria jogado fora no mesmo quadro. */
  const rend = (src.match(/\n  app\.innerHTML = html;[\s\S]*?\n  maybeAutoSave\(\);/) || [''])[0];
  ok('  (e a trava lê o fim do `render`)', rend.length > 200, rend.length + ' chars');
  ok('  o render redesenha o mapa quando a tela é a do Resgate',
     /game\.screen === 'resgate'\) resgateDesenharMapa\(\)/.test(rend));
  /* ⚠️ E A CHAMADA NÃO VOLTOU PRO `abrirResgate`: duas portas fariam a próxima ação nascer
     confiando na errada, e o gancho é o que cobre as oito que já existem. */
  const abrir = (src.match(/function abrirResgate\(\)\{[\s\S]{0,1200}?\n\}/) || [''])[0];
  ok('  (e a trava lê o `abrirResgate`)', abrir.length > 200, abrir.length + ' chars');
  ok('  e ele não desenha por conta própria', abrir.indexOf('resgateDesenharMapa()') < 0);
}

console.log('\n=== OS 23 RESGATADOS E O PONTO PELO BST ===');
{
  contaDeTeste();
  S.abrirResgate();
  /* ⚠️ ELES SÃO SORTEADOS, e a trava cobra que VARIE: uma lista que sempre devolvesse o mesmo
     passaria numa trava de "está na lista".
     ⚠️ E O BOLO É O DA FAIXA DAQUELA ILHOTA desde 20/09/2026 -- a trava media a lista INTEIRA e
     caiu sozinha no dia em que as faixas entraram, sem nada estar errado. Ela passou a medir a
     REGRA: cada ilhota varia dentro do bolo DELA. */
  const todos = new Set();
  S.RESGATE_PONTOS.forEach((_, i) => {
    const bolo = S.RESGATE_BOLO_DA_FAIXA[S.RESGATE_FAIXA_DO_PONTO[i]];
    const vistos = new Set();
    for(let k = 0; k < 400; k++){ const id = S.resgateNovoOcupante(i).speciesId; vistos.add(id); todos.add(id); }
    if(i === 0 || i === 2 || i === 4){
      ok('a ilhota ' + i + ' varre o bolo da faixa dela', vistos.size === bolo.length,
         vistos.size + ' de ' + bolo.length + ' espécies em 400 sorteios');
    }
  });
  ok('  e nunca sai de fora da lista',
     [...todos].every(id => S.RESGATE_RESGATADOS.indexOf(id) >= 0));
  /* o valor do ocupante É o do bicho, não o da ilhota */
  for(let k = 0; k < 60; k++){
    const o = S.resgateNovoOcupante(k % 6);
    if(o.pts !== S.resgatePontosDe(o.speciesId)){ ok('o ponto do ocupante sai do BICHO', false, o.speciesId); break; }
    if(k === 59) ok('o ponto do ocupante sai do BICHO', true, 'em 60 sorteios');
  }
  /* ⚠️ E A MESMA ILHOTA CONTINUA VARIANDO DE VALOR dentro da faixa dela: se o valor virasse
     constante por ilhota, a escada teria voltado a ser a das POSIÇÕES -- que é justamente o
     desenho que o BST substituiu. */
  const mesmoPonto = new Set();
  for(let k = 0; k < 200; k++) mesmoPonto.add(S.resgateNovoOcupante(1).pts);
  ok('  e a MESMA ilhota vale valores diferentes', mesmoPonto.size >= 3,
     mesmoPonto.size + ' valores distintos na ilhota 1');

  /* ⚠️ O `pts` FICA GRAVADO no ocupante e viaja no bag: lendo a espécie de volta na entrega, uma
     mudança no divisor renomearia pontos já entregues. */
  ok('o valor viaja gravado (o bag leva `pts`, não a espécie)',
     /a\.bag\.push\(\{ speciesId: p\.speciesId, pts: p\.pts \}\)/.test(src));

  /* a legenda velha descrevia a escada das POSIÇÕES, que não existe mais */
  const h = S.renderResgate();
  ok('a legenda não promete mais 10/20/30',
     h.indexOf('10 pts perto') < 0 && h.indexOf('30 pts no alto') < 0);
  /* ⚠️ E ELA SAI DAS CONSTANTES, nunca escrita à mão: um número aqui envelheceria no primeiro
     ajuste de faixa, que é o defeito que o rótulo "Revezamento · 900 m" da Corrida teve. A trava
     monta o texto esperado a PARTIR do `RESGATE_FAIXA_PTS`, então ela acompanha sozinha. */
  ok('  e diz a faixa de cada altura',
     h.indexOf('Perto: até ' + (S.RESGATE_FAIXA_PTS[0] - 1) + ' pts') >= 0
     && h.indexOf('Centro: até ' + (S.RESGATE_FAIXA_PTS[1] - 1)) >= 0
     && h.indexOf('Alto: ' + S.RESGATE_FAIXA_PTS[1] + '+') >= 0);
}

/* ============================================================================
   ⚠️ A ESCADA DAS FAIXAS (20/09/2026, a pedido: *"as ilhas mais proximas, vao aparecer os
   pokemons que dão menos de 50 pontos, os da ilha centrais, são os pokemons que dao menos de 70
   pontos, e os mais alto, sao os de 70 ou mais pontos"*).
   ============================================================================ */
console.log('\n=== A ESCADA: CADA ALTURA TEM A SUA FAIXA DE PONTOS ===');
{
  contaDeTeste();
  S.abrirResgate();
  /* ⚠️ A FAIXA SAI DA POSIÇÃO, não de índices escritos à mão: mover uma ilhota tem que mover a
     faixa dela junto. A trava cobra a ORDEM -- quanto mais alta na tela (Y menor), maior a faixa. */
  const porY = S.RESGATE_PONTOS.map((p, i) => ({ i, y: p.y, f: S.RESGATE_FAIXA_DO_PONTO[i] }))
    .sort((a, b) => b.y - a.y);
  ok('a faixa acompanha a altura da ilhota',
     porY.every((v, k) => k === 0 || v.f >= porY[k - 1].f),
     porY.map(v => 'y' + v.y + '=f' + v.f).join(' '));
  ok('  e as três faixas existem', new Set(S.RESGATE_FAIXA_DO_PONTO).size === 3,
     S.RESGATE_FAIXA_DO_PONTO.join(','));
  ok('  duas ilhotas em cada uma',
     [0, 1, 2].every(f => S.RESGATE_FAIXA_DO_PONTO.filter(x => x === f).length === 2));

  /* ⚠️ AS BANDAS SÃO O PEDIDO, e a trava as mede pelo VALOR e não pela lista: perto < 50, o
     centro de 50 a 69, o alto 70 pra cima. */
  const lim = S.RESGATE_FAIXA_PTS;
  const pts = (f) => S.RESGATE_BOLO_DA_FAIXA[f].map(id => S.resgatePontosDe(id));
  ok('perto: todo mundo abaixo de ' + lim[0], pts(0).every(v => v < lim[0]),
     Math.min(...pts(0)) + '..' + Math.max(...pts(0)) + ' (' + pts(0).length + ' espécies)');
  ok('centro: de ' + lim[0] + ' a ' + (lim[1] - 1),
     pts(1).every(v => v >= lim[0] && v < lim[1]),
     Math.min(...pts(1)) + '..' + Math.max(...pts(1)) + ' (' + pts(1).length + ' espécies)');
  ok('alto: ' + lim[1] + ' pra cima', pts(2).every(v => v >= lim[1]),
     Math.min(...pts(2)) + '..' + Math.max(...pts(2)) + ' (' + pts(2).length + ' espécies)');
  /* ⚠️ E NINGUÉM SOBRA NEM REPETE: os três bolos juntos são a lista, sem interseção -- se um
     bicho caísse em duas faixas, a escada deixaria de ser uma escada naquele valor. */
  const juntos = [].concat(...S.RESGATE_BOLO_DA_FAIXA);
  ok('os três bolos são a lista inteira, sem repetir',
     juntos.length === S.RESGATE_RESGATADOS.length
     && new Set(juntos).size === S.RESGATE_RESGATADOS.length,
     juntos.length + ' de ' + S.RESGATE_RESGATADOS.length);
  /* ⚠️ NENHUM BOLO VAZIO: sortear de uma lista vazia devolve `undefined`, que não dá erro na hora
     -- ele estoura quadros depois, dentro do laço. A rede é cair na lista inteira; esta trava
     existe pra a rede NÃO precisar ser usada. */
  ok('  e nenhuma faixa ficou sem dono',
     S.RESGATE_BOLO_DA_FAIXA.every(b => b.length > 0),
     S.RESGATE_BOLO_DA_FAIXA.map(b => b.length).join('/'));

  /* A REGRA NA PRÁTICA: 600 sorteios por ilhota, e o valor NUNCA sai da banda dela. É a trava que
     pega um `resgateNovoOcupante` que volte a sortear da lista inteira. */
  let fora = 0, exemplo = '';
  S.RESGATE_PONTOS.forEach((_, i) => {
    const f = S.RESGATE_FAIXA_DO_PONTO[i];
    for(let k = 0; k < 600; k++){
      const o = S.resgateNovoOcupante(i);
      const ok2 = (f === 0 ? o.pts < lim[0] : f === 1 ? (o.pts >= lim[0] && o.pts < lim[1]) : o.pts >= lim[1]);
      if(!ok2){ fora++; if(!exemplo) exemplo = 'ilhota ' + i + ' (faixa ' + f + ') -> ' + o.speciesId + ':' + o.pts; }
    }
  });
  ok('em 3.600 sorteios, ninguém fora da faixa da ilhota', fora === 0, exemplo || '0 de 3600');

  /* ⚠️ E A ESCADA TEM QUE SER ESTRITA: o pior da faixa de cima vale mais que o melhor da de
     baixo. Sem isso as bandas existiriam no código e não na tela. */
  ok('a ilhota mais longe sempre paga mais que a mais perto',
     Math.min(...pts(2)) > Math.max(...pts(1)) && Math.min(...pts(1)) > Math.max(...pts(0)),
     Math.max(...pts(0)) + ' < ' + Math.min(...pts(1)) + ' .. ' + Math.max(...pts(1)) + ' < ' + Math.min(...pts(2)));
}

/* ============================================================================
   ⚠️ A DESCARGA DE 2s NA PRAIA (21/09/2026, a pedido: *"coloque tambem um timer de 2s para
   descarregar os pokemons resgatados na praia"*). Chegar deixou de ser entregar.
   ============================================================================ */
console.log('\n=== A DESCARGA DE 2s NA PRAIA ===');
{
  contaDeTeste();
  S.resgate.escolhido = S.resgateElegiveis()[0];
  S.resgate.atores = [S.resgateAtor(S.resgateInstancia({ speciesId: 'lapras', level: 60 }, true), 170),
                      S.resgateAtor(S.resgateInstancia({ speciesId: 'lapras', level: 60 }, false), 190)];
  S.resgate.ocupantes = S.RESGATE_PONTOS.map((_, i) => S.resgateNovoOcupante(i));
  S.resgate.fase = 'correndo'; S.resgate.tempo = 0;
  const eu = S.resgate.atores[0];

  /* chega na praia com carga: a descarga ABRE, e os pontos ainda NÃO contaram */
  eu.bag = [{ speciesId: 'pichu', pts: 41 }];
  eu.x = S.RESGATE_PRAIA.x; eu.y = S.RESGATE_PRAIA.y;
  S.resgateVoltarAPraia();
  S.resgateAtualizar(1 / 30);
  ok('chegar na praia abre a descarga, e não entrega',
     eu.descarga > 0 && eu.pontos === 0 && eu.bag.length === 1,
     'descarga ' + eu.descarga.toFixed(2) + 's, ' + eu.pontos + ' pts');
  ok('  e o estado diz isso', eu.estado === 'Descarregando…', eu.estado);

  /* ⚠️ ELA LEVA `RESGATE_DESCARGA` SEGUNDOS, medidos no motor -- e a trava lê a constante, nunca
     um número escrito aqui. */
  let t = 1 / 30;
  while(eu.descarga > 0 && t < 10){ S.resgateAtualizar(1 / 30); t += 1 / 30; }
  ok('  e ela leva ' + S.RESGATE_DESCARGA + 's', Math.abs(t - S.RESGATE_DESCARGA) < 0.1, t.toFixed(2) + 's');
  ok('  e só então os pontos contam', eu.pontos === 41 && eu.bag.length === 0,
     eu.pontos + ' pts, ' + eu.bag.length + ' a bordo');
  ok('  e as entregas guardam o que foi entregue', eu.entregas.length === 1);

  /* ⚠️ SAIR NO MEIO DELA CANCELA, e leva a carga de volta pro mar: é a mesma regra do resgate na
     ilhota, e é o que faz os 2s serem um CUSTO e não uma espera decorativa. */
  eu.bag = [{ speciesId: 'togepi', pts: 49 }];
  eu.x = S.RESGATE_PRAIA.x; eu.y = S.RESGATE_PRAIA.y;
  S.resgateVoltarAPraia(); S.resgateAtualizar(1 / 30);
  ok('a descarga está em curso', eu.descarga > 0);
  S.resgateTocarPonto(0);
  ok('  e sair dela cancela', eu.descarga === 0 && eu.bag.length === 1 && eu.pontos === 41,
     'descarga ' + eu.descarga + ', ' + eu.bag.length + ' a bordo, ' + eu.pontos + ' pts');

  /* ⚠️ E NINGUÉM FICA COM CARGA SEM PAGAR: o retorno automático espera a descarga, e o
     encerramento entrega o que sobrou -- um desembarque feito aos 89s não pode valer zero. */
  eu.alvo = null; eu.descarga = 0;
  eu.bag = [{ speciesId: 'tangela', pts: 87 }];
  S.resgate.atores[1].bag = [{ speciesId: 'elekid', pts: 72 }];
  S.resgate.atores.forEach(x => { x.x = S.RESGATE_PRAIA.x; x.y = S.RESGATE_PRAIA.y; x.alvo = null; });
  S.resgateTerminar();
  ok('o fim da prova entrega o que estava a bordo',
     eu.bag.length === 0 && eu.pontos === 41 + 87 && S.resgate.atores[1].pontos === 72,
     eu.pontos + ' x ' + S.resgate.atores[1].pontos);

  /* ⚠️ E O RETORNO AUTOMÁTICO NÃO FECHA ANTES DA DESCARGA: sem essa espera, o `voltando`
     terminaria no instante em que os dois encostam na areia e os 2s nunca correriam. */
  S.resgate.fase = 'voltando';
  S.resgate.atores.forEach(x => { x.alvo = null; x.descarga = 0; x.bag = []; x.x = S.RESGATE_PRAIA.x; x.y = S.RESGATE_PRAIA.y; });
  eu.descarga = 1;
  S.resgateAtualizar(1 / 30);
  ok('o retorno automático espera a descarga', S.resgate.fase === 'voltando', S.resgate.fase);
  eu.descarga = 0;
  S.resgateAtualizar(1 / 30);
  ok('  e fecha quando ela acaba', S.resgate.fase === 'fim', S.resgate.fase);

  /* ⚠️ O NPC TAMBÉM ESPERA: sem a guarda, o planejador dele mandaria o parceiro embora no quadro
     seguinte e ele nunca entregaria nada. */
  const plano = src.slice(src.indexOf('function resgateNpcPlano'), src.indexOf('function resgateNpcPlano') + 400);
  ok('  (e a trava lê o planejador do NPC)', plano.length > 200);
  ok('  e o NPC espera a descarga antes de planejar', plano.indexOf('a.descarga > 0') >= 0);

  /* A BARRA NA PRAIA -- sem ela os 2s são uma espera sem explicação. É o MESMO `.resg-medidor`
     da ilhota, e o `[hidden]` precisa de regra própria pra vencer o `display` do autor. */
  ok('a praia tem a barra da descarga', src.indexOf('id="resgateDescarga"') >= 0);
  ok('  e ela é o mesmo medidor da ilhota', /id="resgateDescarga"[^>]*><i><\/i><b>/.test(src));
  ok('  e o `[hidden]` dela vence o display', /\.resg-medidor\[hidden\]\{display:none;?\}/.test(src));
}

console.log('\n=== O PONTO É TRANSPARENTE E A BARRA FICA ACIMA ===');
{
  /* ⚠️ NO PROTÓTIPO O CÍRCULO É `background:transparent;border:0;box-shadow:none` -- o que se vê é
     o SPRITE. O disco opaco escondia metade da ilha desenhada no canvas. */
  const css = (src.match(/\.resg-ponto\{[^}]*\}/) || [''])[0];
  ok('o círculo do ponto é transparente', /background:transparent/.test(css), css.slice(0, 90));
  ok('  sem borda', /border:0/.test(css));
  ok('  e sem sombra', /box-shadow:none/.test(css));
  /* ⚠️ E `overflow:visible`: a etiqueta e a barra vivem FORA do círculo */
  ok('  com overflow visível (a etiqueta e a barra saem dele)', /overflow:visible/.test(css));

  /* ⚠️ A ETIQUETA TEM CLASSE PRÓPRIA, e não é um seletor de TIPO: com `.resg-ponto > span` ela
     pegava também o `.sprite-wrap`, que É um <span> filho direto -- o sprite saía dentro de uma
     etiqueta creme de 66px, estourando o ponto de 56. Medido no navegador. */
  ok('a etiqueta tem classe própria (não é `> span`)',
     src.indexOf('.resg-ponto .resg-pts{') >= 0 && src.indexOf('.resg-ponto > span{') < 0);

  /* a barra: acima do ponto, com o percentual -- as medidas do `.rescue-meter` do protótipo */
  const barra = (src.match(/\.resg-medidor\{[^}]*\}/) || [''])[0];
  ok('a barra fica ACIMA do ponto', /top:-12px/.test(barra), barra.slice(0, 80));
  ok('  e não no rodapé dele', !/bottom:/.test(barra));
  ok('  com o tamanho do protótipo (62x13)', /width:62px/.test(barra) && /height:13px/.test(barra));
  ok('  e o percentual escrito por cima',
     /\.resg-medidor b\{[^}]*position:absolute/.test(src));

  /* e o HTML traz o <b> que o pintor preenche */
  const p = { speciesId: 'pichu', pts: 41, dono: 0 };
  ok('o ponto em resgate monta a barra com o número',
     S.resgatePontoHtml(p).indexOf('<b>0%</b>') >= 0);
  ok('  e sem dono não há barra nenhuma',
     S.resgatePontoHtml({ speciesId: 'pichu', pts: 41, dono: null }).indexOf('resg-medidor') < 0);
  ok('  e o pintor escreve o percentual',
     /const num = el\.querySelector\('\.resg-medidor b'\);/.test(src));
}

/* ============================================================================
   O RANKING DO RESGATE, do lado do CLIENTE (21/09/2026, a pedido: *"na página principal do
   resgate, adicione também um ranking com as maiores pontuações"*)

   ⚠️ ELE ERA O ÚNICO DOS CINCO JOGOS SEM RANKING, e com ele o Resgate ganhou a PRIMEIRA operação
   de servidor dele.
   ============================================================================ */
console.log('');
console.log('=== O RANKING DO RESGATE ===');
{
  const g2 = S.__getGame();
  const RANK = { lista: [
    { pos: 1, nome: 'Ana', pontos: 820, eu: false },
    { pos: 2, nome: 'Bruno', pontos: 640, eu: false },
  ], meu: { nome: 'Matheus', pontos: 210, eu: true } };

  /* a caixa nas DUAS telas: a principal (onde o pedido a quer) e a de fim (onde o recorde
     acabou de acontecer -- mandar o jogador voltar ao setup pra ver a própria marca seria
     esconder o prêmio da jogada) */
  S.resgateRank.lista = RANK.lista; S.resgateRank.meu = RANK.meu;
  S.resgateRank.lidoEm = Date.now(); S.resgateRank.erro = null; S.resgateRank.recorde = false;
  S.resgateZerar();
  g2.screen = 'resgate';
  const setup = S.renderResgate();
  ok('a caixa aparece na tela principal', setup.indexOf('Melhores resgates') >= 0);
  ok('  com as linhas do top', (setup.match(/pesc-rank-linha/g) || []).length === 3,
     (setup.match(/pesc-rank-linha/g) || []).length + ' linhas');
  ok('  e o MEU separado', setup.indexOf('pesc-rank-sep') >= 0);

  S.resgate.fase = 'fim';
  S.resgate.atores = [
    { inst: S.createInstance('blastoise', 70), pontos: 210, entregas: [1, 2, 3], bag: [] },
    { inst: S.createInstance('lapras', 60), pontos: 180, entregas: [1, 2], bag: [] },
  ];
  S.resgateRank.recorde = true;
  const fim = S.renderResgate();
  ok('  e na tela de fim também', fim.indexOf('Melhores resgates') >= 0);
  ok('    com o "Recorde novo!" quando ele acabou de acontecer', fim.indexOf('Recorde novo!') >= 0);
  S.resgateRank.recorde = false;

  /* os três estados da caixa */
  S.resgate.fase = 'setup';
  S.resgateRank.lista = null; S.resgateRank.erro = null;
  ok('  sem lista ela diz que está carregando', S.renderResgate().indexOf('Carregando') >= 0);
  S.resgateRank.lista = [];
  ok('  vazia ela convida', S.renderResgate().indexOf('Ninguém pontuou ainda') >= 0);
  S.resgateRank.erro = 'deu ruim';
  ok('  e com erro ela oferece tentar de novo',
     S.renderResgate().indexOf('resgateCarregarRank(true)') >= 0);
  S.resgateRank.erro = null; S.resgateRank.lista = RANK.lista; S.resgateRank.lidoEm = Date.now();

  /* ⚠️ O ENVIO MANDA O QUE O MOTOR CONTOU, nunca um número montado na tela -- e o `venceu` sai da
     comparação dos dois lados, não de um campo separado que poderia discordar do placar. */
  const mandadas = [];
  const fcOriginal = S.functionsClient;
  S.functionsClient = { httpsCallable(nome){
    return (dados) => { mandadas.push({ nome, dados }); return Promise.resolve({ data: { gravado: true } }); };
  } };
  g2.authUser = { uid: 'u1' };
  S.resgate.atores = [
    { inst: S.createInstance('blastoise', 70), pontos: 333, entregas: [1, 2, 3, 4], bag: [] },
    { inst: S.createInstance('lapras', 60), pontos: 180, entregas: [1], bag: [] },
  ];
  S.resgateEnviarRank();
  ok('o envio vai pro submitRescueScore',
     mandadas.length === 1 && mandadas[0].nome === 'submitRescueScore', JSON.stringify(mandadas));
  ok('  com os pontos do MOTOR', mandadas[0] && mandadas[0].dados.pontos === 333,
     JSON.stringify(mandadas[0] && mandadas[0].dados));
  ok('  e os resgates contados das entregas', mandadas[0] && mandadas[0].dados.resgatados === 4);
  ok('  e o `venceu` saindo da comparação', mandadas[0] && mandadas[0].dados.venceu === true);

  /* ⚠️ SEM LOGIN ELE NEM TENTA: a callable recusaria, e uma ida ao servidor que nunca pode dar
     certo é desperdício. É a mesma regra do monitor das ilhas. */
  mandadas.length = 0;
  g2.authUser = null;
  S.resgateEnviarRank();
  ok('  e sem login ele nem tenta', mandadas.length === 0, JSON.stringify(mandadas));

  /* ⚠️ E ELE É BEST-EFFORT: um erro do servidor não pode derrubar a prova. */
  g2.authUser = { uid: 'u1' };
  S.functionsClient = { httpsCallable(){ return () => Promise.reject(new Error('caiu')); } };
  let explodiu = false;
  try { S.resgateEnviarRank(); } catch(e){ explodiu = true; }
  ok('  e um erro do servidor não derruba a prova', !explodiu);
  S.functionsClient = fcOriginal;

  /* ⚠️ E O `resgateTerminar` CHAMA O ENVIO -- lido do código, porque o caso de comportamento
     chama a função na mão e passaria com a chamada órfã. A ORDEM importa: o envio vem DEPOIS do
     `render()`, senão a tela do resultado esperaria a rede pra aparecer. */
  const i = src.indexOf('function resgateTerminar(){');
  const j = src.indexOf('async function resgateComecar', i);
  const corpo = (i >= 0 && j > i) ? src.slice(i, j) : '';
  ok('(e a trava lê o corpo do terminar)', corpo.length > 80, corpo.length + ' chars');
  ok('o `resgateTerminar` envia a pontuação', /resgateEnviarRank\(\)/.test(corpo));
  ok('  e o envio vem DEPOIS do render()',
     corpo.indexOf('render()') >= 0 && corpo.indexOf('render()') < corpo.indexOf('resgateEnviarRank()'));

  /* ⚠️ E O RANKING NÃO É PEDIDO DURANTE A PROVA: ali o laço está pintando, e uma resposta de rede
     chamaria `render()` no meio da animação -- a regra da casa. */
  const k = src.indexOf('function renderResgate(){');
  const l = src.indexOf('resgateCarregarRank(false)', k);
  const antes = (k >= 0 && l > k) ? src.slice(k, l) : '';
  ok('  e o ranking só é pedido FORA da prova', /if\(!jogando\)\s*$/.test(antes.trim()) ||
     /const jogando[\s\S]*if\(!jogando\)\s*$/.test(antes.trim()),
     'ele é pedido dentro do laço: um render da rede mataria a animação');
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
