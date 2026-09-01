/**
 * GINASIO DA CIDADE -- a montagem de time dos DOIS lados, no servidor, sem Firebase.
 *
 * O que mudou em 01/09/2026: a defesa e o desafio deixaram de ser "um save inteiro" e passaram a
 * ser um time MONTADO com pokemon de qualquer save com 8 insignias, sem repetir especie -- a mesma
 * regra da Torre. Isso derrubou tres coisas que estavam presas ao slot e este teste tranca as tres:
 * a espera (que virou por JOGADOR), o time de quem vence (que agora e o time que venceu) e a
 * identidade do pokemon escolhido (o defeito do shiny que sumia, que ja aconteceu na Torre).
 *
 *   node tools/test-ginasio-cidade.js
 */
const path = require('path');
const Module = require('module');
const fake = require('./fake-firestore');

const db = fake.makeDb();
const stubs = {
  'firebase-functions/v2/scheduler': { onSchedule: (a, b)=> (typeof a === 'function' ? a : b) },
  'firebase-functions/v2/https': {
    onCall: (fn)=>fn,
    HttpsError: class HttpsError extends Error { constructor(code, msg){ super(msg); this.code = code; } }
  },
  'firebase-functions/logger': { error(){}, info(){}, warn(){}, log(){} },
  'firebase-admin': { initializeApp(){}, firestore: Object.assign(()=>db, { FieldValue: fake.FieldValue }) }
};
const loadOriginal = Module._load;
Module._load = function(req){ if(stubs[req]) return stubs[req]; return loadOriginal.apply(this, arguments); };
const fns = require(path.join(__dirname, '..', 'functions', 'index.js'));
Module._load = loadOriginal;

let falhas = 0, casos = 0;
function ok(nome, cond, detalhe){
  casos++;
  if(cond) console.log('  ✓ ' + nome);
  else { falhas++; console.log('  ✗ ' + nome + (detalhe ? ' — ' + detalhe : '')); }
}
const chamar = (fn, uid, data)=> fn({ auth:{ uid }, data });
async function recusa(fn, uid, data){
  try { await chamar(fn, uid, data); return null; } catch(e){ return e.message || String(e); }
}
const mon = (id, especie, nivel, shiny)=>({ id, speciesId:especie, level:nivel, shiny:!!shiny });
const escolher = (time, slot, quais)=> quais.map(i => ({
  speciesId: time[i].speciesId, level: time[i].level, slot: String(slot), idx: i,
  monId: time[i].id, shiny: !!time[i].shiny
}));
const CIDADE = { city:'Sorocaba', countryCode:'BR' };
const GYM_ID = 'sorocaba__br';   // normalizeNeighborhoodName(city) + '__' + pais (ver neighborhoodGymId)
/* O time guardado e um codigo base64 de "especie:nivel[:1 se shiny]" separado por virgula. */
const lerTime = (code)=> Buffer.from(String(code||''), 'base64').toString('utf8');
const especiesDe = (code)=> lerTime(code).split(',').map(p => p.split(':')[0]);

(async ()=>{
console.log('\nGINASIO DA CIDADE: o time e MONTADO, nao e mais um save');

/* Dois treinadores, dois saves cada. O Gyarados aparece nos dois saves do Ash no MESMO nivel --
   um normal e um shiny -- porque e exatamente ai que a busca por especie+nivel erra. */
const ashA = [mon('a1','gyarados',73,false), mon('a2','alakazam',70), mon('a3','snorlax',71),
              mon('a4','arcanine',69), mon('a5','gengar',72), mon('a6','lapras',70)];
const ashB = [mon('b1','gyarados',73,true), mon('b2','machamp',70), mon('b3','starmie',71),
              mon('b4','vileplume',69), mon('b5','rhydon',72), mon('b6','ninetales',70)];
const garyA = [mon('g1','dragonite',75), mon('g2','tyranitar',74), mon('g3','blissey',73),
               mon('g4','steelix',72), mon('g5','espeon',71), mon('g6','feraligatr',70)];
await db.collection('users').doc('ash').set({ trainerName:'Ash', specialties:[] });
await db.collection('users').doc('gary').set({ trainerName:'Gary', specialties:[] });
await db.collection('users').doc('ash').collection('saves').doc('0').set({ badgeCount:8, team:ashA });
await db.collection('users').doc('ash').collection('saves').doc('1').set({ badgeCount:8, team:ashB });
await db.collection('users').doc('gary').collection('saves').doc('0').set({ badgeCount:8, team:garyA });

/* 1) DEFESA MISTURANDO SAVES -- o pedido em uma frase. */
const defesaMista = escolher(ashA, 0, [1,2,3]).concat(escolher(ashB, 1, [1,2,3]));
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: defesaMista }, CIDADE));
let gym = (await db.collection('neighborhoodGyms').doc(GYM_ID).get()).data();
ok('a defesa aceita pokemon de saves DIFERENTES no mesmo time', !!gym && !!gym.leaderTeamCode);
ok('e o ginasio ficou com o Ash como lider', gym.leaderUid === 'ash', 'lider: ' + (gym && gym.leaderUid));
/* A defesa vira um CODIGO congelado: depois de montada nao depende mais dos saves. */
ok('e o time guardado tem os 6 escolhidos', especiesDe(gym.leaderTeamCode).length === 6,
   lerTime(gym.leaderTeamCode));
/* Os tres vieram do save 0 e os tres do save 1 -- e isso que "qualquer save" quer dizer. */
ok('com pokemon dos DOIS saves', especiesDe(gym.leaderTeamCode).includes('alakazam') &&
   especiesDe(gym.leaderTeamCode).includes('machamp'), lerTime(gym.leaderTeamCode));
/* Sem slot: a defesa nao vem de save nenhum, e e isso que solta a exclusividade antiga. */
ok('e nao fica presa a um save (leaderTeamSlot nulo)', gym.leaderTeamSlot === null,
   'leaderTeamSlot: ' + JSON.stringify(gym.leaderTeamSlot));

/* 2) AS DUAS REGRAS DA CASA. */
const repetida = escolher(ashA, 0, [1,1,2]);
ok('recusa especie repetida', /repetir espécie/.test(await recusa(fns.setNeighborhoodGymDefense, 'ash',
   Object.assign({ team: repetida }, CIDADE)) || ''));
const alheio = [{ speciesId:'mewtwo', level:99, slot:'0', idx:0, monId:'x', shiny:false }];
ok('recusa pokemon que a conta nao tem', /não está em nenhum time seu/.test(
   await recusa(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: alheio }, CIDADE)) || ''));
ok('recusa mais de 6', /precisa de 1 a 6/.test(await recusa(fns.setNeighborhoodGymDefense, 'ash',
   Object.assign({ team: escolher(ashA,0,[0,1,2,3,4,5]).concat(escolher(ashB,1,[1])) }, CIDADE)) || ''));

/* 3) O SHINY QUE SUMIA. Escolher o Gyarados do save 1 (shiny) nao pode trazer o do save 0. */
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: escolher(ashB, 1, [0,1,2]) }, CIDADE));
gym = (await db.collection('neighborhoodGyms').doc(GYM_ID).get()).data();
ok('escolheu o Gyarados shiny e o ginasio guardou o shiny',
   lerTime(gym.leaderTeamCode).startsWith('gyarados:73:1'), lerTime(gym.leaderTeamCode));
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ team: escolher(ashA, 0, [0,1,2]) }, CIDADE));
gym = (await db.collection('neighborhoodGyms').doc(GYM_ID).get()).data();
ok('e escolhendo o normal, vem o normal',
   lerTime(gym.leaderTeamCode).startsWith('gyarados:73,'), lerTime(gym.leaderTeamCode));

/* O ginasio so aceita desafio com terreno configurado (senao quem desafiasse ganharia de graca). */
await chamar(fns.setNeighborhoodGymDefense, 'ash', Object.assign({ terrainId: fns._TERRAINS[0].id }, CIDADE));
gym = (await db.collection('neighborhoodGyms').doc(GYM_ID).get()).data();
ok('o lider configura o terreno sem mexer no time', !!gym.leaderTerrain && !!gym.leaderTeamCode, 'terreno: ' + gym.leaderTerrain);

/* 4) O DESAFIANTE TAMBEM MONTA. */
console.log('\nO DESAFIO');
const desafio = escolher(garyA, 0, [0,1,2,3,4,5]);
const r1 = await chamar(fns.challengeNeighborhoodGym, 'gary', Object.assign({ team: desafio }, CIDADE));
ok('o desafio aceita time montado', r1 && Array.isArray(r1.matchups) && r1.matchups.length > 0,
   'matchups: ' + (r1 && r1.matchups && r1.matchups.length));
ok('e responde quem venceu', typeof r1.win === 'boolean', 'win: ' + (r1 && r1.win));

/* A ESPERA E DO JOGADOR, nao de um time: com o time montado nao existe mais "o time do slot N".
   De quebra fecha a brecha antiga -- quem tinha 3 saves desafiava 3 vezes seguidas. */
const outroTime = escolher(garyA, 0, [1,2,3]);
const erro = await recusa(fns.challengeNeighborhoodGym, 'gary', Object.assign({ team: outroTime }, CIDADE));
ok('e desafiar de novo com OUTRO time nao escapa da espera', /esperar mais/.test(erro || ''), erro);

/* 5) QUEM VENCE DEFENDE COM O TIME QUE VENCEU.
   Antes um sorteio escolhia um save LIVRE do vencedor -- fazia sentido quando a defesa era um
   save inteiro, e nao faz mais nenhum: ele montou um time, ganhou com ele, e e com ele que fica. */
console.log("");
console.log("A VITORIA");
gym = (await db.collection('neighborhoodGyms').doc(GYM_ID).get()).data();
if(r1.win){
  ok('vencendo, o desafiante vira lider', gym.leaderUid === 'gary', 'lider: ' + gym.leaderUid);
  const especiesNoGinasio = especiesDe(gym.leaderTeamCode);
  ok('e defende com o MESMO time que venceu',
     desafio.every(p => especiesNoGinasio.includes(p.speciesId)), lerTime(gym.leaderTeamCode));
  ok('e essa defesa tambem nao fica presa a save nenhum', gym.leaderTeamSlot === null);
  /* Assumindo, o terreno volta a ficar pendente: o novo lider escolhe o dele. */
  ok('e o terreno fica pendente pro novo lider escolher', gym.leaderTerrain === null,
     'terreno: ' + JSON.stringify(gym.leaderTerrain));
} else {
  ok('perdendo, o lider antigo continua', gym.leaderUid === 'ash', 'lider: ' + gym.leaderUid);
  ok('e a defesa dele nao mudou', especiesDe(gym.leaderTeamCode).includes('gyarados'), lerTime(gym.leaderTeamCode));
}
console.log('\n' + (casos - falhas) + '/' + casos + ' casos passaram.' + (falhas ? '  ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('\nEXPLODIU:', e); process.exit(1); });
