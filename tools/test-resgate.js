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
  /* ⚠️ O CAMPO É O BOOLEANO `true` E NADA MAIS: 'sim', 'true' e 1 são o que um cliente forjado
     mandaria, e o `!game.ehAdmin` (truthy) os deixaria passar. */
  const casos = [
    [true, true], [false, false], ['sim', false], ['true', false], [1, false],
    [0, false], [null, false], [undefined, false], ['', false], [{}, false],
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
  ok('  conta ainda carregando: recusa', g.screen !== 'resgate', 'tela: ' + g.screen);

  /* e o botão da home segue a mesma regra */
  contaDeTeste();
  g.screen = 'saveSelect';
  const comAdmin = S.renderSaveSelect();
  ok('o botão aparece na home pra quem é admin', comAdmin.indexOf('abrirResgate()') >= 0);
  g.ehAdmin = false;
  ok('  e some pra quem não é', S.renderSaveSelect().indexOf('abrirResgate()') < 0);
  g.ehAdmin = true; g.contaCarregada = false;
  ok('  e some enquanto a conta carrega', S.renderSaveSelect().indexOf('abrirResgate()') < 0);

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

  S.resgateVoltarAPraia();
  for(let k = 0; k < 900 && eu.bag.length; k++) S.resgateAtualizar(1 / 30);
  ok('  e só na praia ele pontua', eu.pontos === S.RESGATE_PONTOS[0].pts, eu.pontos + ' pts');
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
      if(!a.alvo && a.resgatando === null){
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
  ok('os seis pontos valem 10, 20 ou 30', S.RESGATE_PONTOS.every(p => [10, 20, 30].indexOf(p.pts) >= 0)
     && S.RESGATE_PONTOS.length === 6);
  /* ⚠️ E OS QUE VALEM MAIS SÃO OS MAIS LONGES -- sem isso não há decisão nenhuma no mapa */
  const d = (p) => Math.hypot(p.x - S.RESGATE_PRAIA.x, p.y - S.RESGATE_PRAIA.y);
  const ordenados = S.RESGATE_PONTOS.slice().sort((a, b) => d(a) - d(b));
  ok('  e quem vale mais está mais longe da praia',
     ordenados.every((p, i) => i === 0 || p.pts >= ordenados[i - 1].pts),
     ordenados.map(p => Math.round(d(p)) + 'px=' + p.pts).join(' '));
  /* o selo do modo existe e é o que o botão usa */
  ok('o selo `resgate` existe', !!S.DESENHOS.resgate);
  ok('  e a home o usa no botão', /selo\('resgate','selo-modo'\)/.test(src.replace(/\s/g, '')));
  ok('  e a tela do modo também', /selo\('resgate'\)/.test(src));
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
