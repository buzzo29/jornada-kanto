/**
 * A FILA DA LIGA CLÁSSICA PELO PAINEL -- servidor (21/09/2026).
 *
 * Pedido: *"no admin-treinadores, coloque uma sessão para eu ver a fila de inscrição da liga
 * clássica atual, e conseguir adicionar e remover inscrições de treinadores"*.
 *
 * ⚠️ ISTO SÓ PODE SER CLOUD FUNCTION: o `firestore.rules` deixa cada um escrever só no PRÓPRIO
 * registro de inscrição, então um admin mexendo na inscrição alheia pelo cliente seria recusado --
 * e afrouxar a regra abriria a inscrição de todo mundo pra qualquer jogador logado.
 *
 * O que este arquivo tranca é o que só existe do lado de lá:
 *   - a PORTA (`admin === true`, exatamente o booleano) nas TRÊS callables;
 *   - o time sai do SAVE, nunca do painel;
 *   - as MESMAS exigências do jogador (8 insígnias, time montado, não aposentado);
 *   - a trava de "já está em outra liga", que é o que protege o chaveamento;
 *   - a duplicata no mesmo ciclo;
 *   - e o contador ficando certo depois de cada ação.
 *
 *   node tools/test-admin-liga.js
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

let falhas = 0;
function ok(nome, cond, detalhe){
  if(cond) console.log('  OK     ' + nome + (detalhe ? '   ' + detalhe : ''));
  else { falhas++; console.log('  FALHOU ' + nome + (detalhe ? '   ' + detalhe : '')); }
}
const chamar = (fn, uid, data)=> fn({ auth: uid ? { uid } : null, data: data || {} });
const erroDe = async (fn, uid, data)=> {
  try { await chamar(fn, uid, data); return null; } catch(e){ return e; }
};

const CICLO = 'c-teste';
const timeBom = ['blastoise','lapras','jolteon','gyarados','starmie','slowbro']
  .map((id, i) => ({ speciesId: id, level: 60 + i, ataques: ['tackle'] }));

async function montarCenario(){
  await db.collection('leagues').doc('schedule_classic').set({
    cycles: [{ id: CICLO, status: 'registering', scheduledTime: 1790000000000 }] });
  await db.collection('users').doc('chefe').set({ admin: true, trainerName: 'Chefe' });
  await db.collection('users').doc('ash').set({ trainerName: 'Ash', specialties: ['fire'] });
  await db.collection('users').doc('ash').collection('saves').doc('0')
    .set({ team: timeBom, badgeCount: 8, trainerName: 'Ash' });
  await db.collection('users').doc('ash').collection('saves').doc('1')
    .set({ team: timeBom, badgeCount: 3 });                          /* sem as 8 */
  await db.collection('users').doc('ash').collection('saves').doc('2')
    .set({ team: timeBom, badgeCount: 8, aposentado: true });        /* aposentado */
  await db.collection('users').doc('misty').set({ trainerName: 'Misty' });
  await db.collection('users').doc('misty').collection('saves').doc('0')
    .set({ team: timeBom, badgeCount: 8 });
  await db.collection('users').doc('semnome').set({});
  await db.collection('users').doc('semnome').collection('saves').doc('0')
    .set({ team: timeBom, badgeCount: 8 });
}

(async ()=>{
await montarCenario();

console.log('\n=== A PORTA: SÓ `admin === true` ===');
{
  for(const [nome, fn, dados] of [
    ['adminLeagueQueue', fns.adminLeagueQueue, {}],
    ['adminAddLeagueRegistration', fns.adminAddLeagueRegistration, { uid: 'ash', slot: '0' }],
    ['adminRemoveLeagueRegistration', fns.adminRemoveLeagueRegistration, { uid: 'ash' }],
  ]){
    const semLogin = await erroDe(fn, null, dados);
    ok(nome + ': sem login recusa', semLogin && semLogin.code === 'unauthenticated', semLogin && semLogin.code);
    const naoAdmin = await erroDe(fn, 'ash', dados);
    ok('  e quem não é admin também', naoAdmin && naoAdmin.code === 'permission-denied', naoAdmin && naoAdmin.code);
  }

  /* ⚠️ É O BOOLEANO, exatamente: 'sim', 1, 'true' e {} não abrem. É a mesma régua da porta das
     ilhas -- e aqui ela vale mais, porque do outro lado há escrita na conta de outra pessoa. */
  for(const v of ['sim', 'true', 1, '', 0, null, {}, []]){
    await db.collection('users').doc('quase').set({ admin: v, trainerName: 'Quase' });
    const e = await erroDe(fns.adminLeagueQueue, 'quase', {});
    ok('  admin = ' + JSON.stringify(v) + ' NÃO abre', e && e.code === 'permission-denied', e && e.code);
  }
}

console.log('\n=== A FILA ===');
{
  const r = await chamar(fns.adminLeagueQueue, 'chefe', {});
  ok('ela acha o ciclo ABERTO', r.ciclo && r.ciclo.id === CICLO, JSON.stringify(r.ciclo));
  ok('  e começa vazia', r.inscritos.length === 0 && r.real === 0);

  /* ⚠️ E SEM CICLO ABERTO ELA NÃO INVENTA UM: só o `registering` aceita inscrição. */
  await db.collection('leagues').doc('schedule_classic').set({
    cycles: [{ id: 'velho', status: 'drawn', scheduledTime: 1 }] });
  const semCiclo = await chamar(fns.adminLeagueQueue, 'chefe', {});
  ok('  e sem ciclo aberto ela diz isso', semCiclo.ciclo === null && semCiclo.inscritos.length === 0);
  const e1 = await erroDe(fns.adminAddLeagueRegistration, 'chefe', { uid: 'ash', slot: '0' });
  ok('    e inscrever recusa', e1 && e1.code === 'failed-precondition', e1 && e1.message);
  await db.collection('leagues').doc('schedule_classic').set({
    cycles: [{ id: CICLO, status: 'registering', scheduledTime: 1790000000000 }] });
}

console.log('\n=== INSCREVER: O TIME SAI DO SAVE ===');
{
  const r = await chamar(fns.adminAddLeagueRegistration, 'chefe', { uid: 'ash', slot: '0' });
  ok('inscreve', r.ok === true && r.nome === 'Ash', JSON.stringify(r));

  const doc = (await db.collection('leagueCycles').doc('classic__' + CICLO)
    .collection('registrants').doc('ash').get()).data() || {};
  ok('  com o nome da CONTA', doc.name === 'Ash', doc.name);
  ok('  o slot que foi pedido', String(doc.slot) === '0', String(doc.slot));
  /* ⚠️ O CÓDIGO DO TIME É MONTADO AQUI, do save -- o painel manda uid e slot e mais nada. */
  ok('  e o código do time montado do save', typeof doc.code === 'string' && doc.code.length > 5, doc.code);
  ok('  com os golpes escolhidos junto', doc.ataques && Object.keys(doc.ataques).length === 6,
     JSON.stringify(Object.keys(doc.ataques || {})).slice(0, 60));
  ok('  e as especialidades da conta', Array.isArray(doc.specialties) && doc.specialties[0] === 'fire',
     JSON.stringify(doc.specialties));

  /* ⚠️ UM CÓDIGO DE TIME VINDO DO PAINEL É IGNORADO: aceitar um seria deixar inscrever um time que
     a conta não tem. O que chega é uid e slot, e o resto é lido do banco. */
  await chamar(fns.adminRemoveLeagueRegistration, 'chefe', { uid: 'ash' });
  await chamar(fns.adminAddLeagueRegistration, 'chefe',
    { uid: 'ash', slot: '0', code: 'mewtwo:99:1', name: 'Hacker', ataques: { x: ['hyperbeam'] } });
  const forjado = (await db.collection('leagueCycles').doc('classic__' + CICLO)
    .collection('registrants').doc('ash').get()).data() || {};
  ok('  e o que o painel mandar de time é IGNORADO',
     forjado.code.indexOf('mewtwo') < 0 && forjado.name === 'Ash', forjado.code + ' / ' + forjado.name);

  const fila = await chamar(fns.adminLeagueQueue, 'chefe', {});
  ok('  e ele aparece na fila', fila.inscritos.length === 1 && fila.inscritos[0].uid === 'ash');
  ok('  com o contador certo', fila.contador === 1 && fila.real === 1,
     'contador ' + fila.contador + ', real ' + fila.real);
}

console.log('\n=== O QUE NÃO ENTRA ===');
{
  const casos = [
    ['save que não existe', { uid: 'ash', slot: '9' }, 'not-found'],
    ['save sem as 8 insígnias', { uid: 'ash', slot: '1' }, 'failed-precondition'],
    ['time APOSENTADO', { uid: 'ash', slot: '2' }, 'failed-precondition'],
    ['treinador sem nome', { uid: 'semnome', slot: '0' }, 'failed-precondition'],
    ['sem uid', { slot: '0' }, 'invalid-argument'],
    ['sem slot', { uid: 'misty' }, 'invalid-argument'],
  ];
  for(const [nome, dados, code] of casos){
    const e = await erroDe(fns.adminAddLeagueRegistration, 'chefe', dados);
    ok(nome + ' não entra', e && e.code === code, (e && e.code + ': ' + e.message) || 'PASSOU');
  }

  /* ⚠️ A DUPLICATA NO MESMO CICLO: a inscrição é UMA por conta. */
  const dup = await erroDe(fns.adminAddLeagueRegistration, 'chefe', { uid: 'ash', slot: '0' });
  ok('e quem já está inscrito não entra duas vezes', dup && dup.code === 'already-exists',
     dup && dup.message);
  const fila = await chamar(fns.adminLeagueQueue, 'chefe', {});
  ok('  e a fila continua com um', fila.real === 1, String(fila.real));
}

console.log('\n=== A TRAVA DE "JÁ ESTÁ EM OUTRA LIGA" ===');
{
  /* ⚠️ É ELA QUE PROTEGE O CHAVEAMENTO: quem está disputando um ciclo já sorteado não pode entrar
     no próximo, senão a mesma conta aparece em dois. O jogador tem essa trava; o painel também. */
  await db.collection('leagues').doc('schedule_custom1').set({
    cycles: [{ id: 'emcurso', status: 'drawn', scheduledTime: 1 }] });
  await db.collection('leagueTypes').doc('custom1').set({ name: 'Liga do Fogo' });
  await db.collection('leagueCycles').doc('custom1__emcurso').set({
    leagues: [{ id: 'L1', rounds: { 0: [{ a: { uid: 'misty', name: 'Misty' }, b: { uid: 'x' } }] } }] });

  const e = await erroDe(fns.adminAddLeagueRegistration, 'chefe', { uid: 'misty', slot: '0' });
  ok('quem está numa liga EM ANDAMENTO não entra', e && e.code === 'failed-precondition',
     (e && e.message) || 'PASSOU');
  ok('  e a mensagem diz ONDE ele está', e && /custom1/.test(e.message), e && e.message);

  /* tirando ele de lá, ele entra */
  await db.collection('leagueCycles').doc('custom1__emcurso').set({ leagues: [] });
  const r = await chamar(fns.adminAddLeagueRegistration, 'chefe', { uid: 'misty', slot: '0' });
  ok('  e entra depois que aquela liga o solta', r.ok === true, JSON.stringify(r));
}

console.log('\n=== REMOVER ===');
{
  const antes = await chamar(fns.adminLeagueQueue, 'chefe', {});
  ok('a fila tem dois', antes.real === 2, String(antes.real));

  const r = await chamar(fns.adminRemoveLeagueRegistration, 'chefe', { uid: 'misty' });
  ok('remove', r.ok === true, JSON.stringify(r));
  const depois = await chamar(fns.adminLeagueQueue, 'chefe', {});
  ok('  e ele sai da fila', depois.inscritos.every(x => x.uid !== 'misty'),
     depois.inscritos.map(x => x.uid).join(','));
  /* ⚠️ O CONTADOR ACOMPANHA: ele é o número que a TELA DO JOGO mostra, e ele já nasceu
     desalinhado uma vez (20/09). Aqui ele é RECONCILIADO pela agregação, não incrementado. */
  ok('  e o contador acompanha', depois.contador === 1 && depois.real === 1,
     'contador ' + depois.contador + ', real ' + depois.real);

  const naoTem = await erroDe(fns.adminRemoveLeagueRegistration, 'chefe', { uid: 'misty' });
  ok('  e remover quem não está recusa', naoTem && naoTem.code === 'not-found', naoTem && naoTem.code);
  const semUid = await erroDe(fns.adminRemoveLeagueRegistration, 'chefe', {});
  ok('  e sem uid também', semUid && semUid.code === 'invalid-argument', semUid && semUid.code);
}

console.log('\n=== A PORTA VIVE NUMA FUNÇÃO SÓ ===');
{
  /* ⚠️ LIDO DO CÓDIGO: com a checagem escrita à mão em cada callable, a próxima nasceria sem ela --
     e numa função administrativa isso não é um defeito de tela, é a porta aberta. */
  const srv = require('fs').readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  ok('existe um `exigeAdmin`', /async function exigeAdmin\(request\)/.test(srv));
  const admins = ['adminLeagueQueue', 'adminAddLeagueRegistration', 'adminRemoveLeagueRegistration'];
  admins.forEach(nome => {
    const i = srv.indexOf('exports.' + nome + ' = onCall');
    const corpo = i >= 0 ? srv.slice(i, i + 400) : '';
    ok('  ' + nome + ' passa por ele', corpo.length > 50 && /await exigeAdmin\(request\)/.test(corpo),
       corpo.length ? 'sem o exigeAdmin' : 'não achei a callable');
  });
  /* ⚠️ E O `adminListTrainers` CONTINUA FECHADO, do jeito dele: ele é anterior e tem a checagem
     inline -- o que a trava cobra é que ele NÃO fique sem nenhuma das duas. */
  const i = srv.indexOf('exports.adminListTrainers = onCall');
  const corpo = srv.slice(i, i + 600);
  ok('  e o adminListTrainers continua fechado',
     /admin !== true/.test(corpo) || /exigeAdmin\(request\)/.test(corpo));
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
