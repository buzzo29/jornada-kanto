/**
 * Boss de Domingo -- a raide GLOBAL contra o Mew, no servidor, sem Firebase.
 *
 * O que este teste existe pra pegar, que e tudo especifico de estado COMPARTILHADO:
 *  - a porta do userTest, que separa "em avaliacao" de "no ar pra todo mundo";
 *  - o servidor aceitando um time do cliente (aqui o estrago nao fica no save de quem trapaceou,
 *    fica na barra que o jogo inteiro ve);
 *  - dano sumindo quando duas investidas chegam juntas -- as duas leem o mesmo HP;
 *  - vida regenerando entre investidas, que e justamente o que a feature promete nao fazer;
 *  - HP negativo, ou continuar batendo num Mew ja derrubado.
 *
 *   node tools/test-boss.js
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

let falhas = 0;
function ok(nome, cond, extra){
  console.log((cond ? '  OK   ' : '  FALHA') + '  ' + nome + (extra ? '   ' + extra : ''));
  if(!cond) falhas++;
}
const chamar = (fn, uid, data) => fns[fn]({ auth:{ uid }, data: data || {} });
async function recusa(fn, uid, data){
  try{ await chamar(fn, uid, data); return null; }catch(e){ return e.code || 'erro'; }
}
const TIME = [
  { speciesId:'venusaur',  level:70, shiny:false },
  { speciesId:'charizard', level:70, shiny:true  },
  { speciesId:'blastoise', level:70, shiny:false },
  { speciesId:'gengar',    level:70, shiny:false },
  { speciesId:'dragonite', level:70, shiny:false },
  { speciesId:'snorlax',   level:70, shiny:false }
];
async function preparar(){
  fake.reset();
  for(const [uid, teste] of [['tester',true], ['tester2',true], ['comum',false]]){
    await db.collection('users').doc(uid).set({ userTest:teste, trainerName:uid });
    await db.collection('users').doc(uid).collection('saves').doc('0')
            .set({ saveName:'Time 1', badgeCount:8, team:TIME });
  }
}
function fim(){
  console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
  process.exit(falhas ? 1 : 0);
}

(async () => {
  await preparar();

  console.log('\nA PORTA DO userTest (o estado e global -- fechar so no cliente nao vale)');
  ok('conta sem userTest nao le a raide', await recusa('getSundayBoss','comum') === 'permission-denied');
  ok('conta sem userTest nao ataca',      await recusa('fightSundayBoss','comum',{slot:'0'}) === 'permission-denied');
  let semLogin = null;
  try{ await fns.getSundayBoss({ data:{} }); }catch(e){ semLogin = e.code; }
  ok('sem login nao passa', semLogin === 'unauthenticated');

  console.log('\nO MEW E UM SO, E A VIDA NAO VOLTA');
  const inicial = await chamar('getSundayBoss','tester');
  ok('nasce com a vida cheia', inicial.boss.hp === inicial.boss.maxHp, inicial.boss.hp+'/'+inicial.boss.maxHp);
  ok('e nivel 999', inicial.boss.level === 999);
  const r1 = await chamar('fightSundayBoss','tester',{ slot:'0' });
  ok('a investida tira vida', r1.dano > 0 && r1.hpDepois === r1.hpAntes - r1.dano,
     r1.hpAntes+' -> '+r1.hpDepois+' (-'+r1.dano+')');
  ok('o time inteiro cai (e um Lv.999)', r1.win === false);
  ok('o log traz os confrontos do time', r1.matchups.length >= 6, r1.matchups.length+' confrontos');
  ok('o adversario do log e o Mew Lv.999',
     r1.matchups.every(m => m.enemySpecies === 'mew' && m.enemyLevel === 999));
  ok('a barra do log e a barra global',
     r1.matchups[0].enemyMaxHp === inicial.boss.maxHp && r1.matchups[0].enemyHpBefore === r1.hpAntes);

  const outro = await chamar('getSundayBoss','tester2');
  ok('OUTRO jogador ve a mesma vida', outro.boss.hp === r1.hpDepois, outro.boss.hp+' = '+r1.hpDepois);
  const r2 = await chamar('fightSundayBoss','tester2',{ slot:'0' });
  ok('a segunda investida continua de onde a primeira parou', r2.hpAntes === r1.hpDepois);
  ok('a vida nao regenerou entre as duas', r2.hpAntes <= r1.hpDepois);

  console.log('\nO SERVIDOR NAO ACEITA TIME DO CLIENTE');
  const trapaca = await chamar('fightSundayBoss','tester',
    { slot:'0', team:[{speciesId:'mewtwo', level:99, shiny:true}] });
  ok('o time mandado no payload e ignorado',
     trapaca.matchups.every(m => m.playerLevel === 70 && m.playerSpecies !== 'mewtwo'));
  ok('slot inexistente e recusado', await recusa('fightSundayBoss','tester',{slot:'7'}) === 'failed-precondition');
  ok('sem slot e recusado',         await recusa('fightSundayBoss','tester',{}) === 'invalid-argument');

  console.log('\nDUAS INVESTIDAS AO MESMO TEMPO');
  const antes = (await chamar('getSundayBoss','tester')).boss.hp;
  const [a, b] = await Promise.all([
    chamar('fightSundayBoss','tester', { slot:'0' }),
    chamar('fightSundayBoss','tester2',{ slot:'0' })
  ]);
  const depois = (await chamar('getSundayBoss','tester')).boss.hp;
  ok('nenhum dano some', depois === antes - a.dano - b.dano,
     antes+' - '+a.dano+' - '+b.dano+' = '+(antes-a.dano-b.dano)+', gravado '+depois);

  console.log('\nDERRUBANDO O MEW');
  let voltas = 0, ultimo = null;
  while(voltas < 500){
    const est = await chamar('getSundayBoss','tester');
    if(est.boss.hp <= 0) break;
    ultimo = await chamar('fightSundayBoss','tester',{ slot:'0' });
    voltas++;
  }
  const fim2 = await chamar('getSundayBoss','tester');
  ok('a raide termina (o Mew cai)', fim2.boss.hp === 0, voltas+' investidas de um time Lv.70');
  ok('a vida nunca fica negativa', fim2.boss.hp >= 0, String(fim2.boss.hp));
  ok('a ultima investida marca a derrubada', !!(ultimo && ultimo.derrubou));
  ok('derrubado, nao da pra atacar de novo',
     await recusa('fightSundayBoss','tester',{slot:'0'}) === 'failed-precondition');

  console.log('\nCONTRIBUICAO DE CADA UM');
  const meu = (await chamar('getSundayBoss','tester')).meu;
  const dele = (await chamar('getSundayBoss','tester2')).meu;
  ok('cada jogador tem o dano dele', meu.dano > 0 && dele.dano > 0,
     'tester '+meu.dano+', tester2 '+dele.dano);
  ok('a soma dos dois e a vida do Mew', meu.dano + dele.dano === fim2.boss.maxHp,
     meu.dano+' + '+dele.dano+' = '+(meu.dano+dele.dano)+' de '+fim2.boss.maxHp);

  fim();
})();
