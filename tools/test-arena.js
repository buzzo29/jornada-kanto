/**
 * A ARENA DA SEMANA -- a mecânica semanal da Arena 1x1 (24/09/2026).
 *
 * O que ele existe pra pegar, em ordem de importância:
 *   1. o ADVERSÁRIO É O MESMO PRA TODO MUNDO NA SEMANA, e ele sai de um sorteio SEMEADO pelo
 *      `semanaId` -- que vem do SERVIDOR. Se ele passar a vir do relógio do celular, dois
 *      jogadores em fusos diferentes enfrentam bichos diferentes e o ranking deixa de comparar
 *      a mesma coisa;
 *   2. a ESCADA: nível 1 = Lv.60, e o adversário sobe 3 por nível. Derivada, nunca guardada;
 *   3. a PROGRESSÃO NÃO VALE NA TRAVESSIA das Ilhas -- medido, com ela valendo a travessia cai pra
 *      19% no nível 8 e ZERO no 12 (time da jornada, 2 chances). É a decisão mais delicada daqui;
 *   4. sem o `semanaId` a partida NÃO larga: não se sabe nem quem é o adversário nem o nível;
 *   5. a tela: a caixa da semana e o ranking existem na ilha e NÃO na travessia;
 *   6. o que vai pro servidor é um BOOLEANO, e quem soma é ele.
 *
 *   node tools/test-arena.js
 */
const path = require('path');
const raiz = path.join(__dirname, '..');
const { createSandbox } = require(path.join(__dirname, 'game-sandbox.js'));
const S = createSandbox();
const src = require('fs').readFileSync(path.join(raiz, 'index.html'), 'utf8');
const srvSrc = require('fs').readFileSync(path.join(raiz, 'functions', 'index.js'), 'utf8');

let falhas = 0;
function ok(titulo, cond, extra){
  if(cond){ console.log('  OK     ' + titulo + (extra ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHOU ' + titulo + (extra ? '   ' + extra : '')); }
}
const g = S.__getGame();
const SP = S.SPECIES;
const mk = (id, lv, ex) => Object.assign({
  speciesId: id, level: lv, name: SP[id].name, types: SP[id].types, id: 'm' + id, hp: 1, maxHp: 1,
  ataques: S.ataquesDisponiveis(id, lv).slice(0, S.MAX_GOLPES),
}, ex || {});
function contaDeTeste(){
  g.saveSlots = new Array(S.MAX_SAVE_SLOTS).fill(null);
  g.saveSlots[0] = { team: [mk('jolteon', 60), mk('venusaur', 58), mk('snorlax', 62),
                            mk('alakazam', 59), mk('gyarados', 61), mk('shuckle', 55)],
                     badgeCount: 8, customName: 'Time A' };
  g.currentSaveSlot = null;
  g.ilhasJornada = null;
  g.authUser = { uid: 'u1' };
  g.ehAdmin = true;
  g.specialties = [];
  g.equipados = {};
}
const folha = { img: {}, w: 32, h: 32, durations: [4, 4], caixas: [[4, 4, 28, 30], [4, 4, 28, 30]] };
function semearSprites(){ Object.keys(SP).forEach(id => { S.pmdCache[id] = folha; S.pmdCache[id + ':shiny'] = folha; }); }
/* preenche o `arenaRank` como a resposta da callable faria */
function semana(id, nivel){
  S.arenaRank.semanaId = id || '2026-09-21';
  S.arenaRank.nivel = nivel == null ? 1 : nivel;
  S.arenaRank.lista = []; S.arenaRank.meu = null; S.arenaRank.erro = null;
  S.arenaRank.subiu = false;
  S.arenaRank.lidoEm = Date.now();
}

/* ============================================================================
   1) OS CANDIDATOS -- "um pokemon acima do bst 500"
   ============================================================================ */
console.log('\n=== OS CANDIDATOS ===');
{
  const c = S.arenaCandidatos();
  ok('o corte de BST é o do pedido', S.ARENA_BST_MIN === 500, String(S.ARENA_BST_MIN));
  /* ⚠️ ESTRITO, e não "a partir de": o pedido diz ACIMA de 500. */
  ok('  e ele é ESTRITO (o de BST exatamente 500 fica de fora)',
     c.every(id => S.bstOf(id) > 500) && Object.keys(SP).some(id => S.bstOf(id) === 500),
     'menor da lista: ' + Math.min(...c.map(id => S.bstOf(id))));
  /* ⚠️ OS QUATRO INTOCÁVEIS FICAM DE FORA, e eles são justamente o TOPO da faixa: com eles o teto
     seria 680 contra os 600 do Tyranitar, e uma semana em nove seria contra um corpo que nenhuma
     outra alcança. */
  const intoc = ['mewtwo', 'lugia', 'hooh', 'celebi'].filter(id => SP[id]);
  ok('  e nenhum INTOCÁVEL entra', intoc.every(id => c.indexOf(id) < 0),
     intoc.filter(id => c.indexOf(id) >= 0).join(',') || '(nenhum)');
  ok('  e são os 4 de maior BST da faixa, ou seja excluí-los é o que segura a variedade',
     intoc.every(id => S.bstOf(id) >= Math.max(...c.map(x => S.bstOf(x)))));
  /* ⚠️ OS LENDÁRIOS CAPTURÁVEIS FICAM: o precedente do ADVERSÁRIO é o da Pescaria (que exclui só os
     quatro). A Liga Pro exclui lendário porque lá o bolo vira o TIME do jogador. */
  ok('  e os lendários capturáveis FICAM (uma semana contra o Zapdos é um evento)',
     c.indexOf('zapdos') >= 0 && c.indexOf('suicune') >= 0);
  ok('  e a lista tem variedade de verdade', c.length >= 30, c.length + ' espécies');
  /* ⚠️ ORDENADA: sortear por índice numa lista que depende da ordem de declaração amarra o sorteio
     ao arquivo -- a lição do `POOL_METRONOMO`. */
  ok('  e ela vai ORDENADA', JSON.stringify(c) === JSON.stringify(c.slice().sort()));
}

/* ============================================================================
   2) O SORTEIO DA SEMANA -- o mesmo pra todo mundo, e do SERVIDOR
   ============================================================================ */
console.log('\n=== O SORTEIO DA SEMANA ===');
{
  const a = S.arenaDaSemana('2026-09-21');
  const b = S.arenaDaSemana('2026-09-21');
  ok('a mesma semana dá o MESMO pokémon', a === b && !!a, String(a));
  /* ⚠️ ELE NÃO DEPENDE DE QUEM ESTÁ JOGANDO: "durante a semana todo mundo enfrenta esse pokemon". */
  g.authUser = { uid: 'outro' };
  ok('  e ele não depende do treinador', S.arenaDaSemana('2026-09-21') === a);
  g.authUser = { uid: 'u1' };
  const semanas = ['2026-09-14','2026-09-21','2026-09-28','2026-10-05','2026-10-12','2026-10-19',
                   '2026-10-26','2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30'];
  const bichos = semanas.map(s => S.arenaDaSemana(s));
  ok('  e semanas diferentes dão pokémon diferente', new Set(bichos).size >= 8,
     new Set(bichos).size + ' distintos em ' + semanas.length + ' semanas');
  ok('  e todos saem da lista de candidatos',
     bichos.every(id => S.arenaCandidatos().indexOf(id) >= 0));
  /* ⚠️ SEM `semanaId` ELE DEVOLVE NULL, e é esse null que impede a partida de largar sem se saber
     quem é o adversário. */
  ok('  e sem a semana ele devolve null', S.arenaDaSemana(null) === null
     && S.arenaDaSemana('') === null);
  /* ⚠️ A SEMANA VEM DO SERVIDOR: o cliente NÃO pode ter uma segunda regra de data. */
  ok('  e o cliente não calcula a semana por conta própria',
     !/function\s+semanaDoRanking\s*\(/.test(src));
  ok('  e ela é lida do `arenaRank.semanaId`, que vem da callable',
     /arenaRank\.semanaId\s*=\s*\(r\.data && r\.data\.semanaId\)/.test(src));
}

/* ============================================================================
   3) A ESCADA -- nivel 1 = Lv.60, e +3 por nivel
   ============================================================================ */
console.log('\n=== A ESCADA DE NÍVEL ===');
{
  ok('o nível 1 começa em Lv.60', S.arenaNivelDoAdversario(1) === 60,
     String(S.arenaNivelDoAdversario(1)));
  ok('  e o passo é de 3', S.ARENA_NIVEL_PASSO === 3 &&
     S.arenaNivelDoAdversario(2) === 63 && S.arenaNivelDoAdversario(3) === 66);
  /* ⚠️ SEM TETO DE DIFICULDADE: o 99 é o teto do JOGADOR, não do motor (o Mew da raide é Lv.4999).
     É o desenho da Torre -- "o que ela mede é até onde cada um chega". */
  ok('  e ele PASSA do nível 99 (o teto é do jogador, não do motor)',
     S.arenaNivelDoAdversario(14) === 99 && S.arenaNivelDoAdversario(15) === 102,
     'n14=' + S.arenaNivelDoAdversario(14) + ' n15=' + S.arenaNivelDoAdversario(15));
  /* ⚠️ NÍVEL AUSENTE VALE 1: quem nunca venceu não tem documento, e o Lv.60 é o do pedido. */
  ok('  e nível ausente ou inválido vale 1',
     S.arenaNivelDoAdversario(null) === 60 && S.arenaNivelDoAdversario(0) === 60
     && S.arenaNivelDoAdversario(-5) === 60 && S.arenaNivelDoAdversario('x') === 60);
  /* ⚠️ ELE É DERIVADO, nunca guardado: guardado, ele só conseguiria ficar velho. */
  ok('  e ele é DERIVADO do nível, não um campo',
     /ARENA_NIVEL_BASE \+ ARENA_NIVEL_PASSO \* \(Math\.max\(1/.test(src));
}

/* ============================================================================
   4) A INSTANCIA DO ADVERSARIO
   ============================================================================ */
console.log('\n=== A INSTÂNCIA DO ADVERSÁRIO ===');
{
  contaDeTeste();
  const inst = S.arenaAdversario('2026-09-21', 5);
  ok('ele é o pokémon da semana', inst.speciesId === S.arenaDaSemana('2026-09-21'));
  ok('  e ele entra no nível da escada', inst.level === S.arenaNivelDoAdversario(5),
     'Lv.' + inst.level);
  ok('  e com a vida cheia', inst.hp === inst.maxHp && inst.maxHp > 0, inst.maxHp + ' HP');
  /* ⚠️ O MOVESET É OBRIGATÓRIO: sem ele o dano dele sairia do poder implícito de 60, e o Lv.357 do
     nível 100 não significaria nada. */
  const oferece = S.ataquesDisponiveis(inst.speciesId, inst.level).length;
  ok('  e ele leva o moveset da espécie (`equiparNpc`)',
     oferece === 0 || (inst.ataques && inst.ataques.length > 0),
     (inst.ataques || []).length + ' de ' + oferece);
  /* ⚠️ E ELE NÃO HERDA A ESPECIALIDADE DO JOGADOR: ela é conquista da CONTA. */
  g.specialties = ['Electric'];
  const eletrico = S.arenaAdversario('2026-09-28', 1);
  ok('  e ele NÃO herda a especialidade do jogador', !eletrico.specialtyBuffed);
  g.specialties = [];
  ok('  e sem a semana não há adversário', S.arenaAdversario(null, 1) === null);
}

/* ============================================================================
   5) A PROGRESSAO NAO VALE NA TRAVESSIA -- a decisao mais delicada daqui
   ============================================================================ */
console.log('\n=== A TRAVESSIA CONTINUA COM O ADVERSÁRIO PAREADO ===');
(async () => {
  contaDeTeste(); semearSprites(); semana();
  g.screen = 'queimada';
  /* na ILHA: o adversário é o da semana */
  S.queimadaEscolher(0, 5);            /* o Shuckle, de BST 505 -- longe do bicho da semana */
  await S.queimadaComecar();
  const naIlha = S.queimada.atores[1];
  ok('na ilha o adversário é o da SEMANA',
     naIlha.inst.speciesId === S.arenaDaSemana(S.arenaRank.semanaId), naIlha.inst.speciesId);
  ok('  e no nível da escada', naIlha.inst.level === 60, 'Lv.' + naIlha.inst.level);
  S.queimadaTerminar();

  /* na TRAVESSIA: pareado por BST, no nível do pokémon do jogador */
  contaDeTeste(); semearSprites(); semana(null, 9);
  g.currentSaveSlot = 0;
  g.ilhasJornada = { volta: 'journeyEnd', vencidas: [], tentativas: {} };
  g.screen = 'queimada';
  S.queimadaEscolher(0, 5);
  await S.queimadaComecar();
  const naTrav = S.queimada.atores[1];
  ok('na travessia ele é PAREADO por BST', Math.abs(S.bstOf(naTrav.inst.speciesId) - S.bstOf('shuckle')) < 60,
     naTrav.inst.speciesId + ' (BST ' + S.bstOf(naTrav.inst.speciesId) + ' contra 505)');
  /* ⚠️ E NO NÍVEL DO POKÉMON DO JOGADOR, não no da escada: com o nível 9 a escada daria Lv.84. */
  ok('  e no nível do MEU pokémon, não no da escada', naTrav.inst.level === 55,
     'Lv.' + naTrav.inst.level + ' (a escada daria ' + S.arenaNivelDoAdversario(9) + ')');
  ok('  e a progressão não vale lá', S.arenaValeAqui() === false);
  S.queimadaTerminar();
  ok('  e vencer lá NÃO sobe nível', true);   /* medido pelo envio, abaixo */

  /* ---------- 6) sem o `semanaId` a partida nao larga ---------- */
  console.log('\n=== SEM A SEMANA A PARTIDA NÃO LARGA ===');
  contaDeTeste(); semearSprites();
  S.arenaRank.semanaId = null; S.arenaRank.lista = null; S.arenaRank.lidoEm = 0;
  g.screen = 'queimada';
  S.queimadaEscolher(0, 0);
  await S.queimadaComecar();
  ok('a partida não larga sem saber quem é o adversário', S.queimada.fase === 'setup',
     'fase: ' + S.queimada.fase);
  ok('  e a tela DIZ o motivo', /semana/i.test(String(S.queimada.aviso)), String(S.queimada.aviso));
  /* ⚠️ E NA TRAVESSIA ELA LARGA MESMO SEM A SEMANA: lá o adversário não depende dela. */
  contaDeTeste(); semearSprites();
  S.arenaRank.semanaId = null;
  g.currentSaveSlot = 0;
  g.ilhasJornada = { volta: 'journeyEnd', vencidas: [], tentativas: {} };
  g.screen = 'queimada';
  S.queimadaEscolher(0, 0);
  await S.queimadaComecar();
  ok('  mas na travessia ela larga (o adversário não depende da semana)',
     S.queimada.fase === 'jogando', 'fase: ' + S.queimada.fase);
  S.queimadaTerminar();

  /* ---------- 7) o envio ---------- */
  console.log('\n=== O ENVIO DA VITÓRIA ===');
  {
    const chamadas = [];
    const antes = S.functionsClient.httpsCallable;
    S.functionsClient.httpsCallable = (nome) => (dados) => {
      chamadas.push({ nome, dados });
      if(nome === 'submitArenaWin') return Promise.resolve({ data: { nivel: 4, subiu: true } });
      return Promise.resolve({ data: { lista: [], meu: null, nivel: 4, semanaId: '2026-09-21' } });
    };
    /* na ILHA, vencendo */
    contaDeTeste(); semana(null, 3);
    await S.arenaEnviarVitoria();
    const env = chamadas.filter(c => c.nome === 'submitArenaWin');
    ok('ele chama a callable', env.length === 1);
    /* ⚠️ O QUE VAI É UM BOOLEANO: aceitar o `nivel` seria deixar o cliente escrever o próprio lugar
       no ranking por outro caminho. */
    ok('  e o que vai é só um booleano', env.length === 1
       && Object.keys(env[0].dados).join(',') === 'venceu' && env[0].dados.venceu === true,
       JSON.stringify(env.length ? env[0].dados : null));
    ok('  e o nível novo vem do SERVIDOR', S.arenaRank.nivel === 4, String(S.arenaRank.nivel));
    /* na TRAVESSIA, nada */
    chamadas.length = 0;
    g.currentSaveSlot = 0;
    g.ilhasJornada = { volta: 'journeyEnd', vencidas: [], tentativas: {} };
    await S.arenaEnviarVitoria();
    ok('  e na travessia ele NÃO envia nada',
       chamadas.filter(c => c.nome === 'submitArenaWin').length === 0);
    /* sem login, nada */
    chamadas.length = 0; contaDeTeste(); g.authUser = null;
    await S.arenaEnviarVitoria();
    ok('  e sem login ele nem tenta',
       chamadas.filter(c => c.nome === 'submitArenaWin').length === 0);
    S.functionsClient.httpsCallable = antes;
  }
  /* ⚠️ SÓ A VITÓRIA MEXE NO NÍVEL, e a chamada mora colada no resultado -- um caso de comportamento
     passaria com a chamada órfã. */
  ok('  e o `queimadaTerminar` só envia quando vence',
     /if\(queimadaVencedor\(\) > 0\) arenaEnviarVitoria\(\);/.test(src));

  /* ---------- 8) a tela ---------- */
  console.log('\n=== A TELA ===');
  {
    /* ⚠️ O ZERAR NÃO É ENFEITE: o bloco anterior terminou uma partida, e o `queimadaTerminar`
       deixa a fase em 'anuncio' -- sem ele o render cai no ramo da QUADRA e a trava mede a tela
       errada. O `contaDeTeste` mexe no `game`, não no estado da partida. */
    S.queimadaZerar();
    contaDeTeste(); semearSprites(); semana(null, 3);
    S.arenaRank.lista = [{ pos: 1, uid: 'a', nome: 'Ana', nivel: 9, eu: false },
                         { pos: 2, uid: 'u1', nome: 'Buzzo', nivel: 3, eu: true }];
    g.screen = 'queimada';
    S.queimadaEscolher(0, 0);
    const h = S.renderQueimada();
    const bicho = SP[S.arenaDaSemana(S.arenaRank.semanaId)].name;
    ok('o setup mostra o pokémon da semana', h.indexOf(bicho) >= 0, bicho);
    ok('  e o nível DELE, que sai da escada', h.indexOf('Lv.' + S.arenaNivelDoAdversario(3)) >= 0,
       'Lv.' + S.arenaNivelDoAdversario(3));
    /* ⚠️ O SPRITE É GRANDE (24/09/2026, a pedido) -- o `sprite-lg`, o maior que a casa tem. A trava
       cobra a CLASSE e não o tamanho em px: o px vive no CSS, e cravá-lo aqui faria ela envelhecer
       no primeiro ajuste.
       ⚠️ E A FATIA VAI ATÉ O FIM DA CAIXA (o próximo `<div class="box`), nunca até o ranking: a caixa
       do PARCEIRO fica no meio das duas, e ela tem um `sprite-sm` legítimo -- a primeira versão desta
       trava acusava ELE, com o código certo. É a armadilha do padrão largo demais. */
    const depoisDoH2 = h.slice(h.indexOf('Pokémon da semana'));
    const fim = depoisDoH2.indexOf('<div class="box');
    const caixa = fim > 0 ? depoisDoH2.slice(0, fim) : depoisDoH2;
    ok('  (a fatia é só a caixa da semana)', caixa.length > 200 && caixa.indexOf('Níveis') < 0,
       caixa.length + ' chars');
    ok('  com o sprite GRANDE (sprite-lg, e nenhum sprite-sm nela)',
       caixa.indexOf('sprite-lg') >= 0 && caixa.indexOf('sprite-sm') < 0);
    /* ⚠️ E O MEU NÍVEL SAI DESTACADO, não como legenda: ele é o número que decide o adversário. */
    ok('  e o MEU nível, com destaque próprio', /arena-meu-num">3</.test(h));
    ok('    e com o rótulo em cima dele (o número não precisa de contexto)',
       h.indexOf('arena-meu-rotulo') >= 0 && /SEU N[IÍ]VEL/i.test(h));
    ok('  e o ranking da semana', h.indexOf('Níveis da semana') >= 0 && h.indexOf('Ana') >= 0
       && h.indexOf('nível 9') >= 0);
    /* ⚠️ A NOTA DO PRÊMIO É A MESMA DOS OUTROS TRÊS (24/09/2026): a Arena passou a pagar, e uma tela
       que esconde o prêmio não convida ninguém. O "com o Pokémon novo" fica como segunda linha --
       ele é o que ESTA Arena tem de diferente (lá zera o placar, aqui zera o ADVERSÁRIO). */
    ok('  e a nota do prêmio, a MESMA dos outros três rankings',
       h.indexOf('Lidere até o fim da semana e ganhe Doces Raros') >= 0);
    ok('    e ela diz o que ESTA Arena tem de diferente (o Pokémon novo)',
       h.indexOf('com o Pokémon novo') >= 0);
    /* ⚠️ NÃO HÁ ABA "DE SEMPRE": um ranking de sempre compararia níveis contra espécies diferentes. */
    ok('  e ele NÃO tem aba de "de sempre"', h.indexOf('De sempre') < 0);
    /* ⚠️ E AS DUAS CAIXAS NÃO APARECEM NA TRAVESSIA: lá o adversário é pareado e continua surpresa. */
    g.currentSaveSlot = 0;
    g.ilhasJornada = { volta: 'journeyEnd', vencidas: [], tentativas: {} };
    const hT = S.renderQueimada();
    ok('  e na travessia nenhuma das duas aparece',
       hT.indexOf('Pokémon da semana') < 0 && hT.indexOf('Níveis da semana') < 0);
    g.ilhasJornada = null; g.currentSaveSlot = null;
    /* o erro oferece saída, e o vazio fala da SEMANA */
    S.arenaRank.erro = 'x';
    ok('  e o erro oferece "Tentar de novo"',
       /arenaCarregarRank\(true\)/.test(S.renderQueimada()));
    S.arenaRank.erro = null; S.arenaRank.lista = [];
    ok('  e o vazio fala da SEMANA, não de "nunca"',
       /nesta semana/i.test(S.renderQueimada()));
    /* ⚠️ E O VAZIO TAMBÉM CONVIDA: sem a nota, a primeira semana de um jogador abriria uma caixa que
       só diz "ninguém venceu" -- e é justamente ali que o prêmio é o argumento pra jogar. */
    ok('    e ele convida com o prêmio',
       S.renderQueimada().indexOf('ganhe Doces Raros') >= 0);
    /* ⚠️ O CSS: tamanho de src e centralização NÃO aparecem em asserção de HTML nenhuma -- é a
       lição do `[hidden]` que deixou o modal da contagem da Corrida preso na tela. */
    const css = src.slice(src.indexOf('<style'), src.indexOf('</style>'));
    const regra = (sel) => {
      const i = css.indexOf(sel + '{');
      return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
    };
    ok('  e a caixa CENTRALIZA por conta própria (o `.box` não é center)',
       /text-align:\s*center/.test(regra('.arena-semana')), regra('.arena-semana') || '(sem regra)');
    /* ⚠️ E O NÚMERO É MAIOR QUE O RÓTULO: um piso, nunca o valor exato -- cravá-lo faria a trava
       envelhecer no primeiro ajuste, a família que já caiu meia dúzia de vezes aqui. */
    const rem = (sel) => parseFloat((regra(sel).match(/font-size:\s*([\d.]+)rem/) || [, 0])[1]);
    ok('  e o número do nível é bem maior que o rótulo dele',
       rem('.arena-meu-num') >= 1.2 && rem('.arena-meu-num') > rem('.arena-meu-rotulo') * 2,
       rem('.arena-meu-num') + 'rem contra ' + rem('.arena-meu-rotulo') + 'rem');
    /* ⚠️ E UM RISCO SEPARA AS DUAS INFORMAÇÕES da caixa -- o ADVERSÁRIO em cima e EU embaixo. Sem
       ele o "SEU NÍVEL" se lê como continuação do card do bicho, e isso NÃO aparece em asserção de
       HTML nenhuma: foi a captura de tela que pegou. */
    ok('  e um risco separa o adversário do MEU nível',
       /border-top:\s*\d+px dashed/.test(regra('.arena-meu')), regra('.arena-meu') || '(sem regra)');
    /* ⚠️ E A NOTA DO PRÊMIO VIVE NUMA FUNÇÃO SÓ: ela tem DOIS leitores desde que a Arena passou a
       pagar, e o que ela promete é um PRÊMIO -- duas cópias divergiriam e o jogador não saberia
       qual das duas telas vale. */
    ok('  e os DOIS leitores da nota leem a MESMA função',
       (src.match(/notaDoPremioSemanal\(/g) || []).length >= 4,
       (src.match(/notaDoPremioSemanal\(/g) || []).length + ' usos');
    /* ⚠️ E A FRASE EXISTE UMA VEZ SÓ no arquivo -- é isso que prova que não há cópia. A primeira
       versão desta trava procurava a frase FORA da função e acusava a PRÓPRIA função que ela mede:
       a armadilha do padrão largo demais, dentro da trava. */
    ok('    e a frase do prêmio existe UMA vez só (nenhuma cópia)',
       (src.match(/Lidere até o fim da semana e ganhe Doces Raros/g) || []).length === 1,
       (src.match(/Lidere até o fim da semana e ganhe Doces Raros/g) || []).length + ' ocorrência(s)');
  }

  /* ---------- 9) a abertura ---------- */
  console.log('\n=== A ABERTURA ===');
  {
    /* ⚠️ ELA INVALIDA E LÊ: o nível e o bicho mudam entre duas aberturas. Lido do código porque o
       `render` do sandbox é um no-op e a callable é de rede. */
    const trecho = src.slice(src.indexOf('function abrirQueimada(){'));
    const corpo = trecho.slice(0, trecho.indexOf('}'));
    ok('ela invalida o ranking', corpo.indexOf('rankInvalidar(arenaRank)') >= 0);
    ok('  e manda ler de novo', corpo.indexOf('arenaCarregarRank(true)') >= 0);
    ok('  e zera o selo de "subiu"', corpo.indexOf('arenaRank.subiu = false') >= 0);
  }

  /* ---------- 10) o servidor ---------- */
  console.log('\n=== O SERVIDOR ===');
  {
    ok('as duas callables existem',
       /exports\.submitArenaWin = onCall/.test(srvSrc) && /exports\.getArenaRanking = onCall/.test(srvSrc));
    /* ⚠️ UM `orderBy` SÓ: dois em campos diferentes exigem índice composto, e o primeiro que este
       projeto precisou nasceu quebrado. */
    const fatia = srvSrc.slice(srvSrc.indexOf('async function lerRankArena'));
    const corpo = fatia.slice(0, fatia.indexOf('exports.submitArenaWin'));
    ok('  e a leitura tem o que ler', corpo.length > 200, corpo.length + ' chars');
    ok('  e ela usa UM `orderBy` só (sem índice composto)',
       (corpo.match(/\.orderBy\(/g) || []).length === 1);
    /* ⚠️ A TRANSAÇÃO É OBRIGATÓRIA: o que se escreve depende do que se leu. */
    const f2 = srvSrc.slice(srvSrc.indexOf('exports.submitArenaWin'));
    const c2 = f2.slice(0, f2.indexOf('exports.getArenaRanking'));
    ok('  e a subida é em TRANSAÇÃO', c2.indexOf('runTransaction') >= 0);
    ok('  e ela tem TETO', /ARENA_NIVEL_MAX/.test(c2) && /const ARENA_NIVEL_MAX = \d+/.test(srvSrc));
    /* ⚠️ `venceu` LIDO COMO BOOLEANO ESTRITO: um `'sim'` seria truthy. */
    ok('  e `venceu` é lido como booleano estrito',
       /\(request\.data \|\| \{\}\)\.venceu === true/.test(c2));
    /* ⚠️ ELE ENTRA NO `RANKS_SEMANAIS` desde 24/09/2026 (a pedido), e esta trava era a INVERSA -- ela
       cobrava que ele ficasse FORA, porque prêmio não tinha sido pedido. Ela não foi apagada: virou
       a trava da regra nova, senão alguém o tira da lista e o prêmio para de sair EM SILÊNCIO -- o
       cron não reclama de uma entrada que não existe. O `test-arena-rank` mede o pagamento; aqui se
       mede só que ele está na lista que o cron varre. */
    const rs = srvSrc.slice(srvSrc.indexOf('const RANKS_SEMANAIS'));
    ok('  e ele ENTRA na lista que o cron fecha e paga',
       rs.slice(0, rs.indexOf('];')).indexOf("base: 'arenaRanking'") >= 0);
    /* as regras */
    const regras = require('fs').readFileSync(path.join(raiz, 'firestore.rules'), 'utf8');
    const m = regras.match(/match \/arenaRankingWeekly\/\{semanaId\} \{[\s\S]*?\n    \}/);
    ok('  e as regras fecham a escrita pra TODOS', !!m
       && (m[0].match(/allow write: if false;/g) || []).length === 2
       && (m[0].match(/allow read: if request\.auth != null;/g) || []).length === 2,
       m ? 'ok' : 'a regra não existe');
  }

  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
  process.exit(falhas ? 1 : 0);
})();
