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

  await multidao();
})();

/* Segunda bateria: MUITA GENTE AO MESMO TEMPO. Roda depois da primeira, com o banco limpo.
   A raide e o unico lugar do jogo onde varios jogadores escrevem no MESMO documento, e o erro
   dessa familia nao aparece em teste sequencial. */
async function multidao(){
  fake.reset();
  const N = 10;
  for(let i=0;i<N;i++){
    await db.collection('users').doc('m'+i).set({ userTest:true, trainerName:'m'+i });
    await db.collection('users').doc('m'+i).collection('saves').doc('0')
            .set({ saveName:'Time 1', badgeCount:8, team:TIME });
  }
  const doc = () => db.collection('globalBoss').doc('mew').get().then(s=>s.data());
  const todos = () => Promise.all([...Array(N)].map((_,i)=>chamar('fightSundayBoss','m'+i,{slot:'0'})));
  await chamar('getSundayBoss','m0');

  console.log('\n' + N + ' CONTAS ATACANDO AO MESMO TEMPO -- MEW CHEIO');
  let antes = (await doc()).hp;
  let r = await todos();
  let depois = (await doc()).hp;
  const soma = r.reduce((s,x)=>s+x.dano, 0);
  ok('nenhum dano some', depois === antes - soma, antes+' - '+soma+' = '+(antes-soma)+', gravado '+depois);
  ok('as ' + N + ' investidas sao contadas', (await doc()).batalhas === N);
  ok('ninguem derruba um Mew cheio', r.every(x=>!x.derrubou));

  console.log('\n' + N + ' AO MESMO TEMPO -- MEW A UM FIO DE VIDA');
  // deixa menos vida do que UMA investida tira: e aqui que a conta estourava
  while((await doc()).hp > 250){ await chamar('fightSundayBoss','m0',{slot:'0'}); }
  antes = (await doc()).hp;
  r = await todos();
  const max = (await doc()).maxHp;
  ok('o Mew cai e nao fica negativo', (await doc()).hp === 0);
  ok('exatamente UM jogador derruba', r.filter(x=>x.derrubou).length === 1,
     r.filter(x=>x.derrubou).length + ' de ' + N);
  ok('a soma do dano reportado nao passa da vida que havia',
     r.reduce((s,x)=>s+x.dano,0) === antes, r.reduce((s,x)=>s+x.dano,0)+' de '+antes);
  ok('quem chegou tarde e avisado',
     r.filter(x=>x.chegouTarde).every(x=>x.danoSimulado > x.dano));
  const contrib = await Promise.all([...Array(N)].map((_,i)=>chamar('getSundayBoss','m'+i).then(x=>x.meu.dano)));
  const total = contrib.reduce((a,b)=>a+b,0);
  ok('a soma das contribuicoes bate com a vida do Mew', total === max,
     total + ' de ' + max);
  ok('ninguem fica com dano negativo ou zerado a toa', contrib.every(d=>d >= 0));
  await ranking();
}

/* Terceira bateria: o TOP 10. */
async function ranking(){
  fake.reset();
  const N = 13;   // mais que 10, pra provar que corta nos 10 primeiros e nao em 10 quaisquer
  for(let i=0;i<N;i++){
    await db.collection('users').doc('r'+i).set({ userTest:true, trainerName:'Treinador '+i });
    await db.collection('users').doc('r'+i).collection('saves').doc('0')
            .set({ customName:'Time', badgeCount:8, team:TIME });
  }
  console.log('\nTOP 10 DE DANO');
  const vazio = await chamar('getSundayBoss','r0');
  ok('comeca vazio', Array.isArray(vazio.ranking) && vazio.ranking.length === 0);
  /* O acumulo de dano ja e coberto pelas outras baterias. Aqui o que esta em teste e a CONSULTA:
     ordenar por dano, cortar em 10 e trazer o nome gravado. Por isso os placares entram direto --
     91 investidas de verdade matariam o Mew (5125 de vida) muito antes do decimo terceiro
     jogador atacar. Uma investida real de cada um confirma que a funcao escreve no mesmo lugar. */
  const rank = () => db.collection('globalBoss').doc('mewRank').get().then(s=>s.exists?s.data():null);
  for(let i=0;i<N;i++){
    await chamar('fightSundayBoss','r'+i,{slot:'0'});
    await db.collection('globalBoss').doc('mew').collection('players').doc('r'+i)
            .set({ dano: (i+1)*100, batalhas: i+1, trainerName:'Treinador '+i }, { merge:true });
  }
  // 1) sem o top 10 guardado, cai na consulta viva
  await db.collection('globalBoss').doc('mewRank').delete();
  const vivo = (await chamar('getSundayBoss','r0')).ranking;
  ok('sem cache, a consulta viva responde', vivo.length === 10 && vivo[0].uid === 'r'+(N-1), vivo[0].uid);
  // 2) uma investida reconstroi o top 10 guardado
  await chamar('fightSundayBoss','r0',{slot:'0'});
  const guardado = await rank();
  ok('a investida grava o top 10 pronto', !!guardado && Array.isArray(guardado.lista), guardado?'sim':'nao');
  ok('o guardado tem no maximo 10', guardado.lista.length === 10, String(guardado.lista.length));
  ok('a tela le do guardado, nao da colecao',
     JSON.stringify((await chamar('getSundayBoss','r0')).ranking) === JSON.stringify(guardado.lista));
  const r = (await chamar('getSundayBoss','r0')).ranking;
  ok('devolve no maximo 10', r.length === 10, r.length + '');
  ok('vem em ordem decrescente de dano', r.every((e,i)=> i===0 || r[i-1].dano >= e.dano),
     r.map(e=>e.dano).join(' > '));
  ok('a investida real escreve no mesmo documento do ranking',
     (await chamar('getSundayBoss','r0')).meu.batalhas >= 1);
  ok('o 1o lugar e quem mais atacou', r[0].uid === 'r'+(N-1), r[0].uid);
  ok('sao os 10 MAIORES, nao 10 quaisquer',
     !r.some(e=>['r0','r1','r2'].includes(e.uid)), r.map(e=>e.uid).join(','));
  ok('cada linha tem nome e dano', r.every(e=>e.name && e.name !== 'Treinador' && e.dano > 0));
  ok('o nome vem gravado no documento do jogador', r[0].name === 'Treinador ' + (N-1), r[0].name);
  const meu = (await chamar('getSundayBoss','r12')).meu;
  ok('a contribuicao pessoal bate com a linha do ranking',
     r.find(e=>e.uid==='r12').dano === meu.dano, r.find(e=>e.uid==='r12').dano+' = '+meu.dano);
  await resumo();
}

/* Quarta bateria: o RESUMO, que e o que a tela consulta de 5 em 5 segundos. */
async function resumo(){
  fake.reset();
  for(const uid of ['s1','s2']){
    await db.collection('users').doc(uid).set({ userTest:true, trainerName:'T-'+uid });
    await db.collection('users').doc(uid).collection('saves').doc('0')
            .set({ customName:'Time', badgeCount:8, team:TIME });
  }
  console.log('\nCONSULTA DE 5 EM 5 SEGUNDOS (resumo)');
  const cheio = await chamar('getSundayBoss','s1');
  const leve  = await chamar('getSundayBoss','s1',{ resumo:true });
  ok('o resumo traz a vida do Mew', leve.boss && leve.boss.hp === cheio.boss.hp);
  ok('o resumo traz o ranking', Array.isArray(leve.ranking));
  ok('o resumo traz a minha contribuicao', !!leve.meu);
  ok('o resumo NAO traz a lista de times (e leitura jogada fora)', leve.times === undefined);
  ok('a porta do userTest vale no resumo tambem',
     await recusa('getSundayBoss','naotem',{resumo:true}) === 'permission-denied');

  /* O caso do print: duas contas abertas, so uma ataca. A outra tem que enxergar. */
  const antes = (await chamar('getSundayBoss','s2',{resumo:true}));
  const r = await chamar('fightSundayBoss','s1',{ slot:'0' });
  const depois = (await chamar('getSundayBoss','s2',{resumo:true}));
  ok('a outra conta ve a vida nova', depois.boss.hp === antes.boss.hp - r.dano,
     antes.boss.hp+' -> '+depois.boss.hp);
  ok('a outra conta ve o ranking novo',
     depois.ranking.length === 1 && depois.ranking[0].uid === 's1' && depois.ranking[0].dano === r.dano,
     JSON.stringify(depois.ranking.map(e=>e.uid+':'+e.dano)));
  ok('quem atacou ve a propria contribuicao atualizada',
     (await chamar('getSundayBoss','s1',{resumo:true})).meu.dano === r.dano);
  fim();
}
