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

console.log('');
console.log(falhas ? falhas + ' FALHA(S).' : 'Tudo certo.');
process.exit(falhas ? 1 : 0);
