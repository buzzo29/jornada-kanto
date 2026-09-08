#!/usr/bin/env node
/**
 * O QUE ACONTECE DEPOIS DA BATALHA
 *
 * Duas coisas, as duas reportadas em 08/09/2026:
 *
 * 1) O +1 NÍVEL DO DESMAIO PODE SER O NÍVEL DA EVOLUÇÃO -- e não evoluía ninguém.
 *    O pokémon caía, subia de nível e continuava na forma antiga. A evolução só saía na
 *    distribuição de níveis da etapa SEGUINTE (é o confirmLevels que roda o tryEvolve no time
 *    todo), e depois da vitória do último ginásio, da Elite ou de um esconderijo da Rocket não
 *    saía nunca: ali não há distribuição nenhuma depois.
 *    Agora ela acontece no MESMO lugar em que o nível é dado, nos dois caminhos de batalha, e é
 *    anunciada logo depois do log -- na tela de evolução de sempre.
 *
 * 2) A TORRE ERA A ÚNICA BATALHA SEM LOG DEPOIS. A animação passava e o jogador voltava direto
 *    pra torre; a jornada, a Elite, o ginásio da cidade, o online e a raide todos têm o seu.
 *
 *   node tools/test-pos-batalha.js
 */
const { createSandbox } = require('./game-sandbox');
const S = createSandbox();

let falhas = 0;
function ok(titulo, cond, extra){
  if(cond){ console.log('  OK     ' + titulo + (extra ? '   ' + extra : '')); }
  else { falhas++; console.log('  FALHOU ' + titulo + (extra ? '   ' + extra : '')); }
}

/* Um save no meio da jornada, com o time que o teste pedir. `caiu` é quem termina a batalha em 0
   de HP -- é ele que ganha o +1 e, se der o nível, evolui. */
function jornada(time, { caiu = [0], win = false, gymIndex = 0 } = {}){
  const g = S.__getGame();
  g.authUser = null;              // sem conta: nada de rede no meio do teste
  g.currentSaveSlot = 0;
  g.gymIndex = gymIndex;
  g.gymPath = ['kanto','kanto','kanto','kanto','kanto','kanto','kanto','kanto'];
  g.team = time;
  /* O createInstance nasce com hp E maxHp ZERADOS -- eles só são calculados na entrada da batalha.
     Sem preencher aqui, "p.hp <= 0" vale pra TODO MUNDO e o teste diria que quem nem lutou
     desmaiou. Custou os dois primeiros casos deste arquivo. */
  g.team.forEach((p, i) => { p.maxHp = S.calcMaxHp(p); p.hp = caiu.includes(i) ? 0 : p.maxHp; });
  g.battleResult = {
    win, matchups: [],
    playerStatus: g.team.map(p => ({ speciesId:p.speciesId, name:p.name, level:p.level, fainted:p.hp<=0 })),
    brockStatus: []
  };
  g.screen = 'battling';
  g.losses = 0; g.lossesTotal = 0; g.badgesEarned = [];
  g.evolutions = []; g.evolucaoDepois = null;
  g.moedasGanhasAgora = 0;
  S.__setGame(g);
}
const jogo = () => S.__getGame();

console.log('');
console.log('=== O +1 DO DESMAIO EVOLUI, E NA HORA ===');
{
  /* O caso reportado: um Charmeleon nível 35 desmaia, vira 36 -- que é o nível do Charizard. */
  jornada([S.createInstance('charmeleon', 35), S.createInstance('pidgey', 12)]);
  S.finishBattle();
  ok('o pokemon que desmaiou subiu de nivel', jogo().team[0].level === 36, 'Lv.' + jogo().team[0].level);
  ok('e EVOLUIU na hora, sem esperar a proxima distribuicao',
     jogo().team[0].speciesId === 'charizard', jogo().team[0].speciesId);
  ok('a evolucao entrou na lista pra ser anunciada',
     (jogo().evolutions || []).length === 1 && jogo().evolutions[0].toName === 'Charizard',
     JSON.stringify(jogo().evolutions));
  /* Os ATRIBUTOS acompanham: sem isso o pokémon lutaria como Charmeleon com cara de Charizard. */
  ok('e os atributos sao os da forma nova',
     jogo().team[0].attack === S.SPECIES.charizard.attack && jogo().team[0].baseHp === S.SPECIES.charizard.hp,
     jogo().team[0].attack + '/' + jogo().team[0].baseHp);
  /* Quem NÃO desmaiou não sobe nem evolui -- o nível é da experiência de ter caído. */
  ok('quem nao desmaiou nao subiu', jogo().team[1].level === 12 && jogo().team[1].speciesId === 'pidgey');

  /* O SPRITE DO LOG continua sendo o da forma que lutou: a batalha aconteceu com o Charmeleon, e a
     forma nova é anunciada na tela seguinte. */
  ok('o log continua mostrando quem lutou, nao quem ele virou',
     jogo().battleResult.playerStatus[0].speciesId === 'charmeleon',
     jogo().battleResult.playerStatus[0].speciesId);
}

console.log('');
console.log('=== A EVOLUCAO E ANUNCIADA LOGO DEPOIS DO LOG ===');
{
  jornada([S.createInstance('charmeleon', 35)]);
  S.finishBattle();
  ok('a batalha termina na tela de derrota (o log)', jogo().screen === 'defeat', jogo().screen);
  S.seguirDoResultado('retry');
  ok('o botao do resultado leva pra tela de evolucao', jogo().screen === 'evolution', jogo().screen);
  ok('e ela nomeia quem evoluiu', /Charmeleon[\s\S]*Charizard/.test(S.renderEvolution()),
     (S.renderEvolution().match(/atingiu[^<]*/)||[''])[0]);
  S.continueFromEvolution();
  ok('e so DEPOIS vem a distribuicao de niveis', jogo().screen === 'levels', jogo().screen);
  ok('o destino e limpo depois de usado', jogo().evolucaoDepois === null);
  /* Sem isso a próxima tela de resultado repetiria a evolução desta. */
  ok('e a lista de evolucoes tambem', (jogo().evolutions || []).length === 0);
}

console.log('');
console.log('=== SEM EVOLUCAO, NENHUMA TELA A MAIS ===');
{
  /* O caminho comum: quem desmaia e não bate no nível da evolução segue direto. Uma tela de
     "seu time evoluiu!" vazia a cada derrota seria pior que o defeito. */
  jornada([S.createInstance('pidgey', 12)]);
  S.finishBattle();
  ok('ninguem evoluiu', (jogo().evolutions || []).length === 0);
  S.seguirDoResultado('retry');
  ok('e o botao vai direto pro destino', jogo().screen === 'levels', jogo().screen);
}

console.log('');
console.log('=== OS TRES DESTINOS DA TELA DE RESULTADO ===');
{
  /* Cada botão do resultado tem um destino próprio, e a evolução não pode trocá-lo. */
  jornada([S.createInstance('charmeleon', 35)], { win:true, gymIndex:0 });
  S.finishBattle();
  ok('vitoria com proximo ginasio: a tela e a de vitoria', jogo().screen === 'victory', jogo().screen);
  S.seguirDoResultado('continueJourney');
  ok('passa pela evolucao', jogo().screen === 'evolution');
  S.continueFromEvolution();
  ok('e segue a jornada (proxima etapa)', jogo().gymIndex === 1, 'etapa ' + jogo().gymIndex);

  /* O ÚLTIMO ginásio é o caso que mais doía: depois dele não existe distribuição de níveis
     nenhuma, então a evolução que não acontecesse aqui não aconteceria nunca. */
  jornada([S.createInstance('charmeleon', 35)], { win:true, gymIndex:7 });
  S.finishBattle();
  ok('no oitavo ginasio o pokemon tambem evolui', jogo().team[0].speciesId === 'charizard');
  S.seguirDoResultado('journeyEnd');
  ok('e a evolucao aparece antes do resumo', jogo().screen === 'evolution');
  S.continueFromEvolution();
  ok('que e pra onde o botao ia', jogo().screen === 'journeyEnd', jogo().screen);
}

console.log('');
console.log('=== A BIFURCACAO TAMBEM VALE AQUI ===');
{
  /* Gloom vira Vileplume OU Bellossom, e quem escolhe é o jogador. Se o +1 do desmaio cai
     justamente no nível 40, a escolha tem que aparecer -- é o motivo de a evolução ser anunciada
     na tela de sempre e não numa caixa dentro do resultado: caixa não escolhe nada. */
  jornada([S.createInstance('gloom', 39)]);
  S.finishBattle();
  ok('o Gloom parou na bifurcacao em vez de virar Vileplume sozinho',
     jogo().team[0].speciesId === 'gloom' && jogo().team[0].pendingEvoChoice === 'gloom',
     jogo().team[0].speciesId + '/' + jogo().team[0].pendingEvoChoice);
  S.seguirDoResultado('retry');
  ok('e o botao leva pra tela de ESCOLHA', jogo().screen === 'evoChoice', jogo().screen);
  S.escolherEvolucao(jogo().team[0].id, 'bellossom');
  ok('escolhendo, ele vira o que foi escolhido', jogo().team[0].speciesId === 'bellossom');
  ok('e a tela segue pro anuncio', jogo().screen === 'evolution', jogo().screen);
  S.continueFromEvolution();
  ok('e dali pro destino do botao', jogo().screen === 'levels', jogo().screen);
}

console.log('');
console.log('=== A ELITE E A ROCKET TAMBEM (o caminho especial) ===');
{
  /* O bloco especial (Elite, Rocket, esconderijo, rival) dá o +1 do desmaio no SEU proprio lugar.
     Deixar a evolução só no ginásio era garantir que a Elite -- onde mais gente desmaia, cinco
     lutas seguidas sem cura -- ficasse com o defeito. */
  const g = S.__getGame();
  g.authUser = null; g.currentSaveSlot = 0; g.gymIndex = 7;
  g.team = [S.createInstance('charmeleon', 35)];
  g.team[0].maxHp = S.calcMaxHp(g.team[0]); g.team[0].hp = 0;
  g.specialBattle = { context:'rival', meta:{ opponentName:'Rafael' } };
  g.specialBattleResult = { win:false, matchups:[],
    playerStatus:[{ speciesId:'charmeleon', name:'Charmeleon', level:35, fainted:true }], brockStatus:[] };
  g.specialHpBeforeBattle = null;
  g.evolutions = []; g.evolucaoDepois = null; g.screen = 'specialBattling';
  S.__setGame(g);
  S.finishSpecialBattle();
  ok('quem desmaiou numa batalha especial tambem evolui',
     jogo().team[0].speciesId === 'charizard', jogo().team[0].speciesId);
  ok('e a tela e a do resultado especial', jogo().screen === 'specialResult', jogo().screen);
  S.seguirDoResultado('special');
  ok('o botao passa pela evolucao', jogo().screen === 'evolution', jogo().screen);
}

console.log('');
console.log('=== A EVOLUCAO LEVA A VELOCIDADE JUNTO ===');
{
  /* Achado em 08/09/2026 varrendo os saves de producao: o effectiveSpeed le p.speed -- o valor da
     INSTANCIA, escrito pelo createInstance --, e o tryEvolve atualizava os outros cinco atributos e
     esquecia esse. Todo pokemon que evoluiu neste jogo lutava com a velocidade da forma anterior.
     Atinge 107 dos 112 degraus (96%), desvio medio de 20,8 e pior caso 70 (Sentret 20 -> Furret 90).
     E ela nao decide so quem bate primeiro: entra na taxa de critico (velocidade/512, Gen 1). */
  const p = S.createInstance('golbat', 39); p.level = 45;
  S.tryEvolve(p);
  ok('o Crobat corre como Crobat, nao como Golbat',
     p.speciesId === 'crobat' && p.speed === S.SPECIES.crobat.speed,
     p.speciesId + ' vel ' + p.speed + ' (Crobat ' + S.SPECIES.crobat.speed + ', Golbat ' + S.SPECIES.golbat.speed + ')');
  /* Vale nos DOIS sentidos: ha 6 degraus que desaceleram, e o Scizor e o extremo (105 -> 65). */
  const s = S.createInstance('scyther', 39); s.level = 45;
  S.tryEvolve(s);
  ok('e o Scizor desacelera de verdade', s.speed === S.SPECIES.scizor.speed,
     'vel ' + s.speed + ' (Scizor ' + S.SPECIES.scizor.speed + ')');
  /* Os SEIS atributos, nas 250 especies e em todo nivel -- e o unico jeito de a proxima omissao ser
     barulhenta em vez de esperar alguem varrer os saves de novo. */
  {
    let erros = 0, quantos = 0, primeiro = '';
    Object.keys(S.SPECIES).forEach(id => {
      for(let n = 1; n <= 99; n++){
        const m = S.createInstance(id, n); S.tryEvolve(m);
        if(m.speciesId === id) continue;
        quantos++;
        const sp = S.SPECIES[m.speciesId];
        if(m.speed!==sp.speed || m.attack!==sp.attack || m.defense!==sp.defense ||
           m.spAtk!==sp.spAtk || m.spDef!==sp.spDef || m.baseHp!==sp.hp){
          erros++; if(!primeiro) primeiro = id+' Lv.'+n+' -> '+m.speciesId;
        }
      }
    });
    ok('e nenhuma evolucao deixa atributo pra tras', erros === 0,
       primeiro || quantos + ' evolucoes conferidas');
  }
}

console.log('');
console.log('=== O BONUS DE KANTO TAMBEM EVOLUI ===');
{
  /* Ele e a ULTIMA coisa que sobe nivel na jornada: depois dele nao existe distribuicao nenhuma, e
     era o confirmLevels que evoluia o time. A evolucao que nao saisse ali nao sairia NUNCA -- foi
     assim que um Pupitar terminou a jornada no nivel 59 sem virar Tyranitar. */
  const g = S.__getGame();
  g.authUser = null; g.currentSaveSlot = 0; g.gymIndex = 7;
  g.team = [S.createInstance('pupitar', 53)];
  g.team[0].maxHp = S.calcMaxHp(g.team[0]); g.team[0].hp = g.team[0].maxHp;
  g.lossesTotal = 0;              // 0 derrotas = +4 niveis, o bolo cheio
  g.kantoBonusApplied = false; g.badgesEarned = ['a','b','c','d','e','f','g','h'];
  g.evolutions = []; g.evolucaoDepois = null; g.screen = 'victory';
  S.__setGame(g);
  S.showJourneyEnd();
  ok('o bonus levou o Pupitar de 53 pra 57', jogo().team[0].level === 57, 'Lv.' + jogo().team[0].level);
  ok('e ele virou Tyranitar', jogo().team[0].speciesId === 'tyranitar', jogo().team[0].speciesId);
  ok('a tela mostra a evolucao antes do resumo', jogo().screen === 'evolution', jogo().screen);
  S.continueFromEvolution();
  ok('e dali vai pro resumo da jornada', jogo().screen === 'journeyEnd', jogo().screen);
  /* Reabrir o resumo nao pode dar o bonus de novo nem reabrir a tela de evolucao (kantoBonusApplied). */
  S.showJourneyEnd();
  ok('e reabrir o resumo nao repete nada',
     jogo().screen === 'journeyEnd' && jogo().team[0].level === 57,
     jogo().screen + '/Lv.' + jogo().team[0].level);
}

console.log('');
console.log('=== A TORRE PASSOU A TER LOG DEPOIS DA BATALHA ===');
{
  const meu = S.createInstance('charizard', 70), npc = S.createInstance('onix', 68);
  const r = S.simulateGymBattle([meu], [npc]);
  const g = S.__getGame();
  g.trainerBattleResult = { matchups:r.matchups, win:r.win };
  g.towerBattle = { floor:7, npcName:'Yuri', win:r.win, run:{ floor: r.win?8:7, cleared:false } };
  g.trainerBattleOpponentName = 'Yuri';
  g.towerBattlePending = true; g.screen = 'trainerBattling';
  S.__setGame(g);
  S.finishTrainerBattle();
  ok('a batalha da Torre nao volta mais direto pra torre', jogo().screen === 'towerBattleResult', jogo().screen);

  const h = S.renderTowerBattleResult();
  ok('a tela tem o log da batalha', /Log da batalha/.test(h) && /matchup-row/.test(h));
  ok('e o andar no titulo', /ANDAR 7/.test(h), (h.match(/result-banner[^>]*>[^<]*/)||[''])[0]);
  ok('e o nome do NPC no time adversario', /Time de Yuri/.test(h));
  /* Os dois times saem do LOG: a Torre não devolve playerStatus nem brockStatus prontos. Sem
     derivar, os dois quadros sairiam vazios -- que é o que aconteceria reusando a tela do
     resultado de treinador sem mais nada. */
  ok('os dois times aparecem, derivados do log',
     (h.match(/save-slot-team-row/g)||[]).length === 2,
     (h.match(/save-slot-team-row/g)||[]).length + ' quadros');
  ok('e o botao volta pra Torre', /voltarDoAndarDaTorre\(\)/.test(h));
  S.voltarDoAndarDaTorre();
  ok('que e o que ele faz', jogo().screen === 'trainerTower', jogo().screen);

  /* Zerar a torre tem frase própria: "o próximo andar já está esperando" seria mentira ali. */
  const g2 = S.__getGame();
  g2.towerBattle = { floor:30, npcName:'Yuri', win:true, run:{ floor:30, cleared:true } };
  g2.trainerBattleResult = { matchups:r.matchups, win:true };
  S.__setGame(g2);
  ok('quem zerou a torre le que chegou ao topo', /topo da torre/.test(S.renderTowerBattleResult()));
}

/* O REPARO E ASSINCRONO (ele regrava os saves), entao ele e o placar vao pro fim, num bloco so. */
(async () => {
  console.log('');
  console.log('=== O REPARO DOS SAVES QUE JA ESTAVAM PRESOS ===');
  /* Medido em 08/09/2026, antes das correcoes, varrendo a producao: 22 pokemon presos em 17 saves
     de 15 treinadores (1.103 pokemon em 194 saves). 14 dos 17 saves estao em journeyEnd -- jornada
     terminada, nenhuma distribuicao de niveis nunca mais. Fechar a torneira nao conserta o que ja
     vazou, e por isso o reparo existe. */
  const esp = (id) => S.SPECIES[id];
  const monDe = (id, level) => ({ id:'m_'+id, speciesId:id, name:esp(id).name, level,
    types:esp(id).types, baseHp:esp(id).hp, attack:esp(id).attack, defense:esp(id).defense,
    spAtk:esp(id).spAtk, spDef:esp(id).spDef, speed:esp(id).speed, maxHp:0, hp:0 });

  const g = S.__getGame();
  g.authUser = { uid:'u1' };
  g.currentSaveSlot = null;
  g.caughtSpecies = ['pikachu'];
  g.saveSlots = new Array(20).fill(null);
  g.saveSlots[4] = { team:[ monDe('pupitar', 61), monDe('pikachu', 30) ], screen:'journeyEnd', badgeCount:8 };
  /* Um save com BIFURCACAO pendente: o Gloom passou do 40 e ninguem pode escolher por ele. */
  g.saveSlots[7] = { team:[ monDe('gloom', 52) ], screen:'journeyEnd', badgeCount:8 };
  g.evolucoesReparadas = null;
  S.__setGame(g);
  S.__escritas.length = 0;

  await S.repararEvolucoesAtrasadas();
  const slotsGravados = S.__escritas.map(e => e.caminho);

  const t4 = jogo().saveSlots[4].team;
  ok('o Pupitar Lv.61 virou Tyranitar', t4[0].speciesId === 'tyranitar', t4[0].speciesId);
  ok('com os atributos e a VELOCIDADE da forma nova',
     t4[0].speed === S.SPECIES.tyranitar.speed && t4[0].attack === S.SPECIES.tyranitar.attack,
     t4[0].speed + '/' + t4[0].attack);
  ok('e o teto de vida recalculado', t4[0].maxHp === S.calcMaxHp(t4[0]), String(t4[0].maxHp));
  ok('quem nao devia nada ficou como estava', t4[1].speciesId === 'pikachu' && t4[1].level === 30);
  /* A BIFURCACAO fica de fora: escolher Vileplume ou Bellossom por alguem num save que ele nem
     abriu seria decidir a coisa mais definitiva do jogo no lugar dele. */
  ok('o Gloom da bifurcacao NAO foi resolvido sozinho',
     jogo().saveSlots[7].team[0].speciesId === 'gloom', jogo().saveSlots[7].team[0].speciesId);
  ok('e o save dele nao foi regravado a toa', slotsGravados.indexOf('7') < 0, JSON.stringify(slotsGravados));
  ok('o save consertado FOI regravado', slotsGravados.indexOf('4') >= 0, JSON.stringify(slotsGravados));
  /* O tryEvolve chama markCaught, que escreve na Pokedex do SAVE CARREGADO -- e aqui nao ha save
     carregado. Sem devolver o campo, a Pokedex de um save receberia especie de outro. */
  ok('e a Pokedex do save nao foi contaminada',
     (jogo().caughtSpecies || []).join(',') === 'pikachu', (jogo().caughtSpecies||[]).join(','));
  /* O jogador TEM que saber: um Scyther que vira Scizor troca de tipo (Inseto/Voador ->
     Inseto/Aco) e de atributos. Achar que o pokemon sumiu e pior que o defeito. */
  ok('o aviso guarda o que mudou', (jogo().evolucoesReparadas || []).length === 1 &&
     jogo().evolucoesReparadas[0].para === 'Tyranitar', JSON.stringify(jogo().evolucoesReparadas));
  const home = S.renderSaveSelect();
  ok('e a home mostra', /Evolu\u00e7\u00f5es em atraso/.test(home) && /Tyranitar/.test(home),
     (home.match(/virou <strong>[^<]*/)||[''])[0]);
  S.fecharAvisoDeReparo();
  ok('e o aviso sai quando o jogador fecha', !/Evolu\u00e7\u00f5es em atraso/.test(S.renderSaveSelect()));

  /* Rodar de novo nao pode reescrever nada: nao ha mais o que consertar, e o reparo roda em TODO
     carregamento da home. */
  S.__escritas.length = 0;
  await S.repararEvolucoesAtrasadas();
  ok('rodar o reparo de novo nao regrava save nenhum', S.__escritas.length === 0,
     String(S.__escritas.length));

  /* E ELE PRECISA ESTAR LIGADO. Os casos acima chamam a funcao direto, entao passariam com ela
     orfa -- conferido: tirar a chamada do loadSaveSlots nao quebrava nenhum deles. A trava le o
     CODIGO, que e como este projeto ja garante o applySpecialtyBuff e o equiparItens nas chamadas
     de batalha: e o unico jeito de a proxima remocao ser barulhenta. */
  {
    const fonte = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'index.html'), 'utf8');
    const i = fonte.indexOf('async function loadSaveSlots(');
    const corpo = i < 0 ? '' : fonte.slice(i, fonte.indexOf('\nasync function repararEvolucoesAtrasadas', i));
    ok('e o loadSaveSlots CHAMA o reparo', /repararEvolucoesAtrasadas\(\)/.test(corpo),
       corpo ? corpo.length + ' chars lidos' : 'nao achei o loadSaveSlots');
  }

  console.log('');
  console.log(falhas ? falhas + ' FALHA(S).' : 'Tudo certo.');
  process.exit(falhas ? 1 : 0);
})();
