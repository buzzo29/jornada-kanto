/**
 * Teste da escolha de time da TORRE DOS TREINADORES, no servidor, sem Firebase.
 * Mesmo esqueleto do test-amigos-servidor.js: stubs no lugar do firebase-admin/functions.
 *
 * O que ele existe pra pegar: o shiny sumindo. Quem tem o MESMO pokémon no MESMO nível em dois
 * saves (um shiny, um normal) escolhia o shiny e entrava na torre com o normal, porque a busca
 * era por espécie+nível e pegava o primeiro que casasse.
 *
 *   node tools/test-torre.js
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
Module._load = function(req, parent, isMain){
  if(stubs[req]) return stubs[req];
  return loadOriginal.apply(this, arguments);
};
const fns = require(path.join(__dirname, '..', 'functions', 'index.js'));
Module._load = loadOriginal;

let falhas = 0, casos = 0;
function ok(nome, cond, detalhe){
  casos++;
  if(cond) console.log('  \u2713 ' + nome);
  else { falhas++; console.log('  \u2717 ' + nome + (detalhe ? ' \u2014 ' + detalhe : '')); }
}
const chamar = (fn, uid, data)=> fn({ auth:{ uid }, data });

(async ()=>{
console.log('\nTORRE: escolha do time');

const mon = (id, especie, nivel, shiny)=>({ id, speciesId:especie, level:nivel, shiny:!!shiny });
// save 0: o time com o Gyarados NORMAL. save 1: o mesmo Gyarados, mesmo nivel, SHINY.
const time0 = [mon('a1','gyarados',73,false), mon('a2','alakazam',70), mon('a3','snorlax',71),
               mon('a4','arcanine',69), mon('a5','gengar',72), mon('a6','lapras',70)];
const time1 = [mon('b1','gyarados',73,true), mon('b2','machamp',70), mon('b3','starmie',71),
               mon('b4','vileplume',69), mon('b5','rhydon',72), mon('b6','ninetales',70)];
await db.collection('users').doc('ash').collection('saves').doc('0').set({ badgeCount:8, team:time0 });
await db.collection('users').doc('ash').collection('saves').doc('1').set({ badgeCount:8, team:time1 });

// escolhe o SHINY (save 1) -- e os outros cinco do save 1, pra nao repetir especie
const escolha = time1.map(p=>({ speciesId:p.speciesId, level:p.level, slot:'1', idx:time1.indexOf(p), monId:p.id, shiny:p.shiny }));
const r = await chamar(fns.startTrainerTowerRun, 'ash', { team: escolha });
const gyara = r.run.team.find(p=>p.speciesId==='gyarados');
ok('escolheu o Gyarados shiny e a torre guardou o shiny', gyara && gyara.shiny === true,
   'guardou shiny=' + (gyara && gyara.shiny));

// e o contrario: escolher o NORMAL nao pode trazer o shiny
await db.collection('trainerTowerRuns').doc('ash').delete();
const escolha2 = time0.map(p=>({ speciesId:p.speciesId, level:p.level, slot:'0', idx:time0.indexOf(p), monId:p.id, shiny:p.shiny }));
const r2 = await chamar(fns.startTrainerTowerRun, 'ash', { team: escolha2 });
const gyara2 = r2.run.team.find(p=>p.speciesId==='gyarados');
ok('escolheu o normal e continua normal', gyara2 && gyara2.shiny === false);

// cliente ANTIGO (so especie+nivel, sem identidade): tem que continuar funcionando
await db.collection('trainerTowerRuns').doc('ash').delete();
const antigo = time1.map(p=>({ speciesId:p.speciesId, level:p.level }));
const r3 = await chamar(fns.startTrainerTowerRun, 'ash', { team: antigo });
ok('cliente antigo continua conseguindo montar o time', r3.run.team.length === 6);

console.log(`\n${casos - falhas}/${casos} casos passaram.`);
if(falhas){ console.log(`${falhas} FALHA(S).`); process.exit(1); }
})().catch(e=>{ console.error('\nERRO NAO TRATADO:', e); process.exit(1); });
