/**
 * AS CONQUISTAS -- cada uma acende SÓ quando devia.
 *
 * Por que isso existe: conquista errada e conquista que nunca acende sao os dois defeitos mais
 * silenciosos do jogo. Ninguem reclama de uma conquista que nao acendeu (nao da pra saber que ela
 * devia ter acendido), e uma que acende de graca so aparece quando ja foi distribuida pra todo
 * mundo. Tudo aqui sai de estado do save, entao da pra montar o save e conferir.
 *
 * O que fica trancado: as conquistas de CAMINHO (so Kanto, so Johto, 4+4) e de COMPOSICAO (time
 * todo de Kanto, todo de Johto, monotipo), que o time congelado na vitoria alimenta; que save
 * antigo -- sem esse campo -- cai no time atual em vez de perder o que ja tinha; e que nenhum id
 * de conquista repete.
 *
 *   node tools/test-conquistas.js
 */
const { createSandbox } = require('./game-sandbox');

const S = createSandbox();
const g = S.__getGame();

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const conquista = id => S.ACHIEVEMENTS.find(c=>c.id===id);
// monta a conta com os saves dados e devolve quais conquistas acendem
function acendeu(id, slots, dexExtra){
  g.saveSlots = slots;
  g.permanentPokedex = dexExtra || [];
  g.permanentShinyDex = [];
  g.trainerBestStreak = 0; g.leagueWinsTotal = 0;
  g.bossTop10 = false; g.bossKiller = false;
  S.__setGame(g);
  const agg = S.getAchievementAggregate();
  return !!conquista(id).check(agg, {});
}
const campeao = (extra) => Object.assign({
  eliteStatus:'champion', badgeCount:8, team:[], caughtSpecies:[], eliteAttemptsUsed:1
}, extra);
const oito = r => new Array(8).fill(r);

console.log('\nTODA CONQUISTA TEM ID PROPRIO');
const ids = S.ACHIEVEMENTS.map(c=>c.id);
ok('nenhum id repetido', new Set(ids).size === ids.length,
   ids.filter((x,i)=>ids.indexOf(x)!==i).join(', ') || String(ids.length) + ' conquistas');
ok('toda conquista tem nome, descricao e teste',
   S.ACHIEVEMENTS.every(c=>c.name && c.desc && typeof c.check === 'function'));

console.log('\nO CAMINHO DA JORNADA');
ok('so ginasios de Kanto', acendeu('elite_path_kanto', [campeao({ gymPath: oito('kanto') })]));
ok('nao acende com um de Johto no meio',
   !acendeu('elite_path_kanto', [campeao({ gymPath: ['kanto','kanto','johto','kanto','kanto','kanto','kanto','kanto'] })]));
ok('so ginasios de Johto', acendeu('elite_path_johto', [campeao({ gymPath: oito('johto') })]));
ok('4 de cada lado', acendeu('elite_path_split',
   [campeao({ gymPath: ['kanto','johto','kanto','johto','kanto','johto','kanto','johto'] })]));
ok('5 e 3 nao contam como metade',
   !acendeu('elite_path_split', [campeao({ gymPath: ['johto','johto','johto','johto','johto','kanto','kanto','kanto'] })]));
/* Save de antes da bifurcacao nao tem gymPath -- e naquele tempo so existia Kanto. */
ok('campeao antigo, sem gymPath, conta como Kanto puro', acendeu('elite_path_kanto', [campeao({})]));
ok('e nao ganha o de Johto de graca', !acendeu('elite_path_johto', [campeao({})]));
/* Quem nao venceu a Elite nao entra na conta, por mais que a jornada tenha sido toda de Johto. */
ok('sem vencer a Elite, nenhum caminho conta',
   !acendeu('elite_path_johto', [{ eliteStatus:null, badgeCount:8, gymPath: oito('johto'), team:[] }]));

console.log('\nA COMPOSICAO DO TIME NA VITORIA');
const kanto = ['venusaur','charizard','blastoise','pikachu','snorlax','gyarados'];
const johto = ['meganium','typhlosion','feraligatr','ampharos','scizor','kingdra'];
ok('time todo de Kanto', acendeu('elite_team_kanto', [campeao({ eliteWinTeam: kanto })]));
ok('um de Johto no meio ja tira', !acendeu('elite_team_kanto', [campeao({ eliteWinTeam: kanto.slice(0,5).concat('ampharos') })]));
ok('time todo de Johto', acendeu('elite_team_johto', [campeao({ eliteWinTeam: johto })]));
ok('um de Kanto no meio ja tira', !acendeu('elite_team_johto', [campeao({ eliteWinTeam: johto.slice(0,5).concat('pikachu') })]));
/* O time do save MUDA depois da vitoria (o Mewtwo emprestado entra por 24h). Por isso a conquista
   olha o time congelado, e nao o de agora. */
ok('o Mewtwo emprestado depois nao apaga a conquista de Johto',
   acendeu('elite_team_johto', [campeao({ eliteWinTeam: johto, team: johto.slice(0,5).concat('mewtwo').map(id=>({speciesId:id, level:70})) })]));
/* Save campeao anterior a este campo cai no time ATUAL -- ninguem perde o que ja tinha. */
ok('campeao antigo, sem o time congelado, usa o time atual',
   acendeu('elite_team_kanto', [campeao({ team: kanto.map(id=>({speciesId:id, level:70})) })]));

console.log('\nMONOTIPO');
ok('time todo de Agua', acendeu('elite_monotype',
   [campeao({ eliteWinTeam: ['blastoise','gyarados','lapras','vaporeon','starmie','kingdra'] })]));
/* Tipagem dupla vale: basta existir UM tipo que todos tenham. Gyarados e Agua/Voador, Lapras e
   Agua/Gelo -- o tipo em comum e Agua. */
ok('um intruso derruba', !acendeu('elite_monotype',
   [campeao({ eliteWinTeam: ['blastoise','gyarados','lapras','vaporeon','starmie','pikachu'] })]));
ok('time misturado nao acende', !acendeu('elite_monotype', [campeao({ eliteWinTeam: kanto })]));

console.log('\nDE PRIMEIRA');
/* eliteAttemptsUsed conta DERROTAS: zero quer dizer que passou sem gastar tentativa. */
ok('campeao sem nenhuma derrota na Elite', acendeu('elite_first_try', [campeao({ eliteAttemptsUsed: 0 })]));
ok('com uma derrota no caminho, nao', !acendeu('elite_first_try', [campeao({ eliteAttemptsUsed: 1 })]));

console.log('\nOS BURACOS QUE JOHTO DEIXOU');
const todasDeJohto = Object.keys(S.SPECIES).filter(id=>S.SPECIES[id].dex>=152);
ok('Pokedex de Johto completa', acendeu('catch_johto', [], todasDeJohto), todasDeJohto.length + ' especies');
ok('faltando uma, nao acende', !acendeu('catch_johto', [], todasDeJohto.slice(0,-1)));
ok('as tres bestas', acendeu('all_beasts', [], ['raikou','entei','suicune']));
ok('duas bestas nao bastam', !acendeu('all_beasts', [], ['raikou','entei']));
ok('Lugia e Ho-Oh', acendeu('tower_duo', [], ['lugia','hooh']));
ok('so o Lugia nao basta', !acendeu('tower_duo', [], ['lugia']));

console.log('\nE AS ANTIGAS CONTINUAM DE PE');
ok('Pokedex de Kanto ainda exige as 150', !acendeu('catch_149', [], ['pikachu']));
ok('o Ditto da Elite continua vindo da flag da vitoria',
   acendeu('elite_ditto', [campeao({ eliteDittoWin:true, team:[] })]));
ok('campeao da Elite', acendeu('elite_champion', [campeao({})]));

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
