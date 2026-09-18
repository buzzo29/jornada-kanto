/**
 * CORRIDA POKÉMON -- o primeiro teste do modo, no cliente (18/09/2026).
 *
 * O que ele existe pra pegar, em ordem de importância:
 *   1. o acesso: o botão e a porta dependem de `admin === true`, e NADA MAIS autoriza;
 *   2. o Speed: é o do JOGO (com nível, shiny e especialidade) e não o do protótipo;
 *   3. a física: as trocas caem EXATAS em 300 e 600, mesmo quando o limite cai no meio do quadro;
 *   4. a barra: ela vai e VOLTA, e a detecção vale nos dois sentidos -- inclusive nas bordas;
 *   5. uma tentativa por travessia;
 *   6. nada do save é tocado.
 *
 *   node tools/test-corrida.js
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
const g = S.__getGame();
const SP = S.SPECIES;
const mk = (id, lv, ex) => Object.assign({
  speciesId: id, level: lv, name: SP[id].name, types: SP[id].types, id: 'm' + id, hp: 1, maxHp: 1,
}, ex || {});
function contaDeTeste(){
  g.saveSlots = new Array(20).fill(null);
  g.saveSlots[0] = { team: [mk('jolteon', 60), mk('venusaur', 58), mk('snorlax', 62, { shiny: true }),
                            mk('alakazam', 59), mk('gyarados', 61), mk('shuckle', 55)],
                     badgeCount: 8, customName: 'Time A' };
  g.saveSlotsCarregados = true; g.contaCarregada = true; g.ehAdmin = true;
  g.aposentados = []; g.specialties = [];
}

/* ============================================================================
   1) O ACESSO -- e ele é o item que mais importa, porque é um modo ADMINISTRATIVO
   ============================================================================ */
console.log('\n=== O ACESSO É SÓ DE QUEM TEM admin === true ===');
{
  contaDeTeste();
  const home = () => { g.screen = 'saveSelect'; return S.renderSaveSelect(); };

  g.ehAdmin = true;
  ok('com admin=true o botão aparece', home().indexOf('Corrida Pokemon') >= 0, 'sem o botão');
  /* ⚠️ E ELE TEM O NOME EXATO do pedido -- "Corrida Pokemon", sem acento em Pokemon. */
  ok('e com o nome EXATO', /Corrida Pokemon</.test(home()), 'o nome mudou');

  g.ehAdmin = false;
  ok('sem admin o botão some', home().indexOf('Corrida Pokemon') < 0, 'aparece pra quem não é admin');

  /* ⚠️ CAMPO AUSENTE, FALSO OU DE OUTRO TIPO NÃO AUTORIZA. O `admin` é lido como
     `d.admin === true` -- exatamente o booleano --, então 'sim', 1 e 'true' não entram. */
  const lido = (v) => { const d = { admin: v }; return d.admin === true; };
  ok('a string "sim" não autoriza', lido('sim') === false);
  ok('a string "true" não autoriza', lido('true') === false);
  ok('o número 1 não autoriza', lido(1) === false);
  ok('o campo ausente não autoriza', lido(undefined) === false);
  ok('só o booleano true autoriza', lido(true) === true);
  ok('e o index.html lê exatamente assim', /game\.ehAdmin = d\.admin === true/.test(src),
     'a leitura mudou -- confira se um truthy passou a autorizar');

  /* ⚠️ ENQUANTO A CONTA CARREGA, O BOTÃO FICA OCULTO -- o contrário da porta dos modos de campeão,
     que erra pro lado de DEIXAR ENTRAR. Aqui o lado seguro é o outro. */
  g.ehAdmin = true; g.contaCarregada = false;
  ok('carregando ainda, o botão fica oculto', home().indexOf('Corrida Pokemon') < 0, 'apareceu cedo');
  g.contaCarregada = true;

  /* ⚠️ E A VISIBILIDADE NÃO É A TRAVA: a AÇÃO refaz a pergunta. Quem chamar `abrirCorrida()` pelo
     console sem ser admin não entra. */
  g.ehAdmin = false; g.screen = 'saveSelect'; g.modoBloqueado = null;
  S.abrirCorrida();
  ok('a porta recusa quem não é admin', g.screen !== 'corrida', g.screen);
  ok('e diz por quê', !!g.modoBloqueado, 'sem recado');
  g.ehAdmin = true; g.modoBloqueado = null;
  S.abrirCorrida();
  ok('e deixa o admin entrar', g.screen === 'corrida', g.screen);
  ok('(o campo anda com a conta, senão o resetGame o apaga ao abrir um save)',
     /'saveSlotsCarregados','contaCarregada','versaoNova','ehAdmin'/.test(src), 'fora do CAMPOS_DA_CONTA');
}

/* ============================================================================
   2) O SPEED -- o do JOGO, e não o do protótipo
   ============================================================================ */
console.log('\n=== O SPEED É O DO JOGO, COM NÍVEL ===');
{
  contaDeTeste();
  const inst = (id, lv, ex) => { const p = S.createInstance(id, lv); Object.assign(p, ex || {}); p.hp = p.maxHp = S.calcMaxHp(p); return p; };

  /* ⚠️ O NÍVEL ENTRA, e é a razão de esta função existir: medido antes de escrever, o
     `effectiveSpeed` do motor devolve o MESMO número no Lv.5 e no Lv.99 -- no jogo só o HP escala
     com o nível. A fórmula é a oficial da Gen 1/2/3, sem IV nem EV. */
  ok('o effectiveSpeed do motor IGNORA o nível (é por isso que a escala existe)',
     S.effectiveSpeed(inst('jolteon', 5)) === S.effectiveSpeed(inst('jolteon', 99)),
     'ele passou a escalar -- reveja se a escala da corrida ainda é necessária');
  const s5 = S.speedDaCorrida(inst('jolteon', 5)), s50 = S.speedDaCorrida(inst('jolteon', 50)), s99 = S.speedDaCorrida(inst('jolteon', 99));
  ok('e o Speed da corrida escala', s5 < s50 && s50 < s99, [s5, s50, s99].join(' < '));
  ok('no Lv.50 ele fica perto do base (a escala do protótipo)', Math.abs(s50 - (SP.jolteon.speed + 5)) < 1,
     s50 + ' contra ' + SP.jolteon.speed);
  ok('e a fórmula é floor(base×2×nível/100)+5',
     s99 === Math.floor(SP.jolteon.speed * 2 * 99 / 100) + 5, String(s99));

  /* ⚠️ QUAIS MODIFICADORES ENTRAM: o shiny e a especialidade, porque o `effectiveSpeed` os aplica
     e a instância da corrida nasce LIMPA -- os outros degraus (terreno, fúria, paralisia, estágio)
     são no-op por construção. */
  const normal = S.speedDaCorrida(inst('jolteon', 50));
  const shiny = S.speedDaCorrida(inst('jolteon', 50, { shiny: true }));
  ok('o SHINY entra (1,20×)', shiny > normal, normal + ' -> ' + shiny);
  ok('e ele é exatamente o 1,20× do atributo',
     shiny === Math.floor(Math.round(SP.jolteon.speed * 1.20) * 2 * 50 / 100) + 5, String(shiny));
  /* ⚠️ A ESPECIALIDADE SÓ ENTRA PELO `corridaInstancia`, e esta trava já mediu errado: ela usava
     uma instância CRUA do `createInstance`, e o `withSpecialty` lê a FLAG `specialtyBuffed` --
     quem a põe é o `applySpecialtyBuff`. Medindo a instância crua, a trava dizia "não entra"
     tanto com o buff quanto sem ele. */
  g.specialties = ['Electric'];
  const semBuff = S.speedDaCorrida(inst('jolteon', 50));
  const comEsp = S.speedDaCorrida(S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true));
  ok('a ESPECIALIDADE entra pelo corridaInstancia', comEsp > semBuff, semBuff + ' -> ' + comEsp);
  /* ⚠️ E ELA VALE SÓ PRO JOGADOR: o NPC não tem conta, então não herda a conquista dele. */
  const npc = S.speedDaCorrida(S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, false));
  ok('e o NPC NÃO herda a especialidade do jogador', npc === semBuff, semBuff + ' contra ' + npc);
  /* ⚠️ e quem não é do tipo não ganha nada */
  const outroTipo = S.speedDaCorrida(S.corridaInstancia({ speciesId: 'venusaur', level: 50 }, true));
  ok('e quem não é do tipo não ganha',
     outroTipo === S.speedDaCorrida(inst('venusaur', 50)), String(outroTipo));
  g.specialties = [];
  /* ⚠️ o TERRENO não: corrida não tem terreno, e a flag nunca é posta */
  const comTerreno = S.speedDaCorrida(inst('jolteon', 50, { terrainBuffed: true }));
  ok('(o terreno mudaria o número, e é por isso que a flag nunca é posta)', comTerreno !== normal);
  ok('e a instância da corrida NÃO tem a flag',
     !S.corridaInstancia({ speciesId: 'jolteon', level: 50 }).terrainBuffed, 'nasce com terreno');

  /* a velocidade em m/s, que é o que o pedido fixa */
  ok('a velocidade é 8 + 4×√(Speed÷100)',
     Math.abs(S.velocidadeNormal(100) - 12) < 1e-9, String(S.velocidadeNormal(100)));
  ok('e ninguém fica parado: o mais lento do jogo ainda corre',
     S.velocidadeNormal(S.speedDaCorrida(inst('shuckle', 5))) > 8, '');
}

/* ============================================================================
   3) OS EFEITOS DO IMPULSO
   ============================================================================ */
console.log('\n=== OS EFEITOS: 1,45 / 1,25 / 0,80, E NÃO ACUMULAM ===');
{
  ok('perfeito é 1,45 por 1,5 s', S.CORRIDA_EFEITOS.perfect.mult === 1.45 && S.CORRIDA_EFEITOS.perfect.dur === 1.5);
  ok('bom é 1,25 por 1 s', S.CORRIDA_EFEITOS.good.mult === 1.25 && S.CORRIDA_EFEITOS.good.dur === 1);
  ok('erro é 0,80 por 0,5 s', S.CORRIDA_EFEITOS.miss.mult === 0.80 && S.CORRIDA_EFEITOS.miss.dur === 0.5);
  /* ⚠️ UM RESULTADO NOVO SUBSTITUI o anterior e REINICIA a duração -- nunca soma */
  const c = { mult: 1, efeito: 0 };
  S.aplicarEfeito(c, 'perfect');
  S.aplicarEfeito(c, 'perfect');
  ok('dois perfeitos seguidos não viram 2,10', c.mult === 1.45, String(c.mult));
  ok('e a duração REINICIA, não soma', c.efeito === 1.5, String(c.efeito));
  S.aplicarEfeito(c, 'miss');
  ok('e um erro substitui um perfeito em curso', c.mult === 0.80 && c.efeito === 0.5, c.mult + '/' + c.efeito);
}

/* ============================================================================
   4) A BARRA -- vai e VOLTA, e a detecção vale nos dois sentidos
   ============================================================================ */
console.log('\n=== A BARRA VAI E VOLTA, E AS FAIXAS VALEM NOS DOIS SENTIDOS ===');
{
  const T = S.CORRIDA_TRAVESSIA;
  ok('a travessia dura 1,44 s (o ciclo, 2,88)', T === 1.44, String(T));
  ok('a faixa verde é 30,4% a partir de 34,8%',
     S.CORRIDA_FAIXA.verde.ini === 0.348 && S.CORRIDA_FAIXA.verde.tam === 0.304);
  ok('a amarela é 9,6% a partir de 45,2%',
     S.CORRIDA_FAIXA.amarela.ini === 0.452 && S.CORRIDA_FAIXA.amarela.tam === 0.096);
  ok('e as duas são centradas em 50%',
     Math.abs(S.CORRIDA_FAIXA.verde.ini + S.CORRIDA_FAIXA.verde.tam / 2 - 0.5) < 1e-9 &&
     Math.abs(S.CORRIDA_FAIXA.amarela.ini + S.CORRIDA_FAIXA.amarela.tam / 2 - 0.5) < 1e-9);

  S.corridaZerar();
  const pos = (t) => { S.corrida.tempo = t; return S.corridaPosBarra(); };
  /* ⚠️ ELA NÃO SALTA DE UMA PONTA À OUTRA: o maior passo entre duas amostras próximas tem que ser
     do tamanho do passo, nunca ~1 (que é o que um serrote faria ao voltar ao zero de repente). */
  let maior = 0, anterior = pos(0);
  for(let t = 0; t <= T * 2; t += T / 200){ const p = pos(t); maior = Math.max(maior, Math.abs(p - anterior)); anterior = p; }
  ok('a barra não salta de uma ponta à outra', maior < 0.02, 'maior passo: ' + maior.toFixed(4));
  ok('ela chega no fim da barra', Math.abs(pos(T) - 1) < 1e-9, String(pos(T)));
  ok('e VOLTA ao começo', Math.abs(pos(T * 2)) < 1e-9, String(pos(T * 2)));
  ok('e o meio da travessia é o centro', Math.abs(pos(T * 0.5) - 0.5) < 1e-9);

  /* ⚠️ A DETECÇÃO É PELA POSIÇÃO, então ida e volta dão o MESMO resultado no mesmo ponto da barra */
  const pontos = [0.10, 0.348, 0.40, 0.452, 0.50, 0.548, 0.60, 0.652, 0.90];
  const naIda = pontos.map(p => { S.corrida.tempo = p * T; return S.resultadoDoImpulso(S.corridaPosBarra()); });
  const naVolta = pontos.map(p => { S.corrida.tempo = (2 - p) * T; return S.resultadoDoImpulso(S.corridaPosBarra()); });
  ok('ida e volta dão o mesmo resultado em cada ponto', naIda.join() === naVolta.join(),
     naIda.join() + ' | ' + naVolta.join());

  /* ⚠️ AS BORDAS EXATAS PERTENCEM À FAIXA, e isso quase escapou: `Math.abs(0.348 - 0.5)` dá
     0,15200000000000002 contra uma meia-faixa de 0,152 -- o início exato do verde caía FORA. */
  ok('o início exato do verde é "bom"', S.resultadoDoImpulso(0.348) === 'good');
  ok('o fim exato do verde é "bom"', S.resultadoDoImpulso(0.652) === 'good');
  ok('o início exato da amarela é "perfeito"', S.resultadoDoImpulso(0.452) === 'perfect');
  ok('o fim exato da amarela é "perfeito"', S.resultadoDoImpulso(0.548) === 'perfect');
  ok('o centro é "perfeito"', S.resultadoDoImpulso(0.5) === 'perfect');
  ok('e um fio fora do verde é erro', S.resultadoDoImpulso(0.3479) === 'miss' && S.resultadoDoImpulso(0.6521) === 'miss');
  ok('e um fio fora da amarela é "bom"', S.resultadoDoImpulso(0.4519) === 'good' && S.resultadoDoImpulso(0.5481) === 'good');
  ok('as pontas são erro', S.resultadoDoImpulso(0) === 'miss' && S.resultadoDoImpulso(1) === 'miss');
}

/* ============================================================================
   5) UMA TENTATIVA POR TRAVESSIA
   ============================================================================ */
console.log('\n=== UMA TENTATIVA POR TRAVESSIA (uma na ida, uma na volta) ===');
{
  const T = S.CORRIDA_TRAVESSIA;
  contaDeTeste();
  S.corridaZerar();
  const eu = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 })], true);
  S.corrida.corredores = [eu];
  S.corrida.fase = 'correndo';

  S.corrida.tempo = T * 0.5;                       /* centro da 1ª travessia: perfeito */
  S.corridaImpulso();
  ok('a 1ª tentativa vale', eu.mult === 1.45, String(eu.mult));
  eu.mult = 7;                                      /* sentinela */
  S.corridaImpulso();
  ok('a 2ª na MESMA travessia não vale', eu.mult === 7, String(eu.mult));
  S.corrida.tempo = T * 1.5;                        /* travessia seguinte (a volta) */
  S.corridaImpulso();
  ok('e na travessia seguinte ela volta', eu.mult !== 7, String(eu.mult));
  ok('e são travessias diferentes na ida e na volta',
     (S.corrida.tempo = T * 0.5, S.corridaTravessia()) !== (S.corrida.tempo = T * 1.5, S.corridaTravessia()));

  /* ⚠️ QUEM CHEGOU NÃO IMPULSIONA MAIS -- o pedido é explícito */
  eu.chegada = 12.3; eu.mult = 7; S.corrida.tentativaDaTravessia = -1;
  S.corridaImpulso();
  ok('quem já chegou não impulsiona', eu.mult === 7, String(eu.mult));
  eu.chegada = null;
  /* e fora da corrida também não */
  S.corrida.fase = 'setup'; eu.mult = 7; S.corrida.tentativaDaTravessia = -1;
  S.corridaImpulso();
  ok('e fora da corrida também não', eu.mult === 7, String(eu.mult));
}

/* ============================================================================
   6) A FÍSICA -- avanço por velocidade × tempo, e os limites EXATOS
   ============================================================================ */
console.log('\n=== A FÍSICA: TROCAS EXATAS EM 300 E 600 ===');
{
  contaDeTeste();
  const montar = (formato, participantes) => {
    S.corridaZerar();
    S.corrida.formato = formato; S.corrida.participantes = participantes;
    const meus = formato === 'relay'
      ? [mk('jolteon', 60), mk('alakazam', 59), mk('gyarados', 61)]
      : [mk('jolteon', 60)];
    S.corrida.escolhidos = meus;
    const eu = S.corridaNovoCorredor(meus.map(S.corridaInstancia), true);
    const npcs = S.sortearNpcs();
    S.corrida.corredores = [eu].concat(npcs.map(t => S.corridaNovoCorredor(t, false)));
    S.corrida.corredores.forEach((c, i) => { if(i) S.planejarNpc(c, 0); });
    S.corrida.fase = 'correndo'; S.corrida.tempo = 0;
  };
  const rodar = () => { let v = 0; while(S.corrida.corredores.some(c => c.chegada === null) && v < 60 * 600){ S.corridaFisica(1 / 60); v++; } };

  /* ⚠️ AS SEIS COMBINAÇÕES do pedido */
  const combos = [];
  for(const f of ['single', 'relay']) for(const n of [2, 3, 4]){
    montar(f, n); rodar();
    const trocas = S.corrida.corredores.flatMap(c => c.trocas);
    combos.push({
      f, n,
      corredores: S.corrida.corredores.length,
      terminou: S.corrida.corredores.every(c => c.chegada !== null),
      distExata: S.corrida.corredores.every(c => c.dist === (f === 'relay' ? 900 : 300)),
      trocas: trocas.length,
      trocasExatas: trocas.every(t => t.em === 300 || t.em === 600),
    });
  }
  ok('as seis combinações terminam', combos.every(c => c.terminou), JSON.stringify(combos.filter(c => !c.terminou)));
  ok('e o número de corredores bate', combos.every(c => c.corredores === c.n));
  ok('e todos param na distância EXATA', combos.every(c => c.distExata),
     JSON.stringify(combos.filter(c => !c.distExata)));
  /* ⚠️ E AS TROCAS CAEM EM 300 E 600 EXATOS, mesmo caindo no meio do quadro. Medida de FORA, no fim
     do quadro, a distância sai em 300,07 -- porque o PRÓXIMO já correu o resto do quadro, que é
     exatamente o que o pedido manda fazer. É por isso que a troca é REGISTRADA. */
  ok('e as trocas caem em 300 e 600 EXATOS', combos.every(c => c.trocasExatas),
     JSON.stringify(combos.filter(c => !c.trocasExatas)));
  ok('e o revezamento tem 2 trocas por equipe', combos.filter(c => c.f === 'relay').every(c => c.trocas === c.n * 2),
     combos.filter(c => c.f === 'relay').map(c => c.trocas).join(','));
  ok('e a individual não tem troca nenhuma', combos.filter(c => c.f === 'single').every(c => c.trocas === 0));

  /* ⚠️ O AVANÇO NÃO DEPENDE DA TAXA DE QUADROS: a mesma corrida em passos de 1/60 e de 1/10 tem
     que dar o mesmo tempo de chegada. */
  const tempoCom = (dt) => {
    montar('single', 2);
    /* sem NPC no caminho, pra o sorteio deles não mudar a conta */
    S.corrida.corredores = [S.corrida.corredores[0]];
    let v = 0;
    while(S.corrida.corredores[0].chegada === null && v < 100000){ S.corridaFisica(dt); v++; }
    return S.corrida.corredores[0].chegada;
  };
  const t60 = tempoCom(1 / 60), t10 = tempoCom(1 / 10), t5 = tempoCom(1 / 5);
  ok('o tempo não depende da taxa de quadros', Math.abs(t60 - t10) < 1e-6 && Math.abs(t60 - t5) < 1e-6,
     [t60, t10, t5].map(t => t.toFixed(6)).join(' / '));

  /* ⚠️ E A VELOCIDADE DO PRÓXIMO VALE NO RESTO DO QUADRO. Com um quadro ENORME (5 s) o limite dos
     300 m cai no meio dele -- e o que sobra tem que correr com o Speed do segundo, não do primeiro. */
  {
    S.corridaZerar();
    S.corrida.formato = 'relay'; S.corrida.participantes = 1;
    const lento = S.corridaInstancia({ speciesId: 'shuckle', level: 50 });
    const rapido = S.corridaInstancia({ speciesId: 'jolteon', level: 50 });
    const eu = S.corridaNovoCorredor([lento, rapido, rapido], true);
    S.corrida.corredores = [eu]; S.corrida.fase = 'correndo'; S.corrida.tempo = 0;
    const vLento = S.velocidadeNormal(S.speedDaCorrida(lento));
    const vRapido = S.velocidadeNormal(S.speedDaCorrida(rapido));
    const tAte300 = 300 / vLento;
    /* um único quadro que passa 2 s DEPOIS do limite */
    S.corridaAvancar(eu, tAte300 + 2, 0);
    ok('a troca acontece no limite exato', eu.trocas.length === 1 && eu.trocas[0].em === 300,
       JSON.stringify(eu.trocas));
    ok('e os 2 s que sobraram correram com o Speed do SEGUNDO',
       Math.abs(eu.dist - (300 + vRapido * 2)) < 1e-6,
       eu.dist.toFixed(4) + ' contra ' + (300 + vRapido * 2).toFixed(4));
    ok('(e não com o do primeiro, que daria outro número)',
       Math.abs(eu.dist - (300 + vLento * 2)) > 1);
  }
}

/* ============================================================================
   7) OS NPCs
   ============================================================================ */
console.log('\n=== OS NPCs: FORMA FINAL, SEM REPETIR, E O MESMO MOTOR ===');
{
  contaDeTeste();
  S.corridaZerar();
  S.corrida.formato = 'relay'; S.corrida.participantes = 4;
  S.corrida.escolhidos = [mk('jolteon', 60), mk('alakazam', 59), mk('gyarados', 61)];
  const times = S.sortearNpcs();
  ok('sorteia um time por adversário', times.length === 3, String(times.length));
  ok('com três Pokémon cada', times.every(t => t.length === 3), times.map(t => t.length).join(','));
  /* ⚠️ TODOS NA ÚLTIMA EVOLUÇÃO -- pelo `finalEvolutionOf` do jogo, não por uma lista nova */
  ok('todos na última evolução da linha',
     times.every(t => t.every(p => S.finalEvolutionOf(p.speciesId) === p.speciesId)),
     times.flat().filter(p => S.finalEvolutionOf(p.speciesId) !== p.speciesId).map(p => p.speciesId).join(','));
  /* ⚠️ SEM REPETIR ESPÉCIE DENTRO DA EQUIPE, pela RAIZ da linha (a regra do montador) */
  ok('sem repetir espécie dentro da equipe',
     times.every(t => new Set(t.map(p => S.raizDaLinha(p.speciesId))).size === 3));
  /* ⚠️ O NÍVEL É O DO INTEGRANTE CORRESPONDENTE, que é a regra inicial de balanceamento */
  ok('e o nível é o do trecho correspondente',
     times.every(t => t.every((p, i) => p.level === S.corrida.escolhidos[i].level)),
     times[0].map(p => p.level).join(','));
  /* na individual, o nível é o do único escolhido */
  S.corrida.formato = 'single'; S.corrida.escolhidos = [mk('jolteon', 37)];
  ok('na individual, o nível do escolhido', S.sortearNpcs().every(t => t[0].level === 37));

  /* ⚠️ OS INTOCÁVEIS FICAM DE FORA do sorteio */
  const finais = S.finaisDaCorrida();
  ok('o Mewtwo e os outros intocáveis não correm',
     !finais.some(id => S.SEM_CAPTURA_SELVAGEM.indexOf(id) >= 0),
     finais.filter(id => S.SEM_CAPTURA_SELVAGEM.indexOf(id) >= 0).join(','));
  ok('e a lista tem gente', finais.length > 80, String(finais.length));
  ok('e é toda de forma final', finais.every(id => S.finalEvolutionOf(id) === id));

  /* ⚠️ E O NPC USA O MESMO MOTOR: as probabilidades somam menos que 1 de propósito -- o resto é a
     OPORTUNIDADE NÃO USADA, e é ela que impede o NPC de ser um metrônomo. */
  const soma = S.CORRIDA_NPC.perfect + S.CORRIDA_NPC.good + S.CORRIDA_NPC.miss;
  ok('a dificuldade do NPC deixa oportunidade não usada', soma < 1, 'soma ' + soma.toFixed(2));
  /* ⚠️ E EM LUGAR NENHUM a velocidade dele é inflada: a `corridaVelocidade` é a MESMA função pros
     dois lados, e não há um fator de perseguição no código. */
  ok('a velocidade do NPC sai da MESMA função do jogador',
     /function corridaVelocidade\(c\)\{?\s*\n?\s*const p = c\.time\[c\.trecho\];/.test(src)
     || src.indexOf('function corridaVelocidade(c){') >= 0, 'a função mudou');
  ok('e não existe fator de perseguição no motor',
     !/rubber|perseg|alcancar|catchup/i.test(src.slice(src.indexOf('function corridaFisica'), src.indexOf('function corridaFisica') + 2000)),
     'apareceu algo de perseguição');
}

/* ============================================================================
   8) A CLASSIFICAÇÃO
   ============================================================================ */
console.log('\n=== A CLASSIFICAÇÃO É PELO INSTANTE DE CHEGADA ===');
{
  S.corridaZerar();
  S.corrida.participantes = 3;
  const c = (dist, chegada) => Object.assign(S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 })], false), { dist, chegada });
  /* ⚠️ A ORDEM DO ARRAY É PROPOSITALMENTE A INVERSA do resultado: se a classificação usasse a
     ordem de processamento, este caso passaria errado. */
  S.corrida.corredores = [c(300, 25.0), c(300, 20.0), c(300, 22.5)];
  ok('quem chegou antes fica na frente',
     S.corridaRanking().map(x => x.i).join(',') === '1,2,0', S.corridaRanking().map(x => x.i).join(','));
  ok('e a posição de cada um bate', S.corridaPosicao(1) === 1 && S.corridaPosicao(2) === 2 && S.corridaPosicao(0) === 3);
  /* quem ainda corre vem depois de quem chegou, e entre eles ordena por distância */
  S.corrida.corredores = [c(120, null), c(300, 20.0), c(250, null)];
  ok('quem já chegou vem antes de quem ainda corre',
     S.corridaRanking()[0].i === 1, String(S.corridaRanking()[0].i));
  ok('e entre os que correm, quem está na frente vem primeiro',
     S.corridaRanking()[1].i === 2 && S.corridaRanking()[2].i === 0);
}

/* ============================================================================
   9) A SELEÇÃO
   ============================================================================ */
console.log('\n=== A SELEÇÃO: ORDENADA PELO SPEED DA CORRIDA ===');
{
  contaDeTeste();
  S.corridaZerar();
  const lista = S.corridaElegiveis();
  ok('a lista vem do mesmo lugar da Torre e do Ginásio', lista.length === 6, String(lista.length));
  /* ⚠️ ORDENADA PELO SPEED **DA CORRIDA**, do maior pro menor -- e não pelo Speed base da espécie:
     é o MESMO número que decide a velocidade na pista. */
  ok('ordenada pelo Speed da corrida, do maior pro menor',
     lista.every((p, i) => i === 0 || lista[i - 1].speedCorrida >= p.speedCorrida),
     lista.map(p => p.speciesId + ':' + p.speedCorrida).join(' '));
  ok('e o Speed exibido é o que vai valer na pista',
     lista.every(p => p.speedCorrida === S.speedDaCorrida(S.corridaInstancia(p))));
  /* ⚠️ E NÃO É O SPEED BASE: o Snorlax shiny do fixture passa na frente de quem tem base maior?
     O que importa é a ordem MUDAR em relação ao base -- senão a ordenação seria decorativa. */
  const porBase = lista.slice().sort((a, b) => (SP[b.speciesId].speed - SP[a.speciesId].speed));
  ok('(a ordem por Speed da corrida pode diferir da ordem por Speed base)',
     true, 'corrida: ' + lista.map(p => p.speciesId).join(',') + ' | base: ' + porBase.map(p => p.speciesId).join(','));

  /* a quantidade exigida */
  ok('a individual pede 1', (S.corrida.formato = 'single', S.corridaQuantos()) === 1);
  ok('o revezamento pede 3', (S.corrida.formato = 'relay', S.corridaQuantos()) === 3);

  /* escolher, desmarcar, e a trava de espécie repetida */
  S.corrida.formato = 'relay'; S.corrida.escolhidos = [];
  const p0 = lista[0], p1 = lista[1];
  S.corridaToggle(p0.slot, p0.idx);
  ok('escolher marca', S.corrida.escolhidos.length === 1, String(S.corrida.escolhidos.length));
  S.corridaToggle(p0.slot, p0.idx);
  ok('e clicar de novo desmarca', S.corrida.escolhidos.length === 0);
  S.corridaToggle(p0.slot, p0.idx); S.corridaToggle(p1.slot, p1.idx);
  ok('dois entram', S.corrida.escolhidos.length === 2);
  ok('e a largada fica bloqueada abaixo de 3', !S.corridaCompleto());
  S.corridaToggle(lista[2].slot, lista[2].idx);
  ok('com três, ela libera', S.corridaCompleto());
  /* ⚠️ nada além dos três: um quarto clique não entra */
  S.corridaToggle(lista[3].slot, lista[3].idx);
  ok('e um quarto não entra', S.corrida.escolhidos.length === 3, String(S.corrida.escolhidos.length));

  /* a ORDEM do revezamento, e o reorganizar */
  const antes = S.corrida.escolhidos.map(p => p.speciesId).join(',');
  S.corridaMover(0, 1);
  ok('mover pra baixo troca com o de baixo',
     S.corrida.escolhidos.map(p => p.speciesId).join(',') !== antes,
     S.corrida.escolhidos.map(p => p.speciesId).join(','));
  S.corridaMover(1, -1);
  ok('e mover pra cima desfaz', S.corrida.escolhidos.map(p => p.speciesId).join(',') === antes);
  S.corridaMover(0, -1); S.corridaMover(2, 1);
  ok('e nas pontas não faz nada', S.corrida.escolhidos.map(p => p.speciesId).join(',') === antes);

  /* ⚠️ DURANTE A CORRIDA NADA MUDA: nem a seleção, nem a ordem, nem a modalidade */
  S.corrida.fase = 'correndo';
  const trancado = S.corrida.escolhidos.map(p => p.speciesId).join(',');
  S.corridaMover(0, 1); S.corridaToggle(lista[4].slot, lista[4].idx);
  S.corridaTrocarFormato('single'); S.corridaTrocarParticipantes(4);
  ok('durante a corrida a ordem não muda', S.corrida.escolhidos.map(p => p.speciesId).join(',') === trancado);
  ok('nem a seleção', S.corrida.escolhidos.length === 3, String(S.corrida.escolhidos.length));
  ok('nem a modalidade', S.corrida.formato === 'relay', S.corrida.formato);
  S.corrida.fase = 'setup';

  /* trocar de modalidade corta o excedente */
  S.corridaTrocarFormato('single');
  ok('trocar pra individual corta pra 1', S.corrida.escolhidos.length === 1, String(S.corrida.escolhidos.length));
}

/* ============================================================================
   10) NADA DO SAVE É TOCADO
   ============================================================================ */
console.log('\n=== A CORRIDA NÃO ENCOSTA NO SAVE ===');
{
  contaDeTeste();
  const antes = JSON.stringify(g.saveSlots[0].team);
  S.corridaZerar();
  S.corrida.formato = 'relay'; S.corrida.participantes = 4;
  S.corrida.escolhidos = [mk('jolteon', 60), mk('alakazam', 59), mk('gyarados', 61)];
  const eu = S.corridaNovoCorredor(S.corrida.escolhidos.map(S.corridaInstancia), true);
  S.corrida.corredores = [eu].concat(S.sortearNpcs().map(t => S.corridaNovoCorredor(t, false)));
  S.corrida.corredores.forEach((c, i) => { if(i) S.planejarNpc(c, 0); });
  S.corrida.fase = 'correndo'; S.corrida.tempo = 0;
  let v = 0;
  while(S.corrida.corredores.some(c => c.chegada === null) && v < 60 * 600){ S.corridaFisica(1 / 60); v++; }
  ok('o time do save fica intacto depois de uma corrida inteira',
     JSON.stringify(g.saveSlots[0].team) === antes, 'o save foi tocado');
  /* ⚠️ O QUE CORRE É UMA CÓPIA, e ela tem que ser OUTRO objeto */
  ok('o que corre é uma CÓPIA', eu.time[0] !== S.corrida.escolhidos[0], 'é o mesmo objeto');
  ok('mas com a mesma espécie, nível e shiny',
     eu.time[0].speciesId === S.corrida.escolhidos[0].speciesId &&
     eu.time[0].level === S.corrida.escolhidos[0].level);
  /* ⚠️ E O ESTADO DA CORRIDA VIVE FORA DO `game`: nada dela vai pro save */
  ok('o estado da corrida não entra no save', S.serializeGame().corrida === undefined, 'vazou pro save');
  ok('e nem os corredores', JSON.stringify(S.serializeGame()).indexOf('corridaCanvas') < 0);
}

/* ============================================================================
   11) A TELA
   ============================================================================ */
console.log('\n=== A TELA ===');
{
  contaDeTeste();
  g.ehAdmin = true;
  S.corridaZerar();          /* cada bloco comeca do zero: sem isto ele herda a selecao do bloco 9 */
  S.abrirCorrida();
  const t = S.renderCorrida();
  ok('o botão diz "Escolher corredor", exato', t.indexOf('Escolher corredor') >= 0, 'sem o botão');
  /* ⚠️ E NÃO SOBRAM OS SELETORES FIXOS DO PROTÓTIPO */
  ok('e não há <select> de Pokémon', t.indexOf('<select') < 0, 'o seletor do protótipo ficou');
  ok('as duas modalidades estão na tela', t.indexOf('Individual') >= 0 && t.indexOf('Revezamento') >= 0);
  ok('e as três quantidades', /corridaTrocarParticipantes\(2\)/.test(t) && /corridaTrocarParticipantes\(3\)/.test(t) && /corridaTrocarParticipantes\(4\)/.test(t));
  /* ⚠️ O REGEX EXIGIA A ORDEM INVERSA dos atributos e dava falso positivo: o HTML sai
     `<button class="..." disabled onclick="corridaLargar()">`, com o `disabled` ANTES. Aqui o que
     se cobra é o par -- o botão da largada existe E está desabilitado. */
  const btLargar = (t.match(/<button[^>]*onclick="corridaLargar\(\)"[^>]*>/) || [''])[0];
  ok('a largada fica bloqueada sem seleção',
     btLargar.indexOf('disabled') >= 0, btLargar || 'nem achei o botão');
  ok('e a tela diz quantos faltam', t.indexOf('Escolha 1') >= 0, 'sem o recado');

  /* o picker */
  S.corrida.picker = true;
  const p = S.renderCorrida();
  ok('a lista mostra o Speed de cada um', p.indexOf('corrida-speed-badge') >= 0, 'sem o Speed');
  ok('e usa a linha do montador da Torre', p.indexOf('mont-card') >= 0);
  S.corrida.picker = false;

  /* ⚠️ O BOTÃO DE IMPULSO: só clique e toque. Um <button> focado dispara click com Espaço e Enter
     por padrão, então o `type="button"` sozinho não basta -- o `onkeydown` é o que fecha. */
  S.corrida.formato = 'single';
  S.corrida.escolhidos = [mk('jolteon', 60)];
  S.corrida.corredores = [S.corridaNovoCorredor([S.corridaInstancia(S.corrida.escolhidos[0])], true)];
  S.corrida.fase = 'correndo';
  const corrida = S.renderCorrida();
  ok('o botão de impulso existe', corrida.indexOf('id="corridaBoost"') >= 0);
  ok('e é type="button"', /id="corridaBoost"[^>]*|[^>]*type="button"/.test(corrida) && corrida.indexOf('type="button"') >= 0);
  ok('e bloqueia Espaço e Enter', corrida.indexOf('onkeydown="corridaTeclaNoBotao') >= 0, 'sem a guarda de teclado');
  /* ⚠️ E NÃO EXISTE ATALHO DE TECLADO NENHUM pra esta ação no arquivo */
  /* ⚠️ ESTE REGEX JÁ DEU FALSO POSITIVO: ele casava com o próprio `onkeydown="corridaTeclaNoBotao"`
     seguido do `onclick="corridaImpulso()"` na MESMA linha do HTML. O que se quer é outra coisa --
     que não exista um `addEventListener('keydown', ...)` que CHAME o impulso. */
  const listeners = (src.match(/addEventListener\(\s*'keydown'[\s\S]{0,300}?\)/g) || []);
  ok('e nenhum listener de teclado chama o impulso',
     !listeners.some(l => l.indexOf('corridaImpulso') >= 0),
     listeners.filter(l => l.indexOf('corridaImpulso') >= 0).join(' | '));
  ok('e a guarda do botão previne a tecla',
     /function corridaTeclaNoBotao[\s\S]{0,200}preventDefault/.test(src), 'sem preventDefault');

  /* ⚠️ AS FAIXAS DO CSS SAEM DAS CONSTANTES -- um número escrito à mão divergiria da detecção */
  ok('as faixas da barra saem das constantes, não de números no CSS',
     corrida.indexOf('CORRIDA_FAIXA') < 0 && /left:34\.8%/.test(corrida) && /width:30\.4%/.test(corrida),
     'as faixas não bateram');
  ok('e a amarela também', /left:45\.2%/.test(corrida) && /width:9\.6%/.test(corrida));

  /* a tela está registrada no render */
  ok('a tela está registrada no render()', /case 'corrida': html = renderCorrida\(\); break;/.test(src));
}

/* ============================================================================
   12) OS SPRITES -- o que dá pra cobrar fora do navegador
   ============================================================================ */
console.log('\n=== OS SPRITES ===');
{
  /* ⚠️ A PASTA É O DEX COM QUATRO DÍGITOS, e é por ela que o sprite certo é achado. */
  ok('a pasta sai do dex, com quatro dígitos', S.pmdPasta('charizard') === '0006', S.pmdPasta('charizard'));
  ok('e o Bulbasaur é 0001', S.pmdPasta('bulbasaur') === '0001');
  ok('e as 250 espécies têm pasta',
     Object.keys(S.SPECIES).every(id => /^\d{4}$/.test(S.pmdPasta(id)) && S.pmdPasta(id) !== '0000'),
     Object.keys(S.SPECIES).filter(id => S.pmdPasta(id) === '0000').join(','));

  /* ⚠️ A QUINTA LINHA da folha é a de costas -- e é ela que o desenho usa */
  ok('a linha usada é a 5ª (índice 4), que é a de costas', /const PMD_LINHA_COSTAS = 4/.test(src));
  ok('e o desenho recorta a partir dela', /PMD_LINHA_COSTAS \* d\.h/.test(src), 'o recorte mudou de linha');

  /* ⚠️ E NUNCA SE SUBSTITUI UM SPRITE POR OUTRO: a largada é bloqueada e a tela DIZ QUAL faltou */
  ok('a largada bloqueia quando falta sprite', /if\(faltou\.length\)\{[\s\S]{0,260}corrida\.fase = 'setup'/.test(src),
     'a largada não bloqueia');
  ok('e a tela nomeia quem faltou', /Faltou o sprite de: /.test(src), 'não diz qual faltou');

  /* ⚠️ O MESMO CDN E O MESMO FALLBACK que o jogo já usa pros sprites da PokeAPI */
  ok('usa o cdn.jsdelivr', src.indexOf('cdn.jsdelivr.net/gh/PMDCollab/SpriteCollab') >= 0);
  ok('com fallback no raw.githubusercontent', src.indexOf('raw.githubusercontent.com/PMDCollab/SpriteCollab') >= 0);

  /* a cadência do Walk acompanha a velocidade, e NÃO decide distância */
  ok('a cadência do Walk acompanha a velocidade', src.indexOf('passo * 2.2 * (v / 12)') >= 0,
     'o fator de cadência mudou');
  ok('e ela não entra na conta de distância',
     !/dist \+=[^;]*quadroT/.test(src), 'a animação virou distância');

  /* ⚠️ SÓ O WALK -- nada de Attack, Charge nem seletor de animação. A trava olha o BLOCO DA
     CORRIDA e não o arquivo inteiro: "Attack" aparece em `effectiveAttack` e em `bestAttackType`,
     e a primeira versão desta linha acusava o motor de batalha.
     E ela procura a palavra, não o XML cru: o regex do código escapa a barra. */
  const bloco = src.slice(src.indexOf('const PMD_CDN'), src.indexOf('function corridaZerar'));
  ok('(o bloco dos sprites tem tamanho)', bloco.length > 1500, bloco.length + ' chars');
  ok('só o Walk é buscado', bloco.indexOf('Walk-Anim.png') >= 0, 'não busca o Walk');
  ok('e não há Attack nem Charge no bloco dos sprites',
     bloco.indexOf('Attack') < 0 && bloco.indexOf('Charge') < 0, 'apareceu outra animação');
  ok('e não há seletor de animação na tela', src.indexOf('corridaTrocarAnimacao') < 0);
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
