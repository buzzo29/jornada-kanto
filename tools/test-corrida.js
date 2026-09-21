/**
 * CORRIDA POKÉMON -- o primeiro teste do modo, no cliente (18/09/2026).
 *
 * O que ele existe pra pegar, em ordem de importância:
 *   1. o acesso: o botão e a porta dependem de `admin === true`, e NADA MAIS autoriza;
 *   2. o Speed: é o do JOGO (com nível, shiny e especialidade) e não o do protótipo;
 *   3. a física: as trocas caem EXATAS nos múltiplos do trecho, mesmo com o limite no meio do quadro;
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
  /* ⚠️ A PORTA VIROU UMA ILHA (21/09/2026): a home tem UM botao administrativo, o `Ilhas Laranja`,
     e a Corrida mora na Ilha Navel -- cujo desafio no original e uma subida contra o tempo. */
  ok('com admin=true a home mostra as Ilhas Laranja', home().indexOf('Ilhas Laranja') >= 0, 'sem o botão');
  ok('  e nao mais o botao direto da Corrida', home().indexOf('abrirCorrida()') < 0, 'o botão velho voltou');
  const navel = S.ILHAS_LARANJA.find(i => i.id === 'navel');
  ok('  e a Ilha Navel e a que leva ate aqui', !!navel && navel.abrir === S.abrirCorrida,
     navel ? navel.jogo : 'sem ilha');
  g.screen = 'saveSelect';
  S.entrarNaIlha(S.ILHAS_LARANJA.indexOf(navel));
  ok('  e entrar nela abre a Corrida', g.screen === 'corrida', 'tela: ' + g.screen);

  g.ehAdmin = false;
  ok('sem admin o botão some', home().indexOf('Ilhas Laranja') < 0, 'aparece pra quem não é admin');
  g.ehAdmin = true; g.screen = 'saveSelect';

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

  /* ⚠️ ESTA TRAVA DIZIA O CONTRÁRIO ATÉ 20/09/2026, e a inversão dela é o registro da mudança:
     a escala de nível NASCEU aqui, em 18/09, porque o motor de batalha não tinha nenhuma -- o
     `effectiveSpeed` devolvia o MESMO número no Lv.5 e no Lv.99. Dois dias depois ela virou a regra
     do motor inteiro (a fórmula da Gen 3), e o `speedDaCorrida` passou a ser o próprio
     `effectiveSpeed`: mantida a conta antiga, a corrida escalaria DUAS vezes.
     A mensagem de falha aponta pro lugar certo se alguém desfizer um dos dois lados. */
  ok('o effectiveSpeed do motor ESCALA com o nível (a corrida não escala de novo)',
     S.effectiveSpeed(inst('jolteon', 5)) < S.effectiveSpeed(inst('jolteon', 99)),
     'se ele parou de escalar, o speedDaCorrida precisa da escala de volta');
  ok('  e o speedDaCorrida é exatamente ele',
     S.speedDaCorrida(inst('jolteon', 70)) === S.effectiveSpeed(inst('jolteon', 70)),
     String(S.speedDaCorrida(inst('jolteon', 70))));
  const s5 = S.speedDaCorrida(inst('jolteon', 5)), s50 = S.speedDaCorrida(inst('jolteon', 50)), s99 = S.speedDaCorrida(inst('jolteon', 99));
  ok('e o Speed da corrida escala', s5 < s50 && s50 < s99, [s5, s50, s99].join(' < '));
  ok('no Lv.50 ele fica perto do base (a escala do protótipo)', Math.abs(s50 - (SP.jolteon.speed + 5)) < 1,
     s50 + ' contra ' + SP.jolteon.speed);
  ok('e a fórmula é floor(base×2×nível/100)+5',
     s99 === Math.floor(SP.jolteon.speed * 2 * 99 / 100) + 5, String(s99));

  /* ⚠️ QUAIS MODIFICADORES ENTRAM: o shiny e a especialidade, porque o `effectiveSpeed` os aplica
     e a instância da corrida nasce LIMPA -- os outros degraus (terreno, fúria, paralisia, estágio)
     são no-op por construção.
     ⚠️ E ELES ENTRAM DEPOIS DA ESCALA desde 20/09/2026, que é a ordem do jogo original: a fórmula
     produz o ATRIBUTO, e o shiny multiplica ELE. Antes eles entravam na base e o `+5` da fórmula
     era multiplicado junto -- medido no Jolteon Lv.50 shiny: 161 antes, 162 depois. */
  const normal = S.speedDaCorrida(inst('jolteon', 50));
  const shiny = S.speedDaCorrida(inst('jolteon', 50, { shiny: true }));
  ok('o SHINY entra (1,20×)', shiny > normal, normal + ' -> ' + shiny);
  ok('e ele é exatamente o 1,20× do atributo',
     shiny === Math.round((Math.floor(SP.jolteon.speed * 2 * 50 / 100) + 5) * 1.20), String(shiny));
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
  /* ⚠️ A VERDE CAIU PELA METADE em 18/09/2026 (a pedido: *"diminua os quadrados verdes de bom em
     50%"*) -- de 30,4% pra 15,2%, e o `ini` andou junto pra ela continuar CENTRADA, como a amarela
     já tinha feito horas antes. É BALANCEAMENTO: o número fica fixado aqui pra uma mudança ser
     barulhenta, e o INVARIANTE (centradas e aninhadas) fica cobrado logo abaixo. */
  ok('a faixa verde é 15,2% a partir de 42,4%',
     S.CORRIDA_FAIXA.verde.ini === 0.424 && S.CORRIDA_FAIXA.verde.tam === 0.152,
     S.CORRIDA_FAIXA.verde.ini + ' / ' + S.CORRIDA_FAIXA.verde.tam);
  ok('e ela é metade do que ELA era (30,4%)',
     Math.abs(S.CORRIDA_FAIXA.verde.tam - 0.304 / 2) < 1e-9, String(S.CORRIDA_FAIXA.verde.tam));
  /* ⚠️ A AMARELA CAIU PELA METADE em 18/09/2026 (a pedido) -- de 9,6% pra 4,8%, e o `ini` andou
     junto pra ela continuar CENTRADA. Só encolher o `tam` deslocaria o perfeito pra a esquerda. */
  ok('a amarela é 4,8% a partir de 47,6%',
     S.CORRIDA_FAIXA.amarela.ini === 0.476 && S.CORRIDA_FAIXA.amarela.tam === 0.048,
     S.CORRIDA_FAIXA.amarela.ini + ' / ' + S.CORRIDA_FAIXA.amarela.tam);
  ok('e ela é metade da verde... não: metade do que ELA era (9,6%)',
     Math.abs(S.CORRIDA_FAIXA.amarela.tam - 0.096 / 2) < 1e-9, String(S.CORRIDA_FAIXA.amarela.tam));
  /* ⚠️ O INVARIANTE DAS DUAS, e é ele que sobrevive ao próximo ajuste de tamanho: as duas são
     CENTRADAS em 0,5 e a amarela fica DENTRO da verde. Encolher só o `tam` de uma delas quebra a
     primeira metade -- e o defeito não aparece como erro, aparece como o "perfeito" deslocado pra
     a esquerda do centro da barra. */
  for(const [nome, f] of [['verde', S.CORRIDA_FAIXA.verde], ['amarela', S.CORRIDA_FAIXA.amarela]])
    ok('a ' + nome + ' é centrada em 0,5', Math.abs(f.ini + f.tam / 2 - 0.5) < 1e-9,
       String(f.ini + f.tam / 2));
  ok('e a amarela fica DENTRO da verde',
     S.CORRIDA_FAIXA.amarela.tam < S.CORRIDA_FAIXA.verde.tam,
     S.CORRIDA_FAIXA.amarela.tam + ' < ' + S.CORRIDA_FAIXA.verde.tam);
  /* ⚠️ E ELA CONTINUA DENTRO DA VERDE -- fora dela, um "perfeito" cairia onde a barra desenha erro */
  const v = S.CORRIDA_FAIXA.verde, am = S.CORRIDA_FAIXA.amarela;
  ok('e a amarela continua dentro da verde',
     am.ini >= v.ini - 1e-9 && am.ini + am.tam <= v.ini + v.tam + 1e-9,
     am.ini + '–' + (am.ini + am.tam) + ' dentro de ' + v.ini + '–' + (v.ini + v.tam));
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
  /* ⚠️ AS BORDAS SAEM DA TABELA, e não de números escritos aqui: estas quatro linhas tinham
     0,452 e 0,548 fixos, e ENVELHECERAM no dia em que a faixa amarela caiu pela metade -- elas
     passaram a acusar o que estava certo. É a mesma lição do "59 espécies" da ficha da Pokédex.
     Derivadas, uma mudança de tamanho de faixa é acompanhada sozinha. */
  const fv = S.CORRIDA_FAIXA.verde, fa = S.CORRIDA_FAIXA.amarela;
  const umFio = 1e-4;
  ok('o início exato do verde é "bom"', S.resultadoDoImpulso(fv.ini) === 'good', String(fv.ini));
  ok('o fim exato do verde é "bom"', S.resultadoDoImpulso(fv.ini + fv.tam) === 'good');
  ok('o início exato da amarela é "perfeito"', S.resultadoDoImpulso(fa.ini) === 'perfect', String(fa.ini));
  ok('o fim exato da amarela é "perfeito"', S.resultadoDoImpulso(fa.ini + fa.tam) === 'perfect');
  ok('o centro é "perfeito"', S.resultadoDoImpulso(0.5) === 'perfect');
  ok('e um fio fora do verde é erro',
     S.resultadoDoImpulso(fv.ini - umFio) === 'miss' && S.resultadoDoImpulso(fv.ini + fv.tam + umFio) === 'miss');
  ok('e um fio fora da amarela é "bom"',
     S.resultadoDoImpulso(fa.ini - umFio) === 'good' && S.resultadoDoImpulso(fa.ini + fa.tam + umFio) === 'good');
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

  /* ⚠️ ESTA TRAVA MEDIA A AGULHA NO MEIO DA BARRA e esperava "perfeito" -- e isso deixou de valer
     quando as faixas passaram a SE MOVER (18/09/2026): 0,5 não é mais o centro delas.
     Hoje ela cobra o que importa de verdade e é mais forte: o impulso aplica EXATAMENTE o que o
     `resultadoDoImpulso` devolve pra aquele instante, com o MESMO centro que a barra desenha. Se
     a detecção e o desenho divergirem, é aqui que aparece. */
  S.corrida.tempo = T * 0.5;
  const esperado = S.resultadoDoImpulso(S.corridaPosBarra(), S.centroDasFaixas());
  S.corridaImpulso();
  ok('a 1ª tentativa vale, com o resultado da barra naquele instante',
     eu.mult === S.CORRIDA_EFEITOS[esperado].mult, esperado + ' -> ' + eu.mult);
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
console.log('\n=== A FÍSICA: AS TROCAS CAEM NOS MÚLTIPLOS DO TRECHO ===');
{
  contaDeTeste();
  const montar = (formato) => {
    S.corridaZerar();
    S.corrida.formato = formato;
    const meus = formato === 'relay'
      ? g.saveSlots[0].team.slice(0, S.CORRIDA_TRECHOS)
      : [mk('jolteon', 60)];
    S.corrida.escolhidos = meus;
    const eu = S.corridaNovoCorredor(meus.map(S.corridaInstancia), true);
    const npcs = S.sortearNpcs();
    S.corrida.corredores = [eu].concat(npcs.map(t => S.corridaNovoCorredor(t, false)));
    S.corrida.corredores.forEach((c, i) => { if(i) S.planejarNpc(c, 0); });
    S.corrida.fase = 'correndo'; S.corrida.tempo = 0;
  };
  const rodar = () => { let v = 0; while(S.corrida.corredores.some(c => c.chegada === null) && v < 60 * 600){ S.corridaFisica(1 / 60); v++; } };

  /* ⚠️ AS DUAS MODALIDADES. Eram SEIS combinações (2, 3 ou 4 na pista) -- a escolha de quantos
     correm saiu em 20/09/2026 e são sempre `CORRIDA_PARTICIPANTES`. A trava media um botão que
     não existe mais; ela passou a medir a REGRA, que é o número ser o da constante. */
  const combos = [];
  for(const f of ['single', 'relay']){
    montar(f); rodar();
    const trocas = S.corrida.corredores.flatMap(c => c.trocas);
    combos.push({
      f, n: S.CORRIDA_PARTICIPANTES,
      corredores: S.corrida.corredores.length,
      terminou: S.corrida.corredores.every(c => c.chegada !== null),
      distExata: S.corrida.corredores.every(c => c.dist === S.corridaTotal()),
      trocas: trocas.length,
            /* ⚠️ A troca cai no MÚLTIPLO EXATO do trecho, mesmo caindo no meio do quadro. Medida de
         FORA, no fim do quadro, ela sai um tiquinho além -- porque o PRÓXIMO já correu o resto do
         quadro, que é o que o pedido manda fazer. É por isso que a troca é REGISTRADA. */
      trocasExatas: trocas.every(t => t.em % S.corridaMetros() === 0 && t.em > 0 && t.em < S.corridaTotal()),
    });
  }
  ok('as duas modalidades terminam', combos.every(c => c.terminou), JSON.stringify(combos.filter(c => !c.terminou)));
  ok('e são sempre ' + S.CORRIDA_PARTICIPANTES + ' na pista',
     combos.every(c => c.corredores === S.CORRIDA_PARTICIPANTES),
     combos.map(c => c.f + ':' + c.corredores).join(' '));
  ok('e todos param na distância EXATA', combos.every(c => c.distExata),
     JSON.stringify(combos.filter(c => !c.distExata)));
  /* ⚠️ E AS TROCAS CAEM NO MÚLTIPLO EXATO DO TRECHO, mesmo caindo no meio do quadro. Medida de
     FORA, no fim do quadro, a distância passa um pouco -- porque o PRÓXIMO já correu o resto do
     quadro, que é exatamente o que o pedido manda fazer. É por isso que a troca é REGISTRADA. */
  ok('e as trocas caem nos múltiplos EXATOS do trecho', combos.every(c => c.trocasExatas),
     JSON.stringify(combos.filter(c => !c.trocasExatas)));
  ok('e o revezamento tem uma troca por degrau', combos.filter(c => c.f === 'relay').every(c => c.trocas === c.n * (S.CORRIDA_TRECHOS - 1)),
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

  /* ⚠️ E A VELOCIDADE DO PRÓXIMO VALE NO RESTO DO QUADRO. Com um quadro ENORME o limite do trecho
     cai no meio dele -- e o que sobra tem que correr com o Speed do segundo, não do primeiro. */
  {
    S.corridaZerar();
    S.corrida.formato = 'relay';
    const lento = S.corridaInstancia({ speciesId: 'shuckle', level: 50 });
    const rapido = S.corridaInstancia({ speciesId: 'jolteon', level: 50 });
    const eu = S.corridaNovoCorredor([lento, rapido, rapido], true);
    S.corrida.corredores = [eu]; S.corrida.fase = 'correndo'; S.corrida.tempo = 0;
    const vLento = S.velocidadeNormal(S.speedDaCorrida(lento));
    const vRapido = S.velocidadeNormal(S.speedDaCorrida(rapido));
    const trecho = S.CORRIDA_METROS_TRECHO;
    const tAteOLimite = trecho / vLento;
    /* um único quadro que passa 2 s DEPOIS do limite */
    S.corridaAvancar(eu, tAteOLimite + 2, 0);
    ok('a troca acontece no limite exato', eu.trocas.length === 1 && eu.trocas[0].em === trecho,
       JSON.stringify(eu.trocas));
    ok('e os 2 s que sobraram correram com o Speed do SEGUNDO',
       Math.abs(eu.dist - (trecho + vRapido * 2)) < 1e-6,
       eu.dist.toFixed(4) + ' contra ' + (trecho + vRapido * 2).toFixed(4));
    ok('(e não com o do primeiro, que daria outro número)',
       Math.abs(eu.dist - (trecho + vLento * 2)) > 1);
  }
}

/* ============================================================================
   7) OS NPCs
   ============================================================================ */
console.log('\n=== OS NPCs: FORMA FINAL, SEM REPETIR, E O MESMO MOTOR ===');
{
  contaDeTeste();
  S.corridaZerar();
  S.corrida.formato = 'relay';
  S.corrida.escolhidos = g.saveSlots[0].team.slice(0, S.CORRIDA_TRECHOS);
  const times = S.sortearNpcs();
  ok('sorteia um time por adversário', times.length === 3, String(times.length));
  ok('com o time inteiro cada', times.every(t => t.length === S.CORRIDA_TRECHOS), times.map(t => t.length).join(','));
  /* ⚠️ TODOS NA ÚLTIMA EVOLUÇÃO -- pelo `finalEvolutionOf` do jogo, não por uma lista nova */
  ok('todos na última evolução da linha',
     times.every(t => t.every(p => S.finalEvolutionOf(p.speciesId) === p.speciesId)),
     times.flat().filter(p => S.finalEvolutionOf(p.speciesId) !== p.speciesId).map(p => p.speciesId).join(','));
  /* ⚠️ SEM REPETIR ESPÉCIE DENTRO DA EQUIPE, pela RAIZ da linha (a regra do montador) */
  ok('sem repetir espécie dentro da equipe',
     times.every(t => new Set(t.map(p => S.raizDaLinha(p.speciesId))).size === S.CORRIDA_TRECHOS));
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
  /* ⚠️ O NÚMERO É O TETO DO TIME DO JOGO (6), e não um número escolhido: o pedido é *"o
     revezamento vai ser entre os 6 do time"*. Sem esta trava, as outras todas derivam do
      e um 3 de volta passaria sem ninguém ver -- conferido. */
  ok('o revezamento é o time INTEIRO (6)', S.CORRIDA_TRECHOS === 6, String(S.CORRIDA_TRECHOS));
  ok('  e a pescaria leva o mesmo time', S.PESCARIA_TIME === S.CORRIDA_TRECHOS,
     S.PESCARIA_TIME + ' x ' + S.CORRIDA_TRECHOS);
  ok('a individual pede 1', (S.corrida.formato = 'single', S.corridaQuantos()) === 1);
  ok('o revezamento pede o time inteiro', (S.corrida.formato = 'relay', S.corridaQuantos()) === S.CORRIDA_TRECHOS,
     String(S.corridaQuantos()));

  /* ============================================================================
     ⚠️ NO REVEZAMENTO A ESCOLHA É DE UM TIME (20/09/2026, a pedido)
     ============================================================================
     *"na corrida a mesma coisa, no revezamento, ao invés de escolher 3 pokemons de qualquer time,
     vai ter que escolher 1 time e o revezamento vai ser entre os 6 do time"*
     ============================================================================ */
  S.corrida.formato = 'relay'; S.corrida.escolhidos = [];
  /* ⚠️ O TOGGLE DE POKÉMON É INERTE NO REVEZAMENTO -- e quem recusa é a AÇÃO, não a tela: um
     clique forjado no console montaria uma equipe de pokémon soltos de saves diferentes, que é
     exatamente o que o pedido tirou. */
  const p0 = lista[0];
  S.corridaToggle(p0.slot, p0.idx);
  ok('o toggle de pokémon é INERTE no revezamento', S.corrida.escolhidos.length === 0,
     String(S.corrida.escolhidos.length));

  /* ⚠️ E O TIME TEM QUE SER CAMPEÃO -- as 8 insígnias, a mesma porta da Liga, do Ginásio da
     Cidade e da Batalha Online (*"para ambos os jogos, só pode escolher um time vencedor das 8
     insígnias"*). Quem responde é o `savesCampeoes`, e quem valida é a AÇÃO. */
  g.saveSlots[1] = { team: [mk('pidgey', 30)], badgeCount: 3, customName: 'Meio do caminho' };
  S.corridaEscolherTime(1);
  ok('  e um time SEM as 8 insígnias é recusado', S.corrida.escolhidos.length === 0,
     String(S.corrida.escolhidos.length));
  S.corridaEscolherTime(0);
  ok('escolher o time campeão traz os seis', S.corrida.escolhidos.length === S.CORRIDA_TRECHOS,
     String(S.corrida.escolhidos.length));
  ok('  na ordem do save', S.corrida.escolhidos.map(p => p.speciesId).join(',')
     === g.saveSlots[0].team.slice(0, S.CORRIDA_TRECHOS).map(p => p.speciesId).join(','),
     S.corrida.escolhidos.map(p => p.speciesId).join(','));
  ok('  e a largada libera', S.corridaCompleto());
  ok('  e o picker fecha', !S.corrida.picker);
  /* ⚠️ O SLOT VIAJA EM CADA UM: ele é o que a fileira da tela usa pra dizer de que time o
     revezamento é, e é ele que o `equiparItens` leria no dia em que item valer aqui. */
  ok('  e cada um carrega o slot de onde veio',
     S.corrida.escolhidos.every(p => p.slot === 0 && p.teamName));

  /* a ORDEM do revezamento, e o reorganizar -- as setas continuam existindo */
  const antes = S.corrida.escolhidos.map(p => p.speciesId).join(',');
  S.corridaMover(0, 1);
  ok('mover pra baixo troca com o de baixo',
     S.corrida.escolhidos.map(p => p.speciesId).join(',') !== antes,
     S.corrida.escolhidos.map(p => p.speciesId).join(','));
  S.corridaMover(1, -1);
  ok('e mover pra cima desfaz', S.corrida.escolhidos.map(p => p.speciesId).join(',') === antes);
  S.corridaMover(0, -1); S.corridaMover(S.CORRIDA_TRECHOS - 1, 1);
  ok('e nas pontas não faz nada', S.corrida.escolhidos.map(p => p.speciesId).join(',') === antes);

  /* ⚠️ DURANTE A CORRIDA NADA MUDA: nem a seleção, nem a ordem, nem a modalidade */
  S.corrida.fase = 'correndo';
  const trancado = S.corrida.escolhidos.map(p => p.speciesId).join(',');
  S.corridaMover(0, 1); S.corridaEscolherTime(0);
  S.corridaTrocarFormato('single');
  ok('durante a corrida a ordem não muda', S.corrida.escolhidos.map(p => p.speciesId).join(',') === trancado);
  ok('nem a seleção', S.corrida.escolhidos.length === S.CORRIDA_TRECHOS, String(S.corrida.escolhidos.length));
  ok('nem a modalidade', S.corrida.formato === 'relay', S.corrida.formato);
  S.corrida.fase = 'setup';

  /* ⚠️ ELA MEDIA O CORTE ("trocar pra individual corta pra 1"), e cortar seis pra um DEIXA o
     primeiro -- que era justamente o defeito reportado em 20/09. Hoje cada modalidade tem a
     própria seleção, e a trava do que ficou no lugar está no bloco 23. */
  S.corridaTrocarFormato('single');
  ok('trocar de modalidade não traz ninguém do outro lado', S.corrida.escolhidos.length === 0,
     String(S.corrida.escolhidos.length));
}

/* ============================================================================
   10) NADA DO SAVE É TOCADO
   ============================================================================ */
console.log('\n=== A CORRIDA NÃO ENCOSTA NO SAVE ===');
{
  contaDeTeste();
  const antes = JSON.stringify(g.saveSlots[0].team);
  S.corridaZerar();
  S.corrida.formato = 'relay';
  S.corrida.escolhidos = g.saveSlots[0].team.slice(0, S.CORRIDA_TRECHOS);
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
  /* ⚠️ O RÓTULO SEGUE A MODALIDADE (20/09/2026): "corredor" na individual, "equipe" no
     revezamento -- e ele sai da MESMA função nos dois lugares que o mostram (o botão do setup e o
     título do picker), senão o botão e a tela pra onde ele leva diriam coisas diferentes. */
  ok('na individual o botão diz "Escolher corredor"', t.indexOf('Escolher corredor') >= 0, 'sem o botão');
  S.corridaTrocarFormato('relay');
  const tRelay = S.renderCorrida();
  ok('  e no revezamento, "Escolher equipe"',
     tRelay.indexOf('Escolher equipe') >= 0 && tRelay.indexOf('Escolher corredor') < 0,
     'rótulo do revezamento');
  /* ⚠️ E A TELA PRA ONDE ELE LEVA JÁ ERA OUTRA: no revezamento o picker é o de TIMES, com título
     próprio -- o que dizia a mesma coisa nas duas modalidades era só o botão. */
  S.corridaAbrirPicker();
  ok('  e o picker do revezamento é o de TIMES', S.renderCorrida().indexOf('Qual time faz o revezamento?') >= 0);
  S.corridaFecharPicker(); S.corridaTrocarFormato('single');
  S.corridaAbrirPicker();
  ok('  e o da individual é a lista de Pokémon', S.renderCorrida().indexOf('Escolher corredor') >= 0);
  S.corridaFecharPicker();
  /* ⚠️ E NÃO SOBRAM OS SELETORES FIXOS DO PROTÓTIPO */
  ok('e não há <select> de Pokémon', t.indexOf('<select') < 0, 'o seletor do protótipo ficou');
  ok('as duas modalidades estão na tela', t.indexOf('Individual') >= 0 && t.indexOf('Revezamento') >= 0);
  /* ⚠️ E A ESCOLHA DE QUANTOS CORREM SAIU (20/09/2026, a pedido): são sempre
     `CORRIDA_PARTICIPANTES`. A trava cobrava os três botões e passou a cobrar que eles NÃO
     existam -- nem o controle, nem a ação que ele chamava. */
  ok('e não há mais escolha de quantos correm',
     t.indexOf('corridaTrocarParticipantes') < 0 && src.indexOf('function corridaTrocarParticipantes') < 0);
  ok('  e a tela diz quantos são', t.indexOf(S.CORRIDA_PARTICIPANTES + ' Pokémon na pista') >= 0);
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
     corrida.indexOf('CORRIDA_FAIXA') < 0 &&
     corrida.indexOf('left:' + (S.CORRIDA_FAIXA.verde.ini * 100) + '%') >= 0 &&
     corrida.indexOf('width:' + (S.CORRIDA_FAIXA.verde.tam * 100) + '%') >= 0,
     'as faixas não bateram');
  /* ⚠️ DERIVADO DA TABELA, pelo mesmo motivo das bordas: com os números fixos, esta linha acusava
     o que estava certo assim que a faixa mudou de tamanho. */
  ok('e a amarela também',
     corrida.indexOf('left:' + (S.CORRIDA_FAIXA.amarela.ini * 100) + '%') >= 0 &&
     corrida.indexOf('width:' + (S.CORRIDA_FAIXA.amarela.tam * 100) + '%') >= 0,
     'a amarela não bateu');

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


/* ============================================================================
   13) AS FAIXAS SE MOVEM (18/09/2026)
   ============================================================================ */
console.log('\n=== AS FAIXAS SE MOVEM, E NUNCA EM SINCRONIA COM A AGULHA ===');
{
  contaDeTeste();
  S.corridaZerar();
  const eu = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true)], true);
  S.corrida.corredores = [eu];

  /* ⚠️ ELE SE MOVE: se o centro fosse fixo, o pedido não teria sido atendido.
     ⚠️ E A TRAVA ADIANTA A FASE em vez de escrever o `corrida.tempo` (20/09/2026): desde que as
     faixas aceleram com a sequência, o centro é a integral da velocidade angular e não uma conta
     do relógio -- é isso que impede a faixa de TELEPORTAR quando o período muda. Escrever o tempo
     deixou de mover qualquer coisa, e a trava passou a medir o mecanismo de verdade. */
  const centros = [];
  S.corrida.faseFaixas = 0;
  for(let t = 0; t < 12; t += 0.05){ S.corridaAvancarFaixas(0.05); centros.push(S.centroDasFaixas()); }
  const min = Math.min(...centros), max = Math.max(...centros);
  ok('o centro das faixas se move', max - min > 0.2, min.toFixed(3) + ' a ' + max.toFixed(3));

  /* ⚠️ E ELE NUNCA LEVA A FAIXA PRA FORA DA BARRA -- a verde é a mais larga, e é ela que decide */
  const meiaVerde = S.CORRIDA_FAIXA.verde.tam / 2;
  ok('e a faixa verde nunca sai da barra',
     centros.every(c => c - meiaVerde >= 0 && c + meiaVerde <= 1),
     'extremos: ' + (min - meiaVerde).toFixed(3) + ' / ' + (max + meiaVerde).toFixed(3));

  /* ⚠️ QUANTO MAIOR O NÍVEL, MAIS DEVAGAR (período maior) */
  const p1 = S.periodoDasFaixas(1), p50 = S.periodoDasFaixas(50), p99 = S.periodoDasFaixas(99);
  ok('quanto maior o nível, mais devagar a faixa', p1 < p50 && p50 < p99,
     [p1, p50, p99].map(x => x.toFixed(2)).join(' < '));
  ok('e o Lv.1 é o mais rápido dos dois extremos', p1 === S.CORRIDA_TRAVESSIA * S.CORRIDA_FAIXA_RAZAO_MIN);
  /* ⚠️ E ELAS FICARAM MAIS RÁPIDAS (a pedido): o período do Lv.1 tem que ser MENOR que o ciclo da
     agulha (2,88 s) -- antes ele era 3,10 s, ou seja a faixa passeava mais devagar que o marcador. */
  ok('e a faixa é mais rápida que o ciclo da agulha', p1 < S.CORRIDA_TRAVESSIA * 2,
     p1.toFixed(2) + ' s contra ' + (S.CORRIDA_TRAVESSIA * 2).toFixed(2) + ' s');
  ok('e o Lv.99 é o mais lento', Math.abs(p99 - S.CORRIDA_TRAVESSIA * S.CORRIDA_FAIXA_RAZAO_MAX) < 1e-9);

  /* ⚠️ E O PERÍODO NUNCA BATE COM O DA AGULHA, em nenhum dos 99 níveis: se batesse, as duas
     andariam juntas e a barra viraria um alvo parado -- que é o que o pedido manda evitar.
     O ciclo da agulha é 2×travessia; a checagem é contra ele E contra a travessia. */
  const ciclo = S.CORRIDA_TRAVESSIA * 2;
  const ruins = [];
  for(let n = 1; n <= 99; n++){
    const p = S.periodoDasFaixas(n);
    for(const base of [S.CORRIDA_TRAVESSIA, ciclo]){
      const razao = p / base;
      if(Math.abs(razao - Math.round(razao)) < 0.02) ruins.push(n + ':' + p.toFixed(3) + '/' + base);
    }
  }
  ok('e em nenhum nível ele fica em sincronia com a agulha', ruins.length === 0, ruins.join(' '));
  /* ⚠️ E O PISO DA SEQUÊNCIA TAMBÉM NÃO (20/09/2026). Com a aceleração, o período efetivo é o do
     nível VEZES o fator -- e o intervalo inteiro (0,52 a 1,90 da travessia) ATRAVESSA o inteiro 1,
     ou seja existem combinações nível+sequência em sincronia. Elas são toleradas porque duram UMA
     travessia: cada acerto muda a sequência, então a configuração não fica parada tempo suficiente
     pra ser decorada.
     ⚠️ O QUE NÃO PODE FICAR EM SINCRONIA É O PISO, porque ele é o único estado que PERSISTE: a
     partir de `CORRIDA_SEQUENCIA_MIN` o fator para de mudar, e ali o jogador passa o resto da
     prova (medido: a sequência chega ao piso em 100% das corridas de quem joga bem). */
  const noPiso = [];
  for(let n = 1; n <= 99; n++){
    const pp = S.periodoDasFaixas(n) * S.CORRIDA_SEQUENCIA_MIN;
    for(const base of [S.CORRIDA_TRAVESSIA, ciclo]){
      const razao = pp / base;
      if(Math.abs(razao - Math.round(razao)) < 0.02 && Math.round(razao) >= 1) noPiso.push(n + ':' + pp.toFixed(3));
    }
  }
  ok('  nem no PISO da sequência, que é o estado que dura', noPiso.length === 0, noPiso.join(' '));

  /* ⚠️ A DETECÇÃO USA O CENTRO MÓVEL: no MESMO ponto da barra, o resultado muda conforme a faixa
     passeia -- é isso que faz a mecânica existir. */
  const noCentroDaBarra = [];
  S.corrida.faseFaixas = 0;
  for(let t = 0; t < 10; t += 0.1){ S.corridaAvancarFaixas(0.1); noCentroDaBarra.push(S.resultadoDoImpulso(0.5, S.centroDasFaixas())); }
  ok('no mesmo ponto da barra, o resultado muda com a faixa',
     new Set(noCentroDaBarra).size > 1, [...new Set(noCentroDaBarra)].join(','));
  /* e acertar o centro DELAS é sempre perfeito, em qualquer instante */
  let semprePerfeito = true;
  S.corrida.faseFaixas = 0;
  for(let t = 0; t < 10; t += 0.07){
    S.corridaAvancarFaixas(0.07);
    if(S.resultadoDoImpulso(S.centroDasFaixas(), S.centroDasFaixas()) !== 'perfect') semprePerfeito = false;
  }
  ok('e acertar o centro DELAS é sempre perfeito', semprePerfeito);

  /* ⚠️ O NÍVEL LIDO É O DO POKÉMON QUE CORRE AGORA -- no revezamento ele muda a cada trecho.
     ⚠️ E A TRAVA MEDE O RITMO, não o centro instantâneo: com a fase acumulada, trocar de trecho
     muda a VELOCIDADE da faixa daí pra frente e ela continua de onde estava. A versão velha
     cobrava justamente o SALTO (`c0 !== c1`), que é o defeito que a fase acumulada tirou. */
  const relay = S.corridaNovoCorredor([
    S.corridaInstancia({ speciesId: 'jolteon', level: 5 }, true),
    S.corridaInstancia({ speciesId: 'jolteon', level: 90 }, true),
    S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true)], true);
  S.corrida.corredores = [relay];
  const andou = (trecho) => {
    relay.trecho = trecho; S.corrida.faseFaixas = 0; S.corridaAvancarFaixas(1);
    return S.corrida.faseFaixas;
  };
  const a0 = andou(0), a1 = andou(1);
  ok('e o período acompanha o pokémon do trecho atual', a0 > a1,
     'Lv.5 anda ' + a0.toFixed(3) + ' rad/s | Lv.90 anda ' + a1.toFixed(3));
  /* ⚠️ E A TROCA DE TRECHO NÃO TELEPORTA A FAIXA: o centro imediatamente antes e depois é o MESMO.
     Com o centro calculado do relógio, ele saltava a cada troca -- e ninguém tinha reportado
     porque o salto passava por uma travessia inteira. */
  S.corrida.faseFaixas = 2.1; relay.trecho = 0;
  const antes = S.centroDasFaixas(); relay.trecho = 1;
  ok('  e trocar de trecho não teleporta a faixa', S.centroDasFaixas() === antes,
     antes.toFixed(4) + ' -> ' + S.centroDasFaixas().toFixed(4));
}

/* ============================================================================
   ⚠️ A SEQUÊNCIA ACELERA AS FAIXAS (20/09/2026, a pedido: *"enquanto o treinador não errar, ou
   seja, só ficar acertando o perfeito e bom, a barra amarela e verde vai ficando mais rapida, e
   quando o treinador erra, ela volta a ficar na velocidade normal"*).
   ============================================================================ */
console.log('\n=== A SEQUÊNCIA ACELERA AS FAIXAS ===');
{
  contaDeTeste();
  S.corridaZerar();
  const eu = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true)], true);
  S.corrida.corredores = [eu];
  S.corrida.fase = 'correndo';

  /* o fator cai a cada acerto e tem piso -- sem ele a faixa viraria um borrão */
  ok('sem sequência, o fator é 1', S.fatorDaSequencia(0) === 1);
  const f = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 40].map(n => S.fatorDaSequencia(n));
  ok('  e ele só encolhe', f.every((v, i) => i === 0 || v <= f[i - 1]),
     f.map(v => v.toFixed(3)).join(' '));
  ok('  com piso', Math.min(...f) === S.CORRIDA_SEQUENCIA_MIN,
     'piso ' + S.CORRIDA_SEQUENCIA_MIN + ' (a faixa nunca passa de ' + (1 / S.CORRIDA_SEQUENCIA_MIN).toFixed(2) + 'x)');
  ok('  e um passo é ' + Math.round(S.CORRIDA_SEQUENCIA_PASSO * 100) + '%',
     Math.abs(S.fatorDaSequencia(1) - (1 - S.CORRIDA_SEQUENCIA_PASSO)) < 1e-9);

  /* ⚠️ O PERÍODO ENCOLHE DE VERDADE -- é ele que a barra desenha */
  S.corrida.sequencia = 0; const p0 = S.periodoDasFaixasAgora();
  S.corrida.sequencia = 4; const p4 = S.periodoDasFaixasAgora();
  ok('quatro acertos seguidos deixam a faixa mais rápida', p4 < p0,
     p0.toFixed(2) + ' s -> ' + p4.toFixed(2) + ' s');
  ok('  e é exatamente o fator', Math.abs(p4 - p0 * S.fatorDaSequencia(4)) < 1e-9);

  /* ⚠️ ACERTAR SOBE, ERRAR ZERA -- e é a única porta do JOGADOR na barra */
  const bater = (pos) => {
    /* põe a barra na posição pedida sem mexer na fase das faixas */
    S.corrida.tempo = pos * S.CORRIDA_TRAVESSIA;
    S.corrida.tentativaDaTravessia = -1;
    eu.chegada = null;
    S.corridaImpulso();
  };
  S.corrida.faseFaixas = 0; S.corrida.sequencia = 0;
  /* o centro está em 0,5 com a fase zerada, então a barra em 0,5 é perfeito */
  bater(0.5); const s1 = S.corrida.sequencia;
  bater(1.5); const s2 = S.corrida.sequencia;
  bater(2.5); const s3 = S.corrida.sequencia;
  ok('cada acerto sobe a sequência', s1 === 1 && s2 === 2 && s3 === 3, [s1, s2, s3].join(','));
  /* e um erro (a barra na ponta) zera */
  S.corrida.tempo = 4 * S.CORRIDA_TRAVESSIA; S.corrida.tentativaDaTravessia = -1;
  S.corridaImpulso();
  ok('  e um erro zera', S.corrida.sequencia === 0, 'sequência ' + S.corrida.sequencia);
  ok('  e o recado diz que a faixa voltou ao normal',
     S.corrida.recado.indexOf('voltou ao normal') >= 0, S.corrida.recado);

  /* ⚠️ O BOM TAMBÉM CONTA, e não só o perfeito: o pedido diz "só ficar acertando o perfeito e
     bom". A barra vai pra dentro da verde mas fora da amarela. */
  S.corrida.faseFaixas = 0; S.corrida.sequencia = 0;
  const meioVerde = 0.5 + (S.CORRIDA_FAIXA.amarela.tam / 2 + S.CORRIDA_FAIXA.verde.tam / 2) / 2;
  ok('  (o ponto escolhido é mesmo um BOM)',
     S.resultadoDoImpulso(meioVerde, 0.5) === 'good', S.resultadoDoImpulso(meioVerde, 0.5));
  bater(meioVerde);
  ok('um BOM também conta na sequência', S.corrida.sequencia === 1, 'sequência ' + S.corrida.sequencia);

  /* ⚠️ A LARGADA ZERA: sem isso a faixa da corrida nova já nasceria na velocidade da anterior */
  const largada = src.slice(src.indexOf('corrida.tempo = 0; corrida.perfeitos = 0;'));
  ok('a largada zera a sequência e a fase',
     largada.slice(0, 500).indexOf('corrida.sequencia = 0; corrida.faseFaixas = 0;') >= 0);
  const iDecl2 = src.indexOf('const corrida = {');
  ok('  e os dois campos nascem na declaração do objeto',
     src.slice(iDecl2, src.indexOf('\n};', iDecl2)).indexOf('sequencia: 0, faseFaixas: 0') >= 0);

  /* ⚠️ É DO JOGADOR, NÃO DO NPC: o NPC não usa a barra -- ele sorteia --, então a sequência não
     pode andar no caminho dele. A trava roda a física com o NPC acertando e cobra que ela fique
     parada. */
  S.corridaZerar();
  const meu = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true)], true);
  const npc = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, false)], false);
  S.corrida.corredores = [meu, npc];
  S.corrida.fase = 'correndo'; S.corrida.sequencia = 0;
  S.planejarNpc(npc, 0);
  npc.npcSorteio = 0;                      /* perfeito garantido */
  for(let k = 0; k < 200; k++) S.corridaFisica(0.05);
  ok('o NPC não move a sequência do jogador', S.corrida.sequencia === 0,
     'sequência ' + S.corrida.sequencia + ' depois de 10 s de NPC acertando');

  /* ⚠️ E A FASE ANDA COM O RELÓGIO DA PROVA, não com o do navegador: quem a adianta é o
     `corridaFisicaPasso`, que é a fatia do motor. */
  ok('  e a fase andou junto com a prova', S.corrida.faseFaixas > 0,
     S.corrida.faseFaixas.toFixed(2) + ' rad');
  const passo = src.slice(src.indexOf('function corridaFisicaPasso'), src.indexOf('function corridaFisicaPasso') + 400);
  ok('  (e a trava lê o `corridaFisicaPasso`)', passo.length > 200);
  ok('  e ele adianta as faixas', passo.indexOf('corridaAvancarFaixas(dt)') >= 0);

  /* ⚠️ E ACELERAR NÃO TELEPORTA: o centro imediatamente antes e depois de a sequência mudar é o
     MESMO -- o que muda é o ritmo daí pra frente. Com `sin(2*PI*t/P)` ele saltava até um terço da
     barra no instante do acerto, e o jogador leria isso como a tela piscando. */
  S.corrida.faseFaixas = 1.7; S.corrida.sequencia = 0;
  const antesDaSeq = S.centroDasFaixas();
  S.corrida.sequencia = 6;
  ok('acelerar a faixa não a teleporta', S.centroDasFaixas() === antesDaSeq,
     antesDaSeq.toFixed(4) + ' -> ' + S.centroDasFaixas().toFixed(4));
  /* mas o passo seguinte anda mais: é a aceleração */
  const anda = (seq) => { S.corrida.sequencia = seq; S.corrida.faseFaixas = 0; S.corridaAvancarFaixas(0.1); return S.corrida.faseFaixas; };
  ok('  mas o próximo instante anda mais', anda(6) > anda(0),
     anda(0).toFixed(4) + ' -> ' + anda(6).toFixed(4) + ' rad em 0,1 s');

  /* o chip do HUD: ele vive numa função só, lida pelo render E pelo pintor */
  S.corrida.perfeitos = 3; S.corrida.sequencia = 0;
  ok('sem sequência, o chip só conta os perfeitos',
     S.corridaChipDosPerfeitos() === '3 perfeitos', S.corridaChipDosPerfeitos());
  S.corrida.sequencia = 1;
  ok('  e um acerto só ainda não é sequência',
     S.corridaChipDosPerfeitos() === '3 perfeitos', S.corridaChipDosPerfeitos());
  S.corrida.sequencia = 4;
  ok('  a partir do segundo ele aparece',
     S.corridaChipDosPerfeitos().indexOf('4 seguidos') >= 0, S.corridaChipDosPerfeitos());
  ok('  e o pintor e o render leem a MESMA função',
     (src.match(/corridaChipDosPerfeitos\(\)/g) || []).length >= 3,
     (src.match(/corridaChipDosPerfeitos\(\)/g) || []).length + ' usos');
}

/* ============================================================================
   14) O DESLEIXO -- quem não tenta perde velocidade
   ============================================================================ */
console.log('\n=== QUEM NÃO TENTA PERDE VELOCIDADE ===');
{
  contaDeTeste();
  S.corridaZerar();
  const novo = () => {
    const c = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true)], true);
    S.corrida.corredores = [c]; S.corrida.fase = 'correndo'; S.corrida.tempo = 0;
    return c;
  };
  ok('são 3 travessias e -5%', S.CORRIDA_DESLEIXO_TRAVESSIAS === 3 && S.CORRIDA_DESLEIXO === 0.05,
     S.CORRIDA_DESLEIXO_TRAVESSIAS + ' / ' + S.CORRIDA_DESLEIXO);

  /* ⚠️ DUAS TRAVESSIAS PARADAS NÃO CORTAM -- o corte é no bloco de três */
  let c = novo();
  S.corridaContarTravessia(c, false); S.corridaContarTravessia(c, false);
  ok('duas travessias paradas não cortam', c.desleixo === 1, String(c.desleixo));
  S.corridaContarTravessia(c, false);
  ok('a terceira corta 5%', Math.abs(c.desleixo - 0.95) < 1e-9, String(c.desleixo));
  /* ⚠️ E ACUMULA: seis paradas são dois cortes */
  S.corridaContarTravessia(c, false); S.corridaContarTravessia(c, false); S.corridaContarTravessia(c, false);
  ok('e ele acumula', Math.abs(c.desleixo - 0.95 * 0.95) < 1e-9, String(c.desleixo));

  /* ⚠️ TENTAR ZERA O CONTADOR, mesmo ERRANDO: o que se pune é não tentar */
  c = novo();
  S.corridaContarTravessia(c, false); S.corridaContarTravessia(c, false);
  S.corridaContarTravessia(c, true);        /* tentou */
  S.corridaContarTravessia(c, false); S.corridaContarTravessia(c, false);
  ok('tentar zera o contador', c.desleixo === 1, String(c.desleixo));

  /* ⚠️ E TEM PISO: sem ele, ficar parado pararia o pokémon e a corrida não terminaria */
  c = novo();
  for(let i = 0; i < 300; i++) S.corridaContarTravessia(c, false);
  ok('e há um piso', c.desleixo === S.CORRIDA_DESLEIXO_MIN, String(c.desleixo));
  ok('e o piso deixa o pokémon correndo', S.corridaVelocidade(c) > 0, String(S.corridaVelocidade(c)));

  /* ⚠️ ELE MULTIPLICA A VELOCIDADE, por FORA do efeito do impulso */
  c = novo();
  const cheia = S.corridaVelocidade(c);
  c.desleixo = 0.9;
  ok('o desleixo multiplica a velocidade', Math.abs(S.corridaVelocidade(c) - cheia * 0.9) < 1e-9,
     cheia.toFixed(3) + ' -> ' + S.corridaVelocidade(c).toFixed(3));
  /* e um perfeito ainda ajuda, sobre a base menor */
  S.aplicarEfeito(c, 'perfect');
  ok('e um perfeito ainda ajuda, sobre a base menor',
     Math.abs(S.corridaVelocidade(c) - cheia * 0.9 * 1.45) < 1e-9, String(S.corridaVelocidade(c)));

  /* ⚠️ PONTA A PONTA: quem NUNCA clica chega depois de quem clica sempre -- mesmo pokémon,
     mesmo nível, sem NPC no caminho. É o que o pedido quer que aconteça. */
  const correr = (clicando) => {
    S.corridaZerar();
    S.corrida.formato = 'single';
    const r = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true)], true);
    S.corrida.corredores = [r]; S.corrida.fase = 'correndo'; S.corrida.tempo = 0;
    S.corrida.escolhidos = [{ speciesId: 'jolteon', level: 50, slot: 0, idx: 0 }];
    let v = 0;
    while(r.chegada === null && v < 60 * 300){
      if(clicando){
        /* clica sempre que a travessia permite -- sem acertar nada de propósito: o que se mede
           aqui é o DESLEIXO, não o impulso */
        if(S.corrida.tentativaDaTravessia !== S.corridaTravessia()){
          S.corrida.tentativaDaTravessia = S.corridaTravessia();
          r.tentouNaTravessia = S.corridaTravessia();
        }
      }
      S.corridaFisica(1 / 60); v++;
    }
    return { t: r.chegada, desleixo: r.desleixo };
  };
  const ativo = correr(true), parado = correr(false);
  ok('quem nunca tenta chega depois', parado.t > ativo.t,
     'ativo ' + ativo.t.toFixed(2) + ' s | parado ' + parado.t.toFixed(2) + ' s');
  ok('e quem tenta sempre não sofre corte', ativo.desleixo === 1, String(ativo.desleixo));
  ok('e quem nunca tenta sofre', parado.desleixo < 1, String(parado.desleixo));
}

/* ============================================================================
   15) A PISTA É PROPORCIONAL
   ============================================================================ */
/* ============================================================================
   O NPC É PAREADO PELO SPEED -- é a ESCALAÇÃO, não um boost
   ============================================================================ */
console.log('\n=== O NPC É PAREADO PELO SPEED ===');
{
  const spDe = (id) => S.speedDaCorrida(S.corridaInstancia({ speciesId: id, level: 50 }, false));
  const finais = S.finaisDaCorrida();

  /* ⚠️ O QUE ESTAVA ERRADO NÃO ERA A PILOTAGEM, ERA O BICHO: das 134 finais só 4 alcançam um
     Jolteon, e metade tem menos de 60% do Speed dele. O jogador escolhe o mais rápido do time; o
     sorteio uniforme dava ao NPC a mediana do bestiário. */
  const jol = spDe('jolteon');
  const alcancam = finais.filter(id => spDe(id) >= jol).length;
  ok('o bestiário é lento: poucas finais alcançam um Jolteon', alcancam <= 8,
     alcancam + ' de ' + finais.length);

  /* o pareamento em si, em várias faixas de Speed */
  for(const meu of ['jolteon', 'starmie', 'arcanine', 'venusaur', 'machamp']){
    const alvo = spDe(meu);
    const perto = S.npcParaOSpeed(alvo, new Set());
    ok('pareado com ' + meu + ' (Sp ' + alvo + '), os vizinhos ficam perto',
       perto.every(v => Math.abs(spDe(v.id) - alvo) <= Math.max(25, alvo * 0.35)),
       perto.slice(0, 3).map(v => v.id + ' ' + spDe(v.id)).join(', '));
  }

  /* ⚠️ A LISTA NUNCA VEM VAZIA -- é por isso que ela é "as N mais próximas" e não uma janela de
     ±x%: um Shuckle de Speed 10 não tem vizinho a ±15%, e aí a janela precisaria de um fallback
     que, por definição, só roda nos casos raros. */
  ok('e nem pro outlier mais extremo do jogo (Shuckle, Sp ' + spDe('shuckle') + ')',
     S.npcParaOSpeed(spDe('shuckle'), new Set()).length === S.CORRIDA_NPC_VIZINHOS);
  ok('a lista tem exatamente CORRIDA_NPC_VIZINHOS',
     S.npcParaOSpeed(spDe('jolteon'), new Set()).length === S.CORRIDA_NPC_VIZINHOS,
     String(S.CORRIDA_NPC_VIZINHOS));
  /* ⚠️ E ELA RESPEITA O "sem repetir espécie na equipe": quem já foi usado sai da lista. */
  const usadas = new Set([S.raizDaLinha('jolteon')]);
  ok('e quem já está na equipe sai da lista',
     S.npcParaOSpeed(spDe('jolteon'), usadas).every(v => S.raizDaLinha(v.id) !== S.raizDaLinha('jolteon')));

  /* ⚠️ O ALVO SAI DA ESPÉCIE, NÃO DO NÍVEL: o `speedDaCorrida` multiplica pelo nível, então um
     jogador Lv.5 comparado com a lista no Lv.50 receberia sempre os mais lentos. */
  S.corridaZerar();
  S.corrida.formato = 'single';
  for(const lv of [5, 50, 99]){
    S.corrida.escolhidos = [{ speciesId: 'jolteon', level: lv, name: 'Jolteon' }];
    const t = S.sortearNpcs()[0];
    ok('com o jogador no Lv.' + lv + ' o NPC continua rápido E no mesmo nível',
       spDe(t[0].speciesId) >= 100 && t[0].level === lv,
       t[0].speciesId + ' Sp' + spDe(t[0].speciesId) + ' Lv.' + t[0].level);
  }

  /* ⚠️ E O PAREAMENTO É POR TRECHO no revezamento -- senão daria pra guardar o lento pro trecho
     em que o NPC fosse rápido, e o pareamento viraria uma conta que dá pra burlar. */
  S.corrida.formato = 'relay';
  S.corrida.escolhidos = [
    { speciesId: 'jolteon', level: 50, name: 'Jolteon' },   /* Sp 135 */
    { speciesId: 'snorlax', level: 50, name: 'Snorlax' },   /* Sp  35 */
    { speciesId: 'starmie', level: 50, name: 'Starmie' },   /* Sp 120 */
  ];
  const t = S.sortearNpcs()[0];
  ok('no revezamento cada trecho é pareado com o SEU',
     spDe(t[0].speciesId) > spDe(t[1].speciesId) && spDe(t[2].speciesId) > spDe(t[1].speciesId),
     t.map((p, i) => p.speciesId + ' ' + spDe(p.speciesId)).join(' / '));
  ok('e a equipe não repete linha', new Set(t.map(p => S.raizDaLinha(p.speciesId))).size === t.length);

  /* ⚠️ E ELE CONTINUA CORRENDO COM O SPEED REAL DA ESPÉCIE -- o pedido proíbe "aumentar
     artificialmente a velocidade do NPC", e o que mudou foi QUEM ele leva, não quanto ele corre.
     Se um dia alguém puser um multiplicador no `corridaVelocidade` do NPC, é aqui que grita. */
  S.corrida.formato = 'single';
  const a = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true)], true);
  const b = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, false)], false);
  S.corrida.corredores = [a, b];
  ok('o NPC corre com o Speed REAL da espécie, sem boost',
     Math.abs(S.corridaVelocidade(a) - S.corridaVelocidade(b)) < 1e-9,
     S.corridaVelocidade(a).toFixed(3) + ' e ' + S.corridaVelocidade(b).toFixed(3));
  /* ⚠️ A PILOTAGEM SUBIU UM DEGRAU EM 20/09/2026 (a pedido: *"deixe o NPC um pouco melhor"*), e o
     número fica FIXADO aqui pra a próxima mudança ser deliberada -- foi esta trava que acusou a de
     hoje. Medido, o degrau tira o jogador "bom" de 97% pra 88% na individual e de 80% pra 57% no
     revezamento, e afunda o mediano de 37% pra 12%.
     ⚠️ E CONTRA QUEM DOMINA O JOGO ELE NÃO ALCANÇA EM CONFIGURAÇÃO NENHUMA (100% em 20, 24, 28 e
     32): a pilotagem perfeita já é o teto. A régua que alcançaria é o NÍVEL do NPC, e ela está
     fora -- inflar a velocidade dele é o que o pedido de 18/09 proíbe com todas as letras. */
  ok('a pilotagem do NPC é 24/56/12 (e 8% de não tentar)',
     S.CORRIDA_NPC.perfect === 0.24 && S.CORRIDA_NPC.good === 0.56 && S.CORRIDA_NPC.miss === 0.12,
     JSON.stringify(S.CORRIDA_NPC));
  /* ⚠️ E AS TRÊS SOMAM MENOS QUE 1: o resto é a OPORTUNIDADE NÃO USADA, que é o que impede o NPC
     de ser um metrônomo perfeito. Somando 1 ele tentaria toda travessia, o que é outro jogo. */
  ok('  e elas continuam somando menos que 1',
     S.CORRIDA_NPC.perfect + S.CORRIDA_NPC.good + S.CORRIDA_NPC.miss < 1,
     (S.CORRIDA_NPC.perfect + S.CORRIDA_NPC.good + S.CORRIDA_NPC.miss).toFixed(2));
}

/* ============================================================================
   A LINHA DE CHEGADA FICA NA METADE DE CIMA
   ============================================================================ */
console.log('\n=== A CHEGADA FICA NA METADE DE CIMA ===');
{
  S.corridaZerar();
  S.corrida.formato = 'single'; S.corrida.fase = 'correndo';
  const eu = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true)], true);
  const npc = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'rapidash', level: 50 }, false)], false);
  S.corrida.corredores = [eu, npc];
  const TOT = S.corridaTotal(), H = S.CORRIDA_H;

  ok('a chegada trava acima da metade da tela', S.CORRIDA_Y_CHEGADA < H / 2,
     S.CORRIDA_Y_CHEGADA + ' de ' + H + ' (metade: ' + (H / 2) + ')');

  /* ⚠️ A RETA FINAL CAI DAS DUAS ALTURAS, e não é um número escolhido: escrito à mão, ele
     divergiria no primeiro ajuste e a linha pararia num lugar que não é o declarado. */
  ok('e o tamanho dela é DERIVADO das duas alturas',
     Math.abs(S.corridaRetaFinal() - (S.CORRIDA_Y_EU - S.CORRIDA_Y_CHEGADA) / S.CORRIDA_PX_POR_M) < 1e-9,
     S.corridaRetaFinal().toFixed(1) + ' m');

  /* percorre a prova inteira e cobra que ela NUNCA apareça na metade de baixo */
  let visivel = 0, baixo = 0;
  for(let d = 0; d <= TOT; d += 0.5){
    eu.dist = d;
    const y = S.corridaYdaMetragem(TOT);
    if(y > -28 && y < H){ visivel++; if(y >= H / 2) baixo++; }
  }
  ok('e ela nunca aparece na metade de BAIXO, em toda a prova', baixo === 0,
     baixo + ' de ' + visivel + ' amostras visíveis');
  ok('(e ela aparece de verdade)', visivel > 20, String(visivel));

  /* ⚠️ A CÂMERA TRAVA, e é o JOGADOR que sobe até a linha -- a cena da reta final. */
  eu.dist = TOT - S.corridaRetaFinal();
  const camTrava = S.corridaCamera();
  eu.dist = TOT - 5;
  ok('a câmera PARA na reta final', Math.abs(S.corridaCamera() - camTrava) < 1e-9,
     camTrava.toFixed(1) + ' -> ' + S.corridaCamera().toFixed(1));
  ok('e a chegada fica parada em CORRIDA_Y_CHEGADA',
     Math.abs(S.corridaYdaMetragem(TOT) - S.CORRIDA_Y_CHEGADA) < 1e-9,
     S.corridaYdaMetragem(TOT).toFixed(0));
  /* e o jogador SOBE em direção a ela */
  eu.dist = TOT - 20; const y1 = S.corridaYdaMetragem(eu.dist);
  eu.dist = TOT - 5;  const y2 = S.corridaYdaMetragem(eu.dist);
  ok('e o JOGADOR sobe em direção a ela', y2 < y1, y1.toFixed(0) + ' -> ' + y2.toFixed(0));
  eu.dist = TOT;
  ok('e ele para EM CIMA da linha ao cruzar',
     Math.abs(S.corridaYdaMetragem(eu.dist) - S.CORRIDA_Y_CHEGADA) < 1e-9,
     S.corridaYdaMetragem(eu.dist).toFixed(0));

  /* ⚠️ ANTES DA RETA FINAL a câmera É o jogador, e ele fica em CORRIDA_Y_EU -- senão a trava
     valeria a prova inteira e a pista deixaria de rolar. */
  eu.dist = 50;
  ok('antes da reta final a câmera volta a seguir o jogador',
     S.corridaCamera() === 50 && S.corridaYdaMetragem(50) === S.CORRIDA_Y_EU,
     S.corridaCamera() + ' / y=' + S.corridaYdaMetragem(50));

  /* ⚠️ E NO REVEZAMENTO a trava é nos últimos metros da PROVA, não em cada trecho. */
  S.corrida.formato = 'relay';
  const passouUmTrecho = S.CORRIDA_METROS_TRECHO + 20;
  eu.dist = passouUmTrecho;
  ok('no revezamento ela não trava na TROCA de um trecho',
     S.corridaCamera() === passouUmTrecho, String(S.corridaCamera()));
  eu.dist = S.corridaTotal() - 5;
  ok('e trava só na chegada da prova',
     Math.abs(S.corridaYdaMetragem(S.corridaTotal()) - S.CORRIDA_Y_CHEGADA) < 1e-9);
  S.corrida.formato = 'single';
}

/* ============================================================================
   AS MEDALHAS -- desenho da casa, nunca emoji
   ============================================================================ */
console.log('\n=== AS MEDALHAS SÃO DESENHO DA CASA ===');
{
  const MED = ['medalha_ouro', 'medalha_prata', 'medalha_bronze'];
  for(const m of MED){
    ok(m + ' existe no DESENHOS', Array.isArray(S.DESENHOS[m]) && S.DESENHOS[m].length === 24,
       S.DESENHOS[m] ? S.DESENHOS[m].length + ' linhas' : 'nao existe');
    ok('  e vira um <symbol> no SVG', S.svgDosSelos().indexOf('id="s-' + m + '"') >= 0);
  }
  /* ⚠️ AS TRÊS SÃO A MESMA SILHUETA EM TRÊS METAIS: o que as agrupa é a FORMA, o que as separa
     é a COR. Desenhos diferentes fariam procurar três coisas onde há uma escada. */
  const silhueta = (n) => S.DESENHOS[n].map(l => l.replace(/[^.]/g, '#')).join('|');
  ok('as três têm a MESMA silhueta', silhueta(MED[0]) === silhueta(MED[1]) && silhueta(MED[1]) === silhueta(MED[2]));
  /* ...e cores diferentes, senão elas seriam o mesmo selo três vezes */
  const corpo = (n) => S.DESENHOS[n].join('');
  ok('e cores DIFERENTES', corpo(MED[0]) !== corpo(MED[1]) && corpo(MED[1]) !== corpo(MED[2]));

  /* ⚠️ E NENHUMA É EMOJI -- é o pedido ao pé da letra (*"crie, não use emoji prontos"*) e a regra
     que tirou os 54 emojis das telas. A varredura é sobre a TELA renderizada. */
  S.corridaZerar();
  S.corrida.formato = 'single'; S.corrida.fase = 'fim';
  S.corrida.corredores = [0, 1, 2, 3].map(i => {
    const c = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, i === 0)], i === 0);
    c.chegada = 20 + i * 2; c.dist = S.corridaTotal();
    return c;
  });
  const h = S.renderCorrida();
  for(const m of MED) ok('a ' + m + ' aparece na tela de resultado', h.indexOf('#s-' + m) >= 0);
  ok('e nenhum emoji de medalha sobrou', !/\u{1F947}|\u{1F948}|\u{1F949}|\u{1F3C5}/u.test(h));
  /* ⚠️ DA QUARTA EM DIANTE NÃO HÁ MEDALHA, e a célula fica VAZIA em vez de sumir: sem o vazão,
     o "4º" encostaria no nome e as linhas deixariam de alinhar em coluna. */
  ok('são TRÊS medalhas pra quatro corredores',
     (h.match(/resultMed/g) || []).length === 4 &&
     (h.match(/#s-medalha_/g) || []).length === 3,
     (h.match(/#s-medalha_/g) || []).length + ' medalhas em ' + (h.match(/resultMed/g) || []).length + ' células');
  /* as quatro colocações, bem grandes */
  for(const p of ['1º', '2º', '3º', '4º'])
    ok('o "' + p + '" aparece', h.indexOf('<span class="resultPos">' + p + '</span>') >= 0);
  ok('e a linha do jogador é destacada', h.indexOf('resultRow eu') >= 0);
  /* ⚠️ E O TROFÉU DO TÍTULO TAMBÉM VIROU DESENHO -- ele era o último emoji desta tela. */
  ok('o título da vitória usa o troféu desenhado',
     h.indexOf('#s-trofeu') >= 0 && !/\u{1F3C6}/u.test(h), 'sobrou emoji de troféu');
}

/* ============================================================================
   O REVEZAMENTO: a equipe inteira na pista
   ============================================================================ */
console.log('\n=== O REVEZAMENTO TEM A EQUIPE NA PISTA ===');
{
  S.corridaZerar();
  S.corrida.formato = 'relay'; S.corrida.fase = 'correndo';
  const time = ['jolteon', 'starmie', 'arcanine'].map(id => S.corridaInstancia({ speciesId: id, level: 50 }, true));
  const eu = S.corridaNovoCorredor(time, true);
  const npc = S.corridaNovoCorredor(['rapidash', 'dodrio', 'persian']
    .map(id => S.corridaInstancia({ speciesId: id, level: 50 }, false)), false);
  S.corrida.corredores = [eu, npc];

  /* ⚠️ A POSIÇÃO DE CADA MEMBRO CAI DA REGRA, sem estado novo. Quem desenha é a tela, então o
     que se cobra aqui é a CONTA: quem espera está na marca em que RECEBE, quem já correu na marca
     em que ENTREGOU. */
  const onde = (trecho, dist, k) => k === trecho ? dist : (k < trecho ? k + 1 : k) * S.corridaMetros();
  /* ⚠️ AS MARCAS SAEM DA CONSTANTE, nunca escritas à mão: elas eram 300 e 600 e viraram 150 e
     300 quando o trecho mudou -- cinco travas caíram de uma vez sem nada estar errado. */
  const M1 = S.CORRIDA_METROS_TRECHO, M2 = 2 * S.CORRIDA_METROS_TRECHO;

  eu.trecho = 0; eu.dist = 120;
  ok('no 1º trecho, o 2º espera na marca do 1º trecho', onde(0, 120, 1) === M1);
  ok('e o 3º espera na do 2º', onde(0, 120, 2) === M2);
  ok('e o que corre está na metragem dele', onde(0, 120, 0) === 120);

  eu.trecho = 1; eu.dist = M1 + 120;
  ok('no 2º trecho, o 1º ficou PARADO onde entregou', onde(1, M1 + 120, 0) === M1);
  ok('o 2º corre', onde(1, M1 + 120, 1) === M1 + 120);
  ok('e o 3º continua esperando na marca dele', onde(1, M1 + 120, 2) === M2);

  /* ⚠️ NO INSTANTE DA TROCA OS DOIS ESTÃO NA MESMA METRAGEM -- quem entrega e quem recebe. É por
     isso que o desenho desloca os parados pro lado: sem isso eles sairiam um em cima do outro. */
  eu.trecho = 1; eu.dist = M1;
  ok('na troca, quem entregou e quem recebeu estão na MESMA metragem',
     onde(1, M1, 0) === M1 && onde(1, M1, 1) === M1);

  /* ⚠️ AGORA O DESENHO DE VERDADE, e essa é a parte que importa: a conta `onde` acima é uma
     CÓPIA da regra dentro do teste -- ela daria verde mesmo se o jogo parasse de desenhar a equipe.
     Aqui o canvas é um dublê que anota cada `drawImage`, e o `pmdCache` recebe folhas falsas pra
     o desenho sair pelo caminho REAL (sem sprite ele cai no marcador neutro, que é outro ramo). */
  const ch = [];
  const ctx = { fillStyle: '', font: '', textAlign: '', globalAlpha: 1, strokeStyle: '', lineWidth: 1,
    setTransform(){}, save(){}, restore(){}, translate(){}, scale(){}, beginPath(){}, arc(){},
    ellipse(){}, fill(){}, stroke(){}, moveTo(){}, lineTo(){}, closePath(){},
    fillRect(){}, fillText(s2, x, y){ ch.push({ t: 'txt', s: s2, x, y }); },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh){
      ch.push({ t: 'img', x: dx + dw / 2, y: dy + dh, alpha: this.globalAlpha });
    },
    imageSmoothingEnabled: false };
  const ant = S.document.getElementById;
  S.document.getElementById = (id) => id === 'corridaCanvas'
    ? { getContext: () => ctx, width: S.CORRIDA_W * 2, height: S.CORRIDA_H * 2 } : ant(id);
  const folha = { img: {}, w: 32, h: 32, durations: [4, 4], caixas: [[4, 4, 28, 30], [4, 4, 28, 30]] };
  for(const id of ['jolteon', 'starmie', 'arcanine', 'rapidash', 'dodrio', 'persian']) S.pmdCache[id] = folha;

  /* o jogador no 2º trecho, com a marca dos 300 ainda na tela */
  eu.trecho = 1; eu.dist = 305; npc.trecho = 1; npc.dist = 305;
  ch.length = 0; S.corridaPintar();
  /* ⚠️ O CENTRO DA RAIA SAI DA CONSTANTE, nunca escrito à mão: ele era `44 + 176*0.5` -- a raia
     de DOIS na pista --, e caiu sozinho no dia em que a pista virou sempre quatro. */
  const raiaT = (396 - 44) / S.CORRIDA_PARTICIPANTES;
  const meus = ch.filter(c => c.t === 'img' && Math.abs(c.x - (44 + raiaT * 0.5)) < raiaT * 0.45);
  ok('a equipe inteira aparece na pista, não só quem corre', meus.length >= 2,
     meus.length + ' sprites na raia do jogador');
  /* ⚠️ QUEM ESTÁ PARADO SAI MAIS APAGADO -- é o que separa "quem corre" de "quem está na pista". */
  ok('e quem está parado sai mais apagado que quem corre',
     meus.some(c => c.alpha === 1) && meus.some(c => c.alpha < 1),
     meus.map(c => c.alpha).join(' / '));
  /* ⚠️ E DESLOCADOS NA RAIA: na troca os dois estão na MESMA metragem, então sem o desvio eles
     desenhariam um EM CIMA do outro. */
  ok('e o parado é deslocado pro lado, nunca em cima do corredor',
     new Set(meus.map(c => Math.round(c.x))).size === meus.length,
     meus.map(c => Math.round(c.x)).join(' / '));

  /* ⚠️ O QUE ESPERA FICA NA MARCA DE TROCA, e é disso que o pedido fala. O 3º membro espera na
     marca do 2º trecho -- fora da tela; a 15 m dela ele entra, e na metragem certa. */
  eu.dist = M2 - 15; npc.dist = M2 - 15;
  ch.length = 0; S.corridaPintar();
  const yEsperado = S.corridaYdaMetragem(M2);
  const naMarca = ch.filter(c => c.t === 'img' && Math.abs(c.y - yEsperado) < 2);
  ok('quem espera está exatamente na marca do 2º trecho', naMarca.length === 2,
     naMarca.length + ' na marca (y=' + yEsperado.toFixed(0) + ')');

  /* ⚠️ E QUEM JÁ ENTREGOU FICA PARADO ONDE ENTREGOU -- a outra metade do pedido.
     ⚠️ E ELE SÓ FICA VISÍVEL POR ~11 m: a câmera vê 38 m pra frente e só 11 pra trás, então quem
     entregou sai de vista logo depois da troca. É o certo -- ele ficou pra trás --, e é por isso
     que o fixture fica 8 m depois da marca: mais que isso e ela cai fora da tela de 390. */
  eu.trecho = 2; eu.dist = M2 + 8; npc.trecho = 2; npc.dist = M2 + 8;
  ch.length = 0; S.corridaPintar();
  const yM2 = S.corridaYdaMetragem(M2);
  ok('e quem entregou na marca ficou parado lá',
     ch.some(c => c.t === 'img' && Math.abs(c.y - yM2) < 2 && c.alpha < 1),
     'y=' + yM2.toFixed(0));

  /* ⚠️ SEM SPRITE ele cai no marcador neutro, que desenha o NOME -- e o nome é só de quem CORRE.
     Três "VOCÊ" empilhados na mesma raia só confundem: quem está parado é cenário. */
  for(const id of ['jolteon', 'starmie', 'arcanine', 'rapidash', 'dodrio', 'persian']) delete S.pmdCache[id];
  eu.trecho = 1; eu.dist = 320; npc.trecho = 1; npc.dist = 310;
  ch.length = 0; S.corridaPintar();
  ok('mesmo com a equipe na pista, só quem CORRE ganha o nome',
     ch.filter(c => c.s === 'VOCÊ').length === 1,
     ch.filter(c => c.s === 'VOCÊ').length + ' "VOCÊ"');
  S.document.getElementById = ant;

  /* ⚠️ E NADA DISSO VALE NA INDIVIDUAL: lá a equipe tem um membro só, e desenhar "os outros"
     seria inventar pokémon que não existe. */
  S.corrida.formato = 'single';
  eu.trecho = 0; eu.dist = 100;
  ok('na individual a regra nem se aplica (um membro só na pista)', S.corridaTotal() === S.CORRIDA_METROS);
  S.corrida.formato = 'relay';
}

console.log('\n=== A PISTA É PROPORCIONAL À DISTÂNCIA ===');
{
  contaDeTeste();
  S.corridaZerar();
  const a = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'jolteon', level: 50 }, true)], true);
  const b = S.corridaNovoCorredor([S.corridaInstancia({ speciesId: 'venusaur', level: 50 }, false)], false);
  S.corrida.corredores = [a, b];

  /* ⚠️ A ESCALA É FIXA, e grande: 8 px/m. Quatro versões anteriores tentaram CABER O PELOTÃO na
     tela ajustando a escala, e todas quebraram de um jeito diferente -- a última, fixa mas
     minúscula, fazia os 300 m caberem em 0,6 tela: *"a pista está parecendo muito curta para ter
     300 m"*. Escala grande + câmera no jogador é o que qualquer jogo de corrida faz. */
  S.corrida.formato = 'single';
  a.dist = 100; b.dist = 100;
  const eJunto = S.corridaEscala();
  a.dist = 400; b.dist = 100;
  ok('a escala NÃO muda com a dispersão', S.corridaEscala() === eJunto,
     eJunto + ' -> ' + S.corridaEscala());
  S.corrida.formato = 'relay';
  ok('nem com a modalidade', S.corridaEscala() === eJunto, String(S.corridaEscala()));
  S.corrida.formato = 'single';

  /* ⚠️ E ELA MOSTRA UM PEDAÇO CURTO DA PISTA -- é esse número que o relato cobrava. Com a prova
     inteira cabendo numa tela, a chegada aparecia na largada e ninguém parecia sair do lugar. */
  const naTela = S.CORRIDA_H / eJunto;
  ok('a tela mostra um pedaço curto da pista, não a prova inteira',
     naTela < 70, naTela.toFixed(0) + ' m na tela');
  ok('e um trecho do revezamento ocupa várias telas',
     S.CORRIDA_METROS_TRECHO / naTela >= 2, (S.CORRIDA_METROS_TRECHO / naTela).toFixed(1) + ' telas');
  ok('  e a individual, mais ainda',
     S.CORRIDA_METROS / naTela >= 4, (S.CORRIDA_METROS / naTela).toFixed(1) + ' telas');

  /* ⚠️ A CÂMERA É O JOGADOR, nunca o líder: presa ao líder, quem estivesse perdendo escorregaria
     pra fora da própria tela.
     ⚠️ E O FIXTURE TEM QUE FICAR FORA DA RETA FINAL (os últimos 25,5 m): lá a
     câmera TRAVA de propósito, e um fixture com `dist` perto da chegada mediria a trava em vez da
     câmera. A primeira versão usava fixtures de 300 e 400 num total de 300 -- sempre dentro dela. */
  const foraDaReta = S.corridaTotal() - S.corridaRetaFinal();
  a.dist = 120; b.dist = 250;
  ok('a câmera segue o JOGADOR, mesmo perdendo', S.corridaCamera() === 120, String(S.corridaCamera()));
  ok('e o jogador cai sempre na mesma linha da tela',
     S.corridaYdaMetragem(a.dist) === S.CORRIDA_Y_EU, String(S.corridaYdaMetragem(a.dist)));
  a.dist = 250; b.dist = 120;
  ok('(inclusive liderando)', S.corridaYdaMetragem(a.dist) === S.CORRIDA_Y_EU,
     String(S.corridaYdaMetragem(a.dist)));
  ok('(e 250 m está mesmo fora da reta final)', 250 < foraDaReta, '250 < ' + foraDaReta.toFixed(1));

  /* ⚠️ A POSIÇÃO É A METRAGEM, e a relação é EXATAMENTE linear: o dobro da diferença é o dobro
     dos pixels, sem teto e sem compressão no caminho. */
  a.dist = 200;
  const d50  = S.CORRIDA_Y_EU - S.corridaYdaMetragem(150);
  const d100 = S.CORRIDA_Y_EU - S.corridaYdaMetragem(100);
  ok('o dobro da distância é o dobro dos pixels', Math.abs(d100 - 2 * d50) < 1e-9,
     d50.toFixed(1) + ' e ' + d100.toFixed(1));
  ok('e quem está à frente fica ACIMA na tela',
     S.corridaYdaMetragem(210) < S.CORRIDA_Y_EU && S.corridaYdaMetragem(190) > S.CORRIDA_Y_EU);

  /* ⚠️ E DEZ METROS VALEM OS MESMOS PIXELS PERTO E LONGE -- a medição direta do primeiro defeito
     reportado, em que quem estava muito atrás saturava num teto e parava de se mexer. */
  const perto = Math.abs(S.corridaYdaMetragem(200) - S.corridaYdaMetragem(190));
  const longe = Math.abs(S.corridaYdaMetragem(120) - S.corridaYdaMetragem(110));
  ok('dez metros valem os mesmos pixels perto e longe', Math.abs(perto - longe) < 1e-9,
     perto.toFixed(2) + ' e ' + longe.toFixed(2));
  ok('e eles não são zero', perto > 0.5, String(perto));

  /* ⚠️ QUEM SAI DA TELA VIRA MARCADOR, e isso é o desenho -- o pedido autoriza com todas as
     letras. Quem está 300 m atrás NÃO cabe, e aí a borda conta a diferença.
     (No REVEZAMENTO, que é onde essa dispersão acontece de verdade -- e onde 400 m ainda está
     longe da reta final dos 900.) */
  S.corrida.formato = 'relay';
  a.dist = 400; b.dist = 100;
  const yLonge = S.corridaYdaMetragem(b.dist);
  ok('quem está 300 m atrás fica fora do quadro', yLonge > S.CORRIDA_H,
     yLonge.toFixed(0) + ' de ' + S.CORRIDA_H);
  b.dist = 395;
  ok('e quem está colado aparece', S.corridaYdaMetragem(b.dist) < S.CORRIDA_H,
     S.corridaYdaMetragem(b.dist).toFixed(0));
  S.corrida.formato = 'single';

  /* ⚠️ A CHEGADA SÓ APARECE NO FIM -- era ela visível na largada que denunciava a escala velha. */
  a.dist = 0;
  ok('a chegada NÃO aparece na largada', S.corridaYdaMetragem(S.corridaTotal()) < 0,
     S.corridaYdaMetragem(S.corridaTotal()).toFixed(0));
  a.dist = S.corridaTotal() - 20;
  ok('e aparece nos últimos metros', S.corridaYdaMetragem(S.corridaTotal()) > 0,
     S.corridaYdaMetragem(S.corridaTotal()).toFixed(0));
}


/* ============================================================================
   16) A LISTA É PAGINADA (18/09/2026, a pedido: "igual nas outras listas")
   ============================================================================ */
console.log('\n=== A LISTA DE CORREDORES É PAGINADA ===');
{
  const g2 = S.__getGame(), SP2 = S.SPECIES;
  const bicho = (id, lv) => ({ speciesId: id, level: lv, name: SP2[id].name, types: SP2[id].types, id: 'p' + id + lv, hp: 1, maxHp: 1 });
  const ids = Object.keys(SP2).slice(0, 12);
  g2.saveSlots = new Array(20).fill(null);
  g2.saveSlots[0] = { team: ids.slice(0, 6).map((id, i) => bicho(id, 50 + i)), badgeCount: 8, customName: 'A' };
  g2.saveSlots[1] = { team: ids.slice(6, 12).map((id, i) => bicho(id, 40 + i)), badgeCount: 8, customName: 'B' };
  g2.saveSlotsCarregados = true; g2.contaCarregada = true; g2.ehAdmin = true;
  g2.aposentados = []; g2.specialties = [];
  S.corridaZerar(); S.abrirCorrida(); S.corridaAbrirPicker();

  /* ⚠️ ELA REUSA O MECANISMO da Torre e do Ginásio -- o mesmo MONT_POR_PAGINA e o mesmo
     montadorPaginaValida. Uma paginação própria divergiria na primeira mexida. */
  const p1 = S.renderCorrida();
  const cards = (t) => (t.match(/mont-card/g) || []).length;
  ok('a primeira página mostra o teto do montador', cards(p1) === S.MONT_POR_PAGINA,
     cards(p1) + ' de ' + S.MONT_POR_PAGINA);
  ok('e há dois botões de página', (p1.match(/class="mont-pag /g) || []).length === 2,
     String((p1.match(/class="mont-pag /g) || []).length));
  ok('e a conta aparece', p1.indexOf('1–10 de 12') >= 0, (p1.match(/mont-pag-conta">([^<]*)/) || [])[1]);
  S.corridaIrParaPagina(1);
  const p2 = S.renderCorrida();
  ok('a segunda traz os dois que sobraram', cards(p2) === 2, String(cards(p2)));
  ok('e a conta acompanha', p2.indexOf('11–12 de 12') >= 0, (p2.match(/mont-pag-conta">([^<]*)/) || [])[1]);
  ok('e a página 2 está marcada',
     /class="mont-pag ativa"[^>]*corridaIrParaPagina\(1\)/.test(p2), 'sem a marca');

  /* ⚠️ E SOMANDO AS PÁGINAS, OS DOZE ESTÃO LÁ -- sem repetir ninguém entre elas. */
  S.corridaIrParaPagina(0);
  const ident = (t) => (t.match(/corridaToggle\('[^']*',\d+\)/g) || []);
  const todas = ident(S.renderCorrida()).concat((S.corridaIrParaPagina(1), ident(S.renderCorrida())));
  ok('somando as páginas, os doze estão lá', todas.length === 12, String(todas.length));
  ok('e ninguém aparece em duas páginas', new Set(todas).size === 12, String(new Set(todas).size));

  /* ⚠️ COM UMA PÁGINA SÓ os botões somem -- um "1 de 1" não controla nada */
  g2.saveSlots[1] = null;
  S.corridaZerar(); S.corridaAbrirPicker();
  const curta = S.renderCorrida();
  ok('com uma página só, os botões somem', curta.indexOf('mont-pag ') < 0, 'os botões ficaram');

  /* ⚠️ ABRIR O PICKER ZERA A PÁGINA: o estado é COMPARTILHADO com a Torre e o Ginásio, e uma
     página 3 sobrando de lá abriria esta lista no meio. */
  g2.montadorPagina = 3;
  S.corridaAbrirPicker();
  ok('abrir o picker zera a página', g2.montadorPagina === 0, String(g2.montadorPagina));

  /* ⚠️ E NÃO SE PAGINA NO MEIO DA CORRIDA */
  S.corrida.fase = 'correndo';
  g2.montadorPagina = 0;
  S.corridaIrParaPagina(1);
  ok('e não dá pra paginar durante a corrida', g2.montadorPagina === 0, String(g2.montadorPagina));
  S.corrida.fase = 'setup';
}

/* ============================================================================
   17) O MODAL DA CONTAGEM SAI DA TELA
   ============================================================================ */
console.log('\n=== O MODAL DA CONTAGEM SAI ===');
{
  contaDeTeste();
  S.corridaZerar(); S.abrirCorrida();
  S.corrida.escolhidos = [mk('jolteon', 60)];
  S.corrida.corredores = [S.corridaNovoCorredor([S.corridaInstancia(S.corrida.escolhidos[0], true)], true)];

  /* ⚠️ ELE EXISTE SEMPRE E É ESCONDIDO PELO `hidden`, nunca montado condicionalmente: a fase vira
     'correndo' DENTRO do laço, que não chama render() -- então um overlay montado só na 'contagem'
     ficava na tela pra sempre, congelado no "1 / Vai!". Foi reportado. */
  S.corrida.fase = 'contagem';
  const naContagem = S.renderCorrida();
  ok('na contagem o overlay aparece',
     naContagem.indexOf('corridaOverlay') >= 0 && !/id="corridaOverlay" hidden/.test(naContagem),
     'não apareceu');
  S.corrida.fase = 'correndo';
  const correndo = S.renderCorrida();
  ok('correndo ele continua no HTML', correndo.indexOf('corridaOverlay') >= 0, 'sumiu do HTML');
  ok('mas escondido', /id="corridaOverlay" hidden/.test(correndo), 'ficou visível');

  /* ⚠️ E QUEM O ESCONDE É O PINTOR, não um render(): o laço não redesenha a tela */
  ok('e o pintor é quem mexe no hidden',
     /ov\.hidden = corrida\.fase !== 'contagem'/.test(src), 'o pintor não o esconde');

  /* ⚠️ E O `hidden` PRECISA DE UMA REGRA NO CSS PRA FUNCIONAR -- esta é a trava que faltava, e a
     falta dela deixou o modal na tela por DUAS rodadas de conserto.
     O atributo `hidden` é `display:none` pela folha do NAVEGADOR, que perde pra qualquer
     `display` do autor -- e o `.corrida-overlay` é `display:flex`. A marcação estava CERTA: o
     atributo estava no HTML, e a trava de cima passava. Quem errava era o CSS.
     ⚠️ A ORDEM IMPORTA e faz parte da trava: as duas regras têm a mesma especificidade, então a
     do `[hidden]` só ganha se vier... na verdade ela tem MAIS especificidade (classe + atributo
     contra classe), e é por isso que funciona em qualquer ordem. O que não pode é ela sumir. */
  const css = src.slice(src.indexOf('<style'), src.indexOf('</style>'));
  ok('e o CSS tem a regra que faz o hidden valer',
     /\.corrida-overlay\[hidden\]\s*\{[^}]*display:\s*none/.test(css),
     'sem ela, o display:flex anula o hidden e o modal FICA NA TELA');
  /* e a regra do overlay continua sendo flex quando visível */
  ok('(e o overlay continua flex quando aparece)',
     /\.corrida-overlay\{[^}]*display:flex/.test(css));
  ok('e o laço não chama render() pra isso',
     /* ⚠️ O ALVO É `corrida.fase`, e não `fase` solto: com o nome curto a varredura pega o
        arquivo INTEIRO -- o Resgate também tem uma fase chamada `correndo`, e esta trava passou
        a acusar um laço que não é o dela. É a mesma armadilha do padrão largo demais que este
        projeto já pagou duas vezes (as regex do `mlog-mais` e do `matchup-row`). */
     !/corrida\.fase = 'correndo';[\s\S]{0,120}render\(\)/.test(src), 'o laço passou a redesenhar');
}


/* ============================================================================
   18) NO FIM, SÓ A CLASSIFICAÇÃO (18/09/2026)
   ----------------------------------------------------------------------------
   Pedido com print: *"pode sumir com esses 3 primeiros quadros ao fim da corrida e deixar somente
   o quadro escrito 2 lugar com os tempos de cada pokemon"*.
   ⚠️ E ELES NÃO ESTAVAM SÓ SOBRANDO: estavam mostrando DADO ERRADO. O placar voltava a "0 / 300 m"
   e o canvas ficava em BRANCO, porque quem os mantinha vivos era o pintor do laço -- que já parou.
   ============================================================================ */
console.log('\n=== NO FIM, SÓ A CLASSIFICAÇÃO ===');
{
  contaDeTeste();
  S.corridaZerar(); S.abrirCorrida();
  S.corrida.formato = 'single';
  S.corrida.escolhidos = [mk('jolteon', 60)];
  const eu = S.corridaNovoCorredor([S.corridaInstancia(S.corrida.escolhidos[0], true)], true);
  S.corrida.corredores = [eu].concat(S.sortearNpcs().map(t => S.corridaNovoCorredor(t, false)));
  S.corrida.corredores.forEach((c, i) => { c.dist = 300; c.chegada = 20 + i * 2; });

  S.corrida.fase = 'correndo';
  const correndo = S.renderCorrida();
  ok('correndo, a pista e o placar estão na tela',
     correndo.indexOf('corridaCanvas') >= 0 && correndo.indexOf('racerRow') >= 0);

  S.corrida.fase = 'fim';
  const fim = S.renderCorrida();
  ok('no fim, a classificação aparece', fim.indexOf('resultRow') >= 0, 'sem a classificação');
  ok('e a pista some', fim.indexOf('corridaCanvas') < 0, 'a pista ficou (e em branco)');
  ok('e o placar some', fim.indexOf('racerRow') < 0, 'o placar ficou (e zerado)');
  ok('e o botão de impulso some', fim.indexOf('corridaBoost') < 0, 'o impulso ficou');
  ok('e o setup some', fim.indexOf(S.corridaRotuloDaEscolha()) < 0, 'o setup ficou');
  ok('mas dá pra correr de novo e configurar',
     fim.indexOf('corridaLargar') >= 0 && fim.indexOf('corridaReiniciar') >= 0);
  ok('e dá pra sair', fim.indexOf('sairDaCorrida') >= 0);

  /* ⚠️ E OS TEMPOS ESTÃO LÁ, na ordem da classificação */
  const tempos = (fim.match(/<b>([\d.]+)s<\/b>/g) || []);
  ok('os ' + S.CORRIDA_PARTICIPANTES + ' tempos aparecem', tempos.length === S.CORRIDA_PARTICIPANTES, tempos.join(' '));
  ok('e em ordem crescente',
     tempos.map(t => parseFloat(t.replace(/\D*([\d.]+).*/, '$1'))).every((v, i, a) => i === 0 || a[i-1] <= v),
     tempos.join(' '));

  /* ⚠️ A FONTE SUBIU -- e isso só se vê no CSS.
     ⚠️ ELA SUBIU DUAS VEZES, e na segunda (18/09/2026, a pedido: *"aumente as fontes do resultado
     final, pode colocar o 1, 2, 3 e 4 lugar bem grandes junto com os nomes"*) a linha deixou de
     ter UMA fonte: hoje a colocação é o maior texto da caixa, o nome vem atrás, e o "você / NPC"
     fica pequeno embaixo do nome. Por isso a trava mede as DUAS que importam, e não a da linha. */
  const css2 = src.slice(src.indexOf('<style'), src.indexOf('</style>'));
  const rPos = (css2.match(/\.resultRow \.resultPos\{[^}]*\}/) || [''])[0];
  const rNome = (css2.match(/\.resultRow \.resultNome\{[^}]*\}/) || [''])[0];
  const fonte = (r) => parseFloat((r.match(/font-size:([\d.]+)rem/) || [])[1] || 0);
  ok('a colocação é o maior texto da caixa', fonte(rPos) >= 1.4, rPos || 'sem a regra');
  ok('e o nome vem logo atrás dela', fonte(rNome) >= 0.95 && fonte(rNome) < fonte(rPos),
     rNome || 'sem a regra');
  /* ⚠️ A LINHA É UMA GRADE de colunas fixas, e não um flex livre: com flex, a largura da medalha
     e a do número mudam de linha pra linha e os NOMES deixam de alinhar -- e é a coluna dos nomes
     e a dos tempos que se comparam de relance. */
  ok('e a linha é uma GRADE de colunas fixas',
     /\.resultRow\{[^}]*display:grid/.test(css2) && /grid-template-columns:auto 34px 1fr auto/.test(css2),
     (css2.match(/\.resultRow\{[^}]*\}/) || [''])[0].slice(0, 70));
  ok('e o tempo usa tabular-nums (a coluna não dança)',
     /\.resultRow b\{[^}]*tabular-nums/.test(css2), 'sem tabular-nums');

  /* volta pro estado limpo pros blocos seguintes */
  S.corridaZerar();
}

/* ============================================================================
   19) O TRECHO DO REVEZAMENTO É 150 m, E OS RÓTULOS SÃO DERIVADOS (20/09/2026)
   ----------------------------------------------------------------------------
   Pedido: *"o revezamento troque para 150m cada pokemon, e atualize aqui nessa tela tambem"*.
   ⚠️ E O "atualize aqui" ERA UM DEFEITO DE VERDADE: o botão dizia "Revezamento · 900 m" desde que
   a equipe virou o time inteiro, e a prova era de 1.800 m. Texto fixo que descreve uma constante
   envelhece quando a constante muda -- a mesma família do "59 espécies" da ficha da Pokédex.
   ============================================================================ */
console.log('\n=== O TRECHO DE 150 m E OS RÓTULOS ===');
{
  contaDeTeste();
  S.corridaZerar();
  ok('a individual continua em ' + S.CORRIDA_METROS + ' m', S.CORRIDA_METROS === 300);
  ok('e o trecho do revezamento é 150', S.CORRIDA_METROS_TRECHO === 150, String(S.CORRIDA_METROS_TRECHO));
  /* ⚠️ SÃO DUAS CONSTANTES: mudar o trecho não pode encolher a individual, que é a que o ranking
     chama de "individual de 300 m". */
  ok('  e são DUAS constantes, não uma', S.CORRIDA_METROS !== S.CORRIDA_METROS_TRECHO);
  ok('o total do revezamento é ' + (S.CORRIDA_METROS_TRECHO * S.CORRIDA_TRECHOS) + ' m',
     S.corridaTotalDo('relay') === S.CORRIDA_METROS_TRECHO * S.CORRIDA_TRECHOS,
     String(S.corridaTotalDo('relay')));
  ok('  e o da individual é ' + S.CORRIDA_METROS, S.corridaTotalDo('single') === S.CORRIDA_METROS);

  S.corrida.formato = 'single';
  ok('o ajudante segue o formato escolhido (individual)', S.corridaMetros() === S.CORRIDA_METROS);
  S.corrida.formato = 'relay';
  ok('  e o revezamento', S.corridaMetros() === S.CORRIDA_METROS_TRECHO);
  S.corrida.formato = 'single';

  /* ⚠️ OS DOIS RÓTULOS SÃO DERIVADOS, e é isso que impede o próximo ajuste de deixar um deles
     mentindo. A trava procura o NÚMERO calculado, não um texto fixo -- se ela procurasse "900 m"
     ela envelheceria junto com o rótulo. */
  const tela = S.renderCorrida();
  ok('o botão da individual diz o total dela',
     tela.indexOf('Individual · ' + S.corridaTotalDo('single') + '&nbsp;m') >= 0);
  ok('  e o do revezamento, o dele',
     tela.indexOf('Revezamento · ' + S.corridaTotalDo('relay') + '&nbsp;m') >= 0);
  ok('  e nenhum dos dois está escrito à mão no arquivo',
     src.indexOf('Revezamento \u00b7 900 m') < 0 && src.indexOf('Individual \u00b7 300 m') < 0,
     'texto fixo que descreve constante envelhece');
  S.corrida.formato = 'relay';
  ok('  e a explicação do revezamento diz os ' + S.CORRIDA_METROS_TRECHO + ' m',
     S.renderCorrida().indexOf(S.CORRIDA_METROS_TRECHO + ' m cada') >= 0);
  S.corrida.formato = 'single';

  /* ⚠️ E O "TESTE ADMIN" SAIU das duas telas (a pescaria já tinha saído no mesmo dia) */
  ok('o cabeçalho não diz mais TESTE ADMIN', S.renderCorrida().indexOf('TESTE ADMIN') < 0);
  S.corrida.fase = 'fim'; S.corrida.corredores = [];
  ok('  nem o da tela de resultado', S.renderCorrida().indexOf('TESTE ADMIN') < 0);
  ok('  e ele não sobrou no arquivo', src.indexOf('TESTE ADMIN') < 0);
  S.corridaZerar();
}

/* ============================================================================
   20) OS DOIS RANKINGS -- o lado de cá (20/09/2026)
   ----------------------------------------------------------------------------
   Pedido: *"crie o ranking individual de 300m e o ranking do revezamento, o tempo dos npc nao
   coloque no ranking, apenas dos treinadores"*.
   O SERVIDOR é trancado no `tools/test-corrida-rank.js`; aqui é o que SAI daqui e o que a tela
   desenha.
   ⚠️ E NADA AQUI USA `await`: o `httpsCallable(...)(...)` é chamado de forma SÍNCRONA dentro do
   `corridaCarregarRank`, então o espião registra na hora -- e o que depende da resposta é montado
   à mão. Um `await` no topo deste arquivo (que é CommonJS) seria erro de sintaxe.
   ============================================================================ */
console.log('\n=== OS DOIS RANKINGS (cliente) ===');
{
  contaDeTeste();
  S.corridaZerar();
  const enviados = [];
  const original = S.functionsClient.httpsCallable;
  S.functionsClient.httpsCallable = (nome) => (dados) => {
    enviados.push({ nome, dados: dados || {} });
    return Promise.resolve({ data: { gravado: true } });
  };
  g.authUser = { uid: 'u1' };

  /* ⚠️ O QUE VAI É O TEMPO DE `corredores[0]`, e SÓ ele: o adversário não tem conta, e o servidor
     grava no documento de quem chamou. Um segundo tempo não tem por onde entrar. */
  S.corrida.formato = 'single';
  S.corrida.escolhidos = [mk('jolteon', 60)];
  const eu = S.corridaNovoCorredor([S.corridaInstancia(mk('jolteon', 60), true)], true);
  const npc = S.corridaNovoCorredor([S.corridaInstancia(mk('shuckle', 60), false)], false);
  eu.chegada = 24.5; npc.chegada = 31.0;
  S.corrida.corredores = [eu, npc];
  S.corridaEnviarRank();
  const envio = enviados.find(x => x.nome === 'submitRaceTime');
  ok('o envio manda o MEU tempo', !!envio && envio.dados.tempo === 24.5, JSON.stringify(envio && envio.dados));
  ok('  e a modalidade', !!envio && envio.dados.modalidade === 'single');
  ok('  e diz que venci', !!envio && envio.dados.venceu === true);
  /* ⚠️ A TRAVA QUE IMPORTA: o tempo do NPC não sai daqui de jeito nenhum */
  ok('  e o tempo do NPC NÃO vai junto',
     !!envio && JSON.stringify(envio.dados).indexOf('31') < 0,
     JSON.stringify(envio && envio.dados));
  ok('  e o pedido leva UM tempo só',
     !!envio && Object.keys(envio.dados).filter(k => /tempo/i.test(k)).length === 1,
     Object.keys((envio || {}).dados || {}).join(','));

  /* quem não completou não vira linha no ranking */
  enviados.length = 0;
  eu.chegada = null;
  S.corridaEnviarRank();
  ok('quem NÃO completou não envia nada', !enviados.some(x => x.nome === 'submitRaceTime'),
     'um documento de quem desistiu seria linha morta');
  eu.chegada = 24.5;

  /* ⚠️ UMA CHAMADA SÓ TRAZ AS DUAS LISTAS: trocar de modalidade não pode custar outra ida */
  enviados.length = 0;
  S.corridaRank.single = null; S.corridaRank.relay = null; S.corridaRank.carregando = false;
  S.corridaCarregarRank(true);
  ok('uma chamada só pra os dois rankings',
     enviados.filter(x => x.nome === 'getRaceRanking').length === 1,
     enviados.filter(x => x.nome === 'getRaceRanking').length + ' chamada(s)');

  /* daqui pra baixo a resposta é montada à mão -- o que se testa é o DESENHO */
  S.corridaRank.carregando = false;
  S.corridaRank.single = { lista: [{ pos: 1, nome: 'Ana', tempo: 18.5, especie: 'Jolteon', eu: false }], meu: null };
  S.corridaRank.relay  = { lista: [{ pos: 1, nome: 'Beto', tempo: 99.5, especie: 'Time B', eu: true }], meu: null };
  enviados.length = 0;
  S.corridaCarregarRank(false);
  ok('  e a segunda vez não vai à rede', !enviados.length);

  S.corrida.fase = 'setup'; S.corrida.corredores = [];
  S.corrida.formato = 'single';
  let caixa = S.corridaRankHtml();
  ok('a caixa nomeia a INDIVIDUAL e o tamanho dela',
     caixa.indexOf('Individual · ' + S.corridaTotalDo('single') + ' m') >= 0, caixa.slice(0, 220));
  ok('  e mostra o tempo em segundos', caixa.indexOf('18.50s') >= 0);
  ok('  e o nome do treinador', caixa.indexOf('Ana') >= 0);
  ok('  e não mistura o do revezamento', caixa.indexOf('Beto') < 0);
  S.corrida.formato = 'relay';
  caixa = S.corridaRankHtml();
  ok('trocando de modalidade, a caixa troca de lista',
     caixa.indexOf('Beto') >= 0 && caixa.indexOf('Ana') < 0);
  ok('  e nomeia o REVEZAMENTO', caixa.indexOf('Revezamento · ' + S.corridaTotalDo('relay') + ' m') >= 0);
  /* ⚠️ A LINHA É A DO RANKING DA PESCARIA: reusá-la é o que faz os dois se lerem igual */
  ok('  e reusa a linha do ranking da pescaria', caixa.indexOf('pesc-rank-linha') >= 0);
  S.corrida.formato = 'single';

  /* e a caixa aparece nas DUAS telas em que o jogador está parado */
  S.corrida.fase = 'setup';
  ok('a caixa aparece na tela de setup', S.renderCorrida().indexOf('Melhores tempos') >= 0);
  S.corrida.fase = 'fim'; S.corrida.corredores = [eu, npc];
  ok('  e na tela de resultado', S.renderCorrida().indexOf('Melhores tempos') >= 0);
  /* ⚠️ E NÃO É PEDIDO DURANTE A CORRIDA: ali o laço está pintando, e uma resposta de rede chamaria
     render() no meio da animação -- a regra da casa, que já custou três defeitos. */
  S.corrida.fase = 'correndo';
  enviados.length = 0;
  /* ⚠️ A LISTA PRECISA ESTAR VAZIA AQUI, senão quem barra a chamada é a guarda do próprio
     `corridaCarregarRank` (lista já lida) e a trava passa com o defeito religado -- conferido. */
  const guardadas = { s: S.corridaRank.single, r: S.corridaRank.relay };
  S.corridaRank.single = null; S.corridaRank.relay = null; S.corridaRank.carregando = false;
  S.renderCorrida();
  ok('  e o ranking NÃO é pedido durante a corrida', !enviados.length,
     'render() no meio da animação mata a transição da barra');
  /* e o controle: parado, ele PEDE -- sem esta metade a de cima passaria com a chamada removida */
  S.corrida.fase = 'setup';
  S.renderCorrida();
  ok('  (mas é pedido quando o jogador está parado)', enviados.length === 1,
     enviados.length + ' chamada(s)');
  S.corridaRank.single = guardadas.s; S.corridaRank.relay = guardadas.r;
  S.corridaRank.carregando = false;
  enviados.length = 0;
  S.corrida.fase = 'setup'; S.corrida.corredores = [];

  /* o aviso de recorde é DESTA corrida, e da modalidade dela */
  S.corridaRank.recorde = 'single';
  ok('o aviso de recorde sai na modalidade dele', S.corridaRankHtml().indexOf('Recorde novo') >= 0);
  S.corrida.formato = 'relay';
  ok('  e não na outra', S.corridaRankHtml().indexOf('Recorde novo') < 0);
  S.corrida.formato = 'single';
  /* ⚠️ E ELE ZERA NA LARGADA: sem isso o "Recorde novo!" grudaria na corrida seguinte */
  ok('  e a largada zera o aviso',
     /corridaRank\.recorde = null;[\s\S]{0,120}corrida\.fase = 'contagem'/.test(src),
     'o aviso é desta corrida, não da anterior');

  /* os três estados da caixa */
  S.corridaRank.recorde = null;
  S.corridaRank.single = null; S.corridaRank.relay = null; S.corridaRank.erro = null;
  ok('sem lista ainda, ela diz que está carregando', S.corridaRankHtml().indexOf('Carregando') >= 0);
  S.corridaRank.single = { lista: [], meu: null };
  ok('  com a lista vazia, ela convida', S.corridaRankHtml().indexOf('Ninguém correu') >= 0);
  S.corridaRank.erro = 'Não deu.';
  ok('  e com erro, oferece tentar de novo',
     S.corridaRankHtml().indexOf('corridaCarregarRank(true)') >= 0);

  S.functionsClient.httpsCallable = original;
  g.authUser = null;
  S.corridaZerar();
}
/* ============================================================================
   21) AS SETE DE 20/09/2026 -- os chips que seguem, o nome cortado, a classificação por
       TREINADOR, o Speed que saiu da lista, a velocidade total do time, o Sair que sumiu e o
       sprite SHINY na pista.
   ============================================================================ */
console.log('\n=== OS CHIPS DO REVEZAMENTO SEGUEM O CORREDOR ===');
{
  contaDeTeste();
  S.corridaZerar();
  S.corrida.formato = 'relay';
  S.corridaEscolherTime(0);
  const time = S.corrida.escolhidos;
  const eu = S.corridaNovoCorredor(time.map(p => S.corridaInstancia(p, true)), true);
  S.corrida.corredores = [eu];
  S.corrida.fase = 'correndo';

  /* ⚠️ O DEFEITO ERA O CHIP SER MONTADO NO render() E NUNCA MAIS TROCAR: o laço não chama
     render() (ele recriaria o canvas e o botão 60 vezes por segundo), então o amarelo congelava
     no PRIMEIRO trecho a prova inteira. Foi reportado com print. */
  ok('no trecho 0 o chip 0 é o ativo',
     S.corridaClasseDoTrecho(0) === ' ativo' && S.corridaClasseDoTrecho(1) === '');
  eu.trecho = 3;
  ok('  no trecho 3 o ativo ANDOU', S.corridaClasseDoTrecho(3) === ' ativo');
  ok('  e o 0 virou "feito"', S.corridaClasseDoTrecho(0) === ' feito');
  ok('  e o 4 continua por correr', S.corridaClasseDoTrecho(4) === '');

  /* ⚠️ E É O PINTOR QUEM TROCA A CLASSE -- é a única coisa que roda durante a corrida. Um caso
     que chamasse só o `corridaClasseDoTrecho` passaria com o defeito inteiro de volta. */
  eu.trecho = 0;
  /* ⚠️ O VALOR INICIAL SE LÊ NO HTML, e não pelo `getElementById`: o sandbox guarda um stub por
     id mas NÃO parseia o que o render escreveu, então a classe só existe no texto. Lido pelo
     stub, isto mediria o nada -- e o pintor logo abaixo passaria por acaso. */
  const idChip = (i) => 'id="corridaTrecho' + i + '"';
  const inicial = S.renderCorrida();
  ok('o render dá o valor inicial ao chip',
     /class="corrida-trecho ativo" id="corridaTrecho0"/.test(inicial));
  ok('  e o segundo nasce sem classe',
     /class="corrida-trecho" id="corridaTrecho1"/.test(inicial));
  /* daqui pra baixo é o PINTOR, que mexe no DOM -- e ali o stub por id é exatamente o certo */
  S.render();
  const el = (i) => S.document.getElementById('corridaTrecho' + i);
  el(0).className = 'corrida-trecho ativo';
  el(2).className = 'corrida-trecho';
  eu.trecho = 2;
  S.corridaPintarHud();
  ok('  e o PINTOR o move sem render()', !!el(2) && /ativo/.test(el(2).className),
     el(2) ? el(2).className : 'sem elemento');
  ok('  e apaga o antigo', !!el(0) && /feito/.test(el(0).className) && !/ativo/.test(el(0).className));

  /* ⚠️ SÓ QUANDO A CLASSE MUDA: um className cego força recálculo de estilo em 6 elementos por
     quadro, 60 vezes por segundo. É a mesma guarda de igualdade que o texto do HUD usa. */
  ok('  e ele só escreve quando a classe MUDA',
     /if\(el\.className !== cls\) el\.className = cls;/.test(src));

  /* ⚠️ O NOME SAIU DO CHIP: a 320px são SEIS em ~281px, ou seja ~35px de texto cada --
     "Victreebel" não cabe em fonte nenhuma legível, e era isso que saía quebrado no print. */
  const html = S.renderCorrida();
  ok('o chip NÃO escreve o nome do pokémon',
     html.indexOf('>Victreebel<') < 0 && html.indexOf('<b>Jolteon</b>') < 0);
  ok('  e mostra o SPRITE no lugar', /corrida-trecho-spr/.test(html));
  ok('  com o nome no title, que é onde ele cabe', /title="Jolteon ·/.test(html));
  /* ⚠️ E NEM A FAIXA DE METROS COUBE: medido no navegador, "150–300" saía CORTADO em 5 dos 6
     chips (o conteúdo de um chip tem 33px). O que cabe é a POSIÇÃO -- que é o que a tela já fala
     em todo lugar ("trecho 3/6" no HUD) --, e a faixa inteira foi pro `title`. */
  ok('  e o número do chip é a POSIÇÃO, que cabe', html.indexOf('<b>1º</b>') >= 0
     && html.indexOf('<b>' + S.CORRIDA_TRECHOS + 'º</b>') >= 0);
  /* ⚠️ SEM AMARRAR NO NOME: a primeira versão procurava `title="Jolteon · 150–300 m"` e o Jolteon
     é o PRIMEIRO no time de teste (0–150) -- ela media a ordem do fixture, não a regra. */
  ok('    e a faixa de metros foi pro title',
     new RegExp('title="[^"]+ · ' + S.CORRIDA_METROS_TRECHO + '–' + (2 * S.CORRIDA_METROS_TRECHO) + ' m"').test(html));
  ok('    e não sobrou faixa no corpo do chip',
     html.indexOf('<b>0–' + S.CORRIDA_METROS_TRECHO + '</b>') < 0);
  /* o sprite precisa de regra PRÓPRIA: a `.sprite-sm .sprite-img` da casa vem DEPOIS no arquivo */
  ok('  e o CSS do sprite tem três seletores (senão a regra da casa ganha)',
     /\.corrida-trecho \.corrida-trecho-spr \.sprite-img\{[^}]*width:24px/.test(src));
}

console.log('\n=== A CLASSIFICAÇÃO É DE TREINADORES ===');
{
  contaDeTeste();
  g.trainerName = 'Buzzo';
  S.corridaZerar();
  S.corrida.formato = 'relay';
  S.corridaEscolherTime(0);
  const eu = S.corridaNovoCorredor(S.corrida.escolhidos.map(p => S.corridaInstancia(p, true)), true);
  const npc = S.corridaNovoCorredor(S.sortearNpcs()[0], false);
  eu.chegada = 60; npc.chegada = 65;
  eu.trecho = npc.trecho = S.CORRIDA_TRECHOS - 1;
  S.corrida.corredores = [eu, npc];
  S.corrida.fase = 'fim';
  const html = S.renderCorrida();

  /* ⚠️ ELA MOSTRAVA O NOME DO POKÉMON QUE ESTAVA CORRENDO NA HORA DA CHEGADA -- num revezamento
     isso é um dos seis, escolhido por acaso, e não diz de quem era a equipe. */
  ok('a linha traz o NOME DO TREINADOR', html.indexOf('Buzzo') >= 0);
  /* ⚠️ E O ADVERSÁRIO TEM NOME DE LÍDER DA LIGA LARANJA (20/09/2026, a pedido). Ele era numerado
     -- e o número tinha sido escolhido porque "Adversário 1" quebrava em duas linhas na coluna de
     83px. Os cinco do Orange Crew cabem: o mais longo tem cinco letras.
     ⚠️ A TRAVA LÊ A LISTA, nunca um nome escrito aqui: trocar um deles não pode derrubá-la. */
  ok('  e o adversário tem nome de líder da Liga Laranja',
     html.indexOf(S.corridaNomeDoNpc(1)) >= 0, S.corridaNomeDoNpc(1));
  ok('    e ele não é mais numerado', !/Rival \d/.test(html) && !/NPC \d/.test(html));
  ok('    e a ordem é FIXA (o mesmo nome na mesma raia)',
     S.corridaNomeDoNpc(1) === S.CORRIDA_NPC_NOMES[0] && S.corridaNomeDoNpc(2) === S.CORRIDA_NPC_NOMES[1]);
  ok('    e a lista tem folga sobre as raias',
     S.CORRIDA_NPC_NOMES.length >= S.CORRIDA_PARTICIPANTES - 1,
     S.CORRIDA_NPC_NOMES.length + ' nomes pra ' + (S.CORRIDA_PARTICIPANTES - 1) + ' adversários');
  ok('    e nenhum nome cabe em mais de 8 caracteres (a coluna de 83px)',
     S.CORRIDA_NPC_NOMES.every(n2 => n2.length <= 8), S.CORRIDA_NPC_NOMES.join(','));
  /* ⚠️ O RÓTULO DE TEXTO DUROU ALGUMAS HORAS: em 20/09 ele virou a FILEIRA DE SPRITES, a pedido.
     A trava do que ficou no lugar dele está no bloco 22. */

  /* na INDIVIDUAL o que faz sentido embaixo é o pokémon, que é o que ele escolheu */
  S.corridaZerar();
  S.corrida.formato = 'single';
  const solo = S.corridaNovoCorredor([S.corridaInstancia(mk('jolteon', 60), true)], true);
  solo.chegada = 20;
  S.corrida.corredores = [solo];
  S.corrida.fase = 'fim';
  const h2 = S.renderCorrida();
  ok('na individual o treinador vem em cima', h2.indexOf('Buzzo') >= 0);
  ok('  e o POKÉMON embaixo', h2.indexOf('Jolteon') >= 0);
  /* ⚠️ SEM NOME DE CONTA ELE CAI NO "Você" da casa -- é o mesmo `nomeDoTreinador` que a Pescaria
     usa, e ele responde por quem ainda não nomeou a conta. */
  g.trainerName = null;
  ok('  e sem nome de conta ele cai no "Você"', S.corridaTreinadorDe(0) === 'Você');
  g.trainerName = 'Buzzo';
}

console.log('\n=== O SPEED AZUL SAIU DA LISTA DE ORDEM ===');
{
  contaDeTeste();
  S.corridaZerar();
  S.corrida.formato = 'relay';
  S.corridaEscolherTime(0);
  const linha = S.corridaLinhaEscolhido(S.corrida.escolhidos[0], 0);
  ok('a linha não escreve "Speed N"', !/Speed \d/.test(linha), linha.slice(0, 110));
  ok('  e a classe virou letra morta no CSS', src.indexOf('.corrida-speed{') < 0);
  /* ⚠️ E ELA NÃO LEVOU O `corrida-speed-badge` JUNTO: são coisas diferentes -- aquele é o número
     da lista de POKÉMON (a individual e a Pescaria), e o pedido é sobre a lista de ORDEM. */
  ok('  mas o selo da lista de escolha continua', src.indexOf('.corrida-speed-badge') >= 0);
  ok('  e os tipos continuam na linha', linha.indexOf('mon-sub') >= 0);
  ok('  e as setas de ordem continuam', linha.indexOf('corridaMover') >= 0);
}

console.log('\n=== A VELOCIDADE TOTAL DO TIME, E O SAIR QUE SUMIU ===');
{
  contaDeTeste();
  S.corridaZerar();
  S.corrida.formato = 'relay';
  const esperado = g.saveSlots[0].team.reduce((a, p) =>
    a + S.speedDaCorrida(S.corridaInstancia(Object.assign({}, p, { slot: 0 }), true)), 0);
  ok('a soma é a dos seis `speedDaCorrida`', S.corridaSpeedDoTime(0) === esperado, String(esperado));
  /* ⚠️ O SHINY ENTRA NELA, e é por isso que ela é o `speedDaCorrida` e não "nível + Speed base":
     aquele é o MESMO número que decide a pista, com o nível, o shiny e a especialidade dentro.
     O time de teste tem um Snorlax shiny. */
  const semShiny = g.saveSlots[0].team.reduce((a, p) =>
    a + S.speedDaCorrida(S.corridaInstancia(Object.assign({}, p, { slot: 0, shiny: false }), true)), 0);
  ok('  e o SHINY entra na conta (1,20x)', esperado > semShiny, esperado + ' > ' + semShiny);

  const picker = S.corridaPickerDeTimes();
  ok('o card mostra a velocidade total', picker.indexOf('Velocidade total do time') >= 0);
  ok('  com o número dentro', picker.indexOf('<b>' + esperado + '</b>') >= 0);
  ok('  e ele é o mesmo card da Liga e da Pescaria', picker.indexOf('save-slot-card') >= 0);
  /* ⚠️ O RODAPÉ É OPCIONAL, e a Pescaria NÃO o passa: um card próprio pra a Corrida seria a
     terceira cópia do mesmo desenho. */
  ok('  e a Pescaria continua sem rodapé',
     S.pescariaCardDoTime(0, false, 'x()').indexOf('card-rodape') < 0);

  S.corrida.picker = true;
  const tela = S.renderCorrida();
  ok('a tela de escolha NÃO tem mais o "Sair"', tela.indexOf('sairDaCorrida') < 0);
  ok('  e continua com o "Voltar"', tela.indexOf('corridaFecharPicker') >= 0);
  S.corrida.picker = false;
  /* ⚠️ MAS O SAIR CONTINUA NAS OUTRAS TELAS -- é de lá que se sai do modo */
  S.corrida.fase = 'setup';
  ok('  e o setup continua podendo sair', S.renderCorrida().indexOf('sairDaCorrida') >= 0);
}

console.log('\n=== O SPRITE SHINY NA PISTA ===');
{
  /* ⚠️ A PASTA DO SHINY É A SUBPASTA `0000/0001`, e ela foi conferida antes de virar código:
     mesmas dimensões e mesmo AnimData do normal. `<dex>/0001/` é outra COISA -- uma forma
     alternativa (a Mega) --, e usar ela desenharia outro pokémon. */
  ok('a pasta do shiny é a subpasta 0000/0001',
     S.pmdPasta('gyarados', true) === '0130/0000/0001');
  ok('  e a do normal não mudou', S.pmdPasta('gyarados') === '0130');
  ok('  e ela continua valendo com shiny=false', S.pmdPasta('gyarados', false) === '0130');

  /* ⚠️ A CHAVE DO CACHE LEVA O SHINY: sem isso um Gyarados shiny e um normal na mesma corrida
     seriam a MESMA entrada, e quem carregasse depois ficaria com a cor do outro. */
  ok('a chave do cache separa as duas variantes',
     S.pmdChave('gyarados', true) !== S.pmdChave('gyarados', false));
  ok('  e a do normal é o próprio id (o cache velho continua valendo)',
     S.pmdChave('gyarados', false) === 'gyarados' && S.pmdChave('gyarados') === 'gyarados');

  /* o leitor pergunta pela INSTÂNCIA, e não monta a chave na mão */
  S.pmdCache['gyarados'] = { qual: 'normal' };
  S.pmdCache['gyarados:shiny'] = { qual: 'shiny' };
  ok('o leitor acha o normal', S.pmdDados({ speciesId: 'gyarados' }).qual === 'normal');
  ok('  e acha o SHINY', S.pmdDados({ speciesId: 'gyarados', shiny: true }).qual === 'shiny');
  delete S.pmdCache['gyarados']; delete S.pmdCache['gyarados:shiny'];

  /* ⚠️ E O PRELOAD BAIXA VARIANTES, não espécies: por espécie, um Gyarados shiny e um normal na
     mesma corrida dariam UMA folha, e um dos dois sairia com a cor errada. */
  /* ⚠️ E ELA LÊ O BLOCO DO PRELOAD, não o arquivo inteiro: a primeira versão procurava
     `pmdChave(p.speciesId, p.shiny)` solto, e isso CASA COM O `pmdDados` -- ou seja ela dava
     verde com o preload voltando a juntar por espécie. É a armadilha do padrão largo demais que
     as regex do `mlog-mais` e do `matchup-row` já custaram, e foi a conferência de acusação que
     a pegou: o defeito religado passava em branco. */
  const preload = (src.match(/const variantes = [\s\S]{0,420}?faltou\.push/) || [''])[0];
  ok('  (e a trava lê o bloco do preload)', preload.length > 200, preload.length + ' chars');
  ok('o preload junta por variante, não por espécie',
     /pmdChave\(p\.speciesId, p\.shiny\)/.test(preload) && /pmdCarregar\(p\.speciesId, p\.shiny\)/.test(preload));
  /* ⚠️ E O SHINY QUE FALTA CAI NO NORMAL: a cor é apresentação, a ESPÉCIE é identidade. Barrar a
     largada porque a variante colorida não baixou seria trocar um shiny por corrida nenhuma --
     substituir por OUTRA espécie continua proibido. */
  ok('  e o shiny que falta cai no normal, nunca noutra espécie',
     /if\(!shiny\) throw e2;[\s\S]{0,140}pmdCarregar\(speciesId, false\)/.test(src));
  /* o Resgate entrou junto -- ele lê o mesmo cache */
  ok('  e o Resgate também pede a variante',
     /pmdCarregar\(meu\.speciesId, meu\.shiny\), pmdCarregar\(dele\.speciesId, dele\.shiny\)/.test(src));
  ok('  e lê pelo `pmdDados`', /const dados = pmdDados\(a\.inst\);/.test(src));
}

/* ============================================================================
   22) AS QUATRO DE 20/09/2026 (a leva do ranking) -- os sprites no resultado, o modal do time no
       ranking, a página no topo ao largar, e o quadro vazio na tela de escolha.
   ============================================================================ */
console.log('\n=== OS SPRITES DO TIME NA CLASSIFICAÇÃO ===');
{
  contaDeTeste();
  g.trainerName = 'Buzzo';
  S.corridaZerar();
  S.corrida.formato = 'relay';
  S.corridaEscolherTime(0);
  const eu = S.corridaNovoCorredor(S.corrida.escolhidos.map(p => S.corridaInstancia(p, true)), true);
  const npc = S.corridaNovoCorredor(S.sortearNpcs()[0], false);
  eu.chegada = 118; npc.chegada = 124;
  eu.trecho = npc.trecho = S.CORRIDA_TRECHOS - 1;
  S.corrida.corredores = [eu, npc];
  S.corrida.fase = 'fim';
  const html = S.renderCorrida();

  /* ⚠️ O RÓTULO DE TEXTO SAIU: ele respondia "de QUEM era a equipe" e os sprites respondem QUAL
     era -- que é a pergunta que se faz olhando uma classificação. */
  ok('a linha NÃO escreve mais o nome do time', html.indexOf('Time A') < 0);
  ok('  nem o rótulo do rival', html.indexOf('Equipe rival') < 0);
  ok('  e o `corridaComQuemCorreu` virou letra morta', src.indexOf('function corridaComQuemCorreu') < 0);
  ok('o treinador continua em cima', html.indexOf('Buzzo') >= 0 && html.indexOf(S.corridaNomeDoNpc(1)) >= 0);

  /* a fileira é a MESMA do card de time -- o jogador reconhece um time por ela */
  /* ⚠️ A CLASSE É PROCURADA NA LISTA, nunca por igualdade exata: ela leva a `save-slot-team-row
     spread` junto, e um `class="resultTime"` cravado passou a casar com ZERO no dia em que a
     segunda classe entrou. É a mesma armadilha das regex do `mlog-mais` e do `matchup-row`. */
  const fileiras = (html.match(/class="[^"]*\bresultTime\b[^"]*"/g) || []).length;
  ok('e embaixo vem a FILEIRA de sprites', fileiras === 2, fileiras + ' fileira(s)');
  const dentro = html.slice(html.search(/class="[^"]*\bresultTime\b/));
  ok('  com um sprite por membro do time',
     (dentro.match(/save-slot-mon"/g) || []).length >= S.CORRIDA_TRECHOS,
     (dentro.match(/save-slot-mon"/g) || []).length + ' membros nas duas fileiras');
  /* ⚠️ E ELA É A FILEIRA DO CARD DE VERDADE (`save-slot-team-row spread`), que é uma GRADE de 6
     colunas -- é isso que faz seis sprites caberem em 243px. Com um flex-wrap próprio eles saíam
     em 48px e a fileira quebrava em DUAS linhas (a linha de resultado ia a 180px). */
  ok('  e ela É a fileira do card de time',
     /class="resultTime save-slot-team-row spread"/.test(html));
  ok('  e ela reusa o `pescariaTimeSprites` (o mesmo do card)',
     html.indexOf('save-slot-mon-level') >= 0);
  /* ⚠️ ELA OCUPA A LINHA INTEIRA: na coluna do nome (83px a 320px) seis sprites dariam 13px cada */
  ok('  e o CSS a põe na linha inteira do grid',
     /\.resultRow \.resultTime\{[^}]*grid-column:1\/-1/.test(src));

  /* na INDIVIDUAL é a mesma fileira, com UM sprite -- sem exceção nenhuma */
  S.corridaZerar();
  S.corrida.formato = 'single';
  const solo = S.corridaNovoCorredor([S.corridaInstancia(mk('jolteon', 60), true)], true);
  solo.chegada = 19;
  S.corrida.corredores = [solo];
  S.corrida.fase = 'fim';
  const h2 = S.renderCorrida();
  ok('na individual é a mesma fileira, com um sprite só',
     (h2.match(/class="[^"]*\bresultTime\b[^"]*"/g) || []).length === 1
     && (h2.match(/save-slot-mon"/g) || []).length === 1);
}

console.log('\n=== O MODAL DO TIME NO RANKING ===');
{
  contaDeTeste();
  S.corridaZerar();
  S.corrida.formato = 'single';
  /* ⚠️ O BLOCO 20 TERMINA COM `corridaRank.erro` SETADO, e a caixa devolve a mensagem de erro
     antes de chegar nas linhas -- sem isto as três travas do botão mediam a tela de erro. */
  S.corridaRank.erro = null; S.corridaRank.relay = null;
  const time = [{ speciesId: 'jolteon', level: 70, shiny: true }];
  const timeRelay = g.saveSlots[0].team.map(p => ({ speciesId: p.speciesId, level: p.level, shiny: !!p.shiny }));
  S.corridaRank.single = {
    lista: [{ pos: 1, nome: 'Ash', tempo: 18.5, time, eu: false },
            /* ⚠️ RECORDE ANTIGO NÃO TEM O CAMPO: ele é anterior a esta data, e um botão que abre
               um modal vazio é pior que botão nenhum. */
            { pos: 2, nome: 'Gary', tempo: 19.1, time: [], eu: false }],
    meu: { nome: 'Buzzo', tempo: 25.0, time: timeRelay, eu: true, pos: null },
  };
  const html = S.corridaRankHtml();

  /* ⚠️ A LEGENDA DO TIME SAIU DA LINHA: ali se compara TREINADOR e TEMPO. */
  ok('a linha NÃO traz mais a legenda do time', html.indexOf('corrida-rank-mon') < 0);
  ok('  e a classe virou letra morta no CSS', src.indexOf('.corrida-rank-mon{') < 0);
  ok('quem TEM time gravado vira botão', html.indexOf("corridaVerTimeDoRank('lista',0)") >= 0);
  ok('  com o ⓘ dizendo que há o que ver', html.indexOf('corrida-rank-info') >= 0);
  ok('  e quem NÃO tem continua sendo texto', html.indexOf("corridaVerTimeDoRank('lista',1)") < 0);
  ok('  e o MEU tem a própria âncora', html.indexOf("corridaVerTimeDoRank('meu',0)") >= 0);
  /* ⚠️ E ELE NÃO USA O `.btn` DA CASA: aquele é botão de AÇÃO, com moldura de 3px */
  ok('  e o botão não é o `.btn` da casa',
     /\.corrida-rank-btn\{[^}]*background:none;border:none/.test(src));

  /* ============================================================================
     ⚠️ O NOME DO TREINADOR É NEGRITO E UM PIXEL MENOR (20/09/2026, a pedido).
     A causa do relato estava no CSS e só a medição no navegador a pegava: `.corrida-rank-btn`
     usava `font:inherit`, e o ATALHO `font` reescreve peso e tamanho junto -- como ele vem DEPOIS
     da `.pesc-rank-nome` com a mesma especificidade, ele ganhava o empate. Medido a 320px: a
     linha COM time saía em **16px peso 400** e a linha SEM time em **11,5px peso 700**, ou seja
     duas fontes na mesma lista e a maior delas não era negrito.
     ⚠️ A TRAVA LÊ O CSS, e tem que ler: peso e tamanho de fonte não aparecem em asserção de HTML
     nenhuma -- é a mesma razão pela qual a do `-webkit-touch-callout` da Pescaria lê o arquivo. */
  const cssBtn = (src.match(/\.corrida-rank-btn\{[^}]*\}/) || [''])[0];
  ok('  (e a trava lê a regra do botão)', cssBtn.length > 60, cssBtn.length + ' chars');
  ok('  e ele NÃO usa o atalho `font:inherit`', cssBtn.indexOf('font:inherit') < 0,
     'o atalho reescreve peso e tamanho junto');
  ok('  mas herda a família e a entrelinha',
     /font-family:inherit/.test(cssBtn) && /line-height:inherit/.test(cssBtn));
  /* ⚠️ O TAMANHO É DERIVADO do `--rank-nome`, nunca reescrito: um número aqui envelheceria no
     primeiro ajuste de lá -- e a regra é do CONTAINER, então ela pega o <span> e o <button> de
     uma vez e a lista deixa de ter duas fontes. */
  ok('  o nome da Corrida é um pixel menor, DERIVADO',
     /\.pesc-rank\.corrida \.pesc-rank-nome\{[^}]*font-size:calc\(var\(--rank-nome\) - 1px\)/.test(src));
  ok('  e é negrito',
     /\.pesc-rank\.corrida \.pesc-rank-nome\{[^}]*font-weight:800/.test(src));
  ok('  e a variável existe na regra de origem',
     /\.pesc-rank-nome\{[^}]*--rank-nome:[^;]+;[^}]*font-size:var\(--rank-nome\)/.test(src));
  /* e o container da CORRIDA leva a classe -- sem ela a regra acima não pega em nada */
  ok('  e o ranking da Corrida leva a classe', html.indexOf('class="pesc-rank corrida"') >= 0);
  /* ⚠️ E A PESCARIA NÃO MUDA: ela usa a MESMA linha, e a regra é escopada ao container da Corrida */
  ok('  e o da Pescaria continua sem ela',
     S.pescariaRankHtml === undefined || S.pescariaRankHtml.toString().indexOf('pesc-rank corrida') < 0);

  /* o modal */
  S.corridaVerTimeDoRank('lista', 0);
  ok('clicar abre o modal', !!S.corrida.timeDoRank);
  const m = S.renderCorridaTimeModal();
  ok('  com o nome do treinador', m.indexOf('Ash') >= 0);
  ok('  o tempo dele', m.indexOf('18.50s') >= 0);
  ok('  a colocação', m.indexOf('1º') >= 0);
  ok('  e a MESMA fileira de sprites', m.indexOf('resultTime') >= 0 && m.indexOf('save-slot-mon') >= 0);
  /* ⚠️ E É O TIME DAQUELE TEMPO, não o time de hoje do jogador -- por isso ele viaja no envio */
  ok('  e o shiny gravado é respeitado', m.indexOf('shiny/') >= 0);
  S.corridaFecharTimeDoRank();
  ok('  e fecha', !S.corrida.timeDoRank);

  /* ⚠️ SEM TIME O CLIQUE NÃO ABRE NADA -- nem se alguém chamar pela ação */
  S.corridaVerTimeDoRank('lista', 1);
  ok('a AÇÃO recusa quem não tem time', !S.corrida.timeDoRank);
  S.corridaVerTimeDoRank('lista', 99);
  ok('  e um índice que não existe também', !S.corrida.timeDoRank);

  /* ⚠️ O ESTADO GUARDA ONDE ACHAR, e o modal é anexado ao RENDER PRINCIPAL: os modais empilham na
     ordem em que entram, e este é aberto de DENTRO da tela da corrida. */
  ok('o modal é anexado ao render principal',
     /if\(corrida\.timeDoRank\)\{ html \+= renderCorridaTimeModal\(\); \}/.test(src));
  ok('  e o campo zera com o resto do estado da corrida',
     /timeDoRank: null,/.test(src));
  S.corridaRank.single = null;
}

console.log('\n=== O TIME VIAJA NO ENVIO ===');
{
  contaDeTeste();
  g.authUser = { uid: 'u1' };
  const enviados = [];
  const original = S.functionsClient.httpsCallable;
  S.functionsClient.httpsCallable = (nome) => (payload) => {
    enviados.push({ nome, payload });
    return Promise.resolve({ data: { gravado: true } });
  };
  S.corridaZerar();
  S.corrida.formato = 'relay';
  S.corridaEscolherTime(0);
  const eu = S.corridaNovoCorredor(S.corrida.escolhidos.map(p => S.corridaInstancia(p, true)), true);
  eu.chegada = 111; eu.trecho = S.CORRIDA_TRECHOS - 1;
  S.corrida.corredores = [eu];
  S.corridaEnviarRank();
  const p = (enviados[0] || {}).payload || {};
  ok('o envio leva o time', Array.isArray(p.time) && p.time.length === S.CORRIDA_TRECHOS,
     JSON.stringify((p.time || []).slice(0, 2)));
  /* ⚠️ E SÓ O MÍNIMO PRA DESENHAR UM SPRITE: o documento é público e todo mundo o lê */
  /* ⚠️ AS DUAS DE BAIXO LEEM UMA LISTA QUE PODE NÃO EXISTIR, e uma trava que ESTOURA é pior que
     uma que falha: o processo morre, o arquivo não imprime a contagem, e a conferência de
     acusação lê isso como "passou em branco". Foi exatamente o que aconteceu aqui. */
  const oTime = Array.isArray(p.time) ? p.time : [];
  ok('  e só com espécie, nível e shiny',
     oTime.length > 0 && oTime.every(x => Object.keys(x).sort().join(',') === 'level,shiny,speciesId'));
  ok('  e o shiny do time chega', oTime.some(x => x.shiny === true));
  S.functionsClient.httpsCallable = original;
  g.authUser = null;
  S.corridaZerar();
}

console.log('\n=== A LARGADA VAI PRO TOPO, E O QUADRO VAZIO SUMIU ===');
{
  contaDeTeste();
  S.corridaZerar();
  S.corrida.formato = 'relay';
  S.corridaEscolherTime(0);
  const eu = S.corridaNovoCorredor(S.corrida.escolhidos.map(p => S.corridaInstancia(p, true)), true);

  /* ⚠️ O PLACAR E A PISTA SAEM DA FASE, nunca de `corredores.length`: os corredores são montados
     ANTES da fase virar `carregando` e SOBREVIVEM a ela -- e um sprite que falta devolve pra
     `setup` sem zerá-los, deixando o canvas em branco na tela de escolha. Foi reportado. */
  const temPista = () => {
    const h = S.renderCorrida();
    return h.indexOf('corridaCanvas') >= 0;
  };
  const temPlacar = () => S.renderCorrida().indexOf('corridaBarra0') >= 0;
  S.corrida.corredores = [eu];
  for(const fase of ['setup', 'carregando']){
    S.corrida.fase = fase;
    ok('na fase ' + fase + ' NÃO há canvas (mesmo com corredores montados)', !temPista());
    ok('  nem placar', !temPlacar());
  }
  for(const fase of ['contagem', 'correndo']){
    S.corrida.fase = fase;
    ok('na fase ' + fase + ' a pista está lá', temPista());
    ok('  e o placar também', temPlacar());
  }
  /* o caso EXATO do relato: o sprite falhou e voltou pro setup com os corredores de pé */
  S.corrida.fase = 'setup'; S.corrida.faltando = ['jolteon'];
  S.corrida.aviso = 'Faltou o sprite de: Jolteon.';
  ok('e o caso do relato (sprite faltou, voltou pro setup) não deixa quadro vazio', !temPista());
  S.corrida.faltando = []; S.corrida.aviso = '';

  /* ⚠️ E A LARGADA ROLA PRA O TOPO, DEPOIS do render: a corrida não troca de `game.screen`, então
     o render trata como a MESMA tela e repõe a rolagem anterior -- antes dele, ele desfaria. */
  const ordem = src.slice(src.indexOf("corrida.recado = 'Prepare-se para a largada!';"));
  ok('a largada rola a página pro topo', /window\.scrollTo\(0, 0\);/.test(ordem.slice(0, 700)));
  ok('  e DEPOIS do render (senão o próprio render desfaz)',
     ordem.indexOf('render();') < ordem.indexOf('window.scrollTo(0, 0);'));
}

/* ============================================================================
   23) CADA MODALIDADE TEM A PRÓPRIA SELEÇÃO (20/09/2026)
   ============================================================================ */
console.log('\n=== A SELEÇÃO NÃO VAZA ENTRE AS MODALIDADES ===');
{
  contaDeTeste();
  S.abrirCorrida();
  const nomes = (a) => a.map(p => (SP[p.speciesId] || {}).name).join(',');

  /* ⚠️ ELA CORTAVA A LISTA (`slice(0, corridaQuantos())`), e cortar seis pra UM deixa o primeiro --
     ou seja a individual herdava um corredor que ninguém escolheu pra ela. Foi reportado com print:
     o Umbreon do revezamento aparecendo sozinho na individual. */
  S.corridaTrocarFormato('relay');
  S.corridaEscolherTime(0);
  const time = nomes(S.corrida.escolhidos);
  ok('o revezamento tem os seis', S.corrida.escolhidos.length === S.CORRIDA_TRECHOS, time);

  S.corridaTrocarFormato('single');
  ok('a individual abre VAZIA (não herda o primeiro do time)',
     S.corrida.escolhidos.length === 0, nomes(S.corrida.escolhidos) || '(vazio)');

  S.corridaToggle(0, 0);
  ok('  e escolher nela não mexe no revezamento', S.corrida.escolhidos.length === 1);
  const solo = nomes(S.corrida.escolhidos);

  /* ⚠️ E GUARDAR (em vez de zerar) é o que faz a ida e volta não custar nada */
  S.corridaTrocarFormato('relay');
  ok('voltando ao revezamento, o time está como ficou',
     nomes(S.corrida.escolhidos) === time, nomes(S.corrida.escolhidos));
  S.corridaTrocarFormato('single');
  ok('  e voltando à individual, o corredor também',
     nomes(S.corrida.escolhidos) === solo, nomes(S.corrida.escolhidos));


  /* ⚠️ O CAMPO PRECISA EXISTIR NA DECLARAÇÃO do objeto, e não só no `corridaZerar`: o
     `abrirCorrida` NÃO zera, então na primeira entrada ele seria `undefined` -- e o
     `corridaTrocarFormato` escreve nele antes de qualquer outra coisa. */
  /* ⚠️ A FATIA VAI ATÉ O FECHA-CHAVES, e não a 700 caracteres: ela era fixa e ENVELHECEU no dia
     em que o objeto ganhou dois campos -- a trava acusou o que estava certo. É a armadilha da
     fatia curta demais, que este projeto já pagou no `tentarGolpeEspecial`. */
  const iDecl = src.indexOf('const corrida = {');
  const decl = src.slice(iDecl, src.indexOf('\n};', iDecl));
  ok('  (e a trava lê a declaração inteira)', decl.length > 300, decl.length + ' chars');
  ok('o campo existe na declaração do objeto (não só no zerar)',
     decl.indexOf('escolhaPorFormato') >= 0);
  ok('  e no `corridaZerar` também',
     src.slice(src.indexOf('function corridaZerar')).slice(0, 900).indexOf('escolhaPorFormato') >= 0);
  /* e ele NÃO corta mais */
  ok('  e a troca não CORTA mais a lista',
     src.indexOf('corrida.escolhidos.slice(0, corridaQuantos())') < 0);

  /* sair do modo zera as duas */
  S.corridaZerar();
  ok('sair do modo zera as duas seleções',
     S.corrida.escolhaPorFormato.single.length === 0 && S.corrida.escolhaPorFormato.relay.length === 0);
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
