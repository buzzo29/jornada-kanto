/**
 * A TRAVA DA TRAINERS LEAGUE -- quem forma liga hoje e quem fica pra amanha.
 *
 * Por que isso existe: em 31/08/2026 o dia tinha 4 inscritos e a liga NAO ACONTECEU. A regra do
 * "minimo pra formar" (pensada pro RESTO, quando outra liga ja se formou) dissolveu o unico grupo
 * do dia. E o estrago nao parou no dia perdido: sem nenhum grupo, ninguem chama o
 * trainersLeagueLockGroupInto -- que e quem grava status 'locked' --, entao o ciclo ficou parado em
 * 'locking'. A tela anunciava "Chaveamento sorteado" sem chaveamento nenhum, o agendador re-travava
 * a cada 2 minutos (trava vencida e roubavel) e cada volta mandava outra notificacao de adiamento
 * pros mesmos 4 inscritos.
 *
 * A divisao em grupos e uma funcao PURA justamente pra caber aqui, sem relogio e sem Firestore.
 * O teste de ponta a ponta (trava de verdade contra o Firestore em memoria) so roda depois da hora
 * da trava -- ele avisa quando pula.
 *
 *   node tools/test-liga-treinadores.js
 */
const path = require('path');
const Module = require('module');
const fake = require('./fake-firestore');

const db = fake.makeDb();
const notificacoes = [];
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
const dividir = fns._trainersLeagueSplitGroups;
const gente = n => Array.from({length:n}, (_,i)=>({ uid:'u'+i, name:'T'+i }));
function caso(n){
  const r = dividir(gente(n));
  return { ligas: r.groups.map(g=>g.length), amanha: r.leftover.length };
}

console.log('\nQUEM FORMA LIGA E QUEM FICA PRA AMANHA');
/* O caso do incidente: 4 inscritos e UM grupo so. O minimo (4) vale pro resto, nao pro dia. */
ok('4 inscritos formam a liga do dia', JSON.stringify(caso(4)) === JSON.stringify({ligas:[4], amanha:0}),
   JSON.stringify(caso(4)));
ok('2 inscritos ja sao liga', JSON.stringify(caso(2)) === JSON.stringify({ligas:[2], amanha:0}), JSON.stringify(caso(2)));
/* Um sozinho nao e liga: o round-robin sai com 0 rodadas. */
ok('1 inscrito nao forma, fica pra amanha', JSON.stringify(caso(1)) === JSON.stringify({ligas:[], amanha:1}),
   JSON.stringify(caso(1)));
ok('ninguem inscrito nao forma nada', JSON.stringify(caso(0)) === JSON.stringify({ligas:[], amanha:0}));
ok('16 inscritos: uma liga cheia', JSON.stringify(caso(16)) === JSON.stringify({ligas:[16], amanha:0}), JSON.stringify(caso(16)));
/* Aqui o minimo VOLTA a valer: uma liga ja se formou, entao o resto pequeno espera pra amanha
   em vez de virar uma liga de uma pessoa so. */
ok('17 inscritos: 16 jogam, 1 fica pra amanha', JSON.stringify(caso(17)) === JSON.stringify({ligas:[16], amanha:1}),
   JSON.stringify(caso(17)));
ok('20 inscritos: 16 jogam, 4 ficam pra amanha', JSON.stringify(caso(20)) === JSON.stringify({ligas:[16], amanha:4}),
   JSON.stringify(caso(20)));
ok('21 inscritos: 16 e 5 -- o resto passou do minimo', JSON.stringify(caso(21)) === JSON.stringify({ligas:[16,5], amanha:0}),
   JSON.stringify(caso(21)));
ok('30 inscritos: 16 e 14', JSON.stringify(caso(30)) === JSON.stringify({ligas:[16,14], amanha:0}), JSON.stringify(caso(30)));
ok('34 inscritos: duas cheias e 2 pra amanha', JSON.stringify(caso(34)) === JSON.stringify({ligas:[16,16], amanha:2}),
   JSON.stringify(caso(34)));
/* Ninguem pode ser esquecido: todo inscrito ou joga hoje ou esta na fila de amanha. */
let somaErrada = 0;
for(let n=0; n<=40; n++){
  const r = dividir(gente(n));
  if(r.groups.reduce((s,g)=>s+g.length,0) + r.leftover.length !== n) somaErrada++;
}
ok('nenhum inscrito some no caminho (0 a 40)', somaErrada === 0, somaErrada + ' contagens erradas');

/* ---- ponta a ponta: o ciclo NUNCA pode parar num estado transitorio ---- */
(async () => {
  console.log('\nO CICLO DO DIA NAO PODE FICAR PRESO EM "locking"');
  await fns.advanceTrainersLeague({});   // cria os ciclos de hoje e amanha
  const todos = await db.collection('trainersLeagueCycles').get();
  const ids = todos.docs.map(d=>d.id).sort();
  const hoje = ids[0];
  const cycleRef = db.collection('trainersLeagueCycles').doc(hoje);
  const antes = (await cycleRef.get()).data();
  console.log('  (ciclo do dia comecou em "' + antes.status + '" -- a trava so roda depois das 11h)');
  // com 1 inscrito o dia nao forma liga: o ciclo TEM que terminar num estado final, com motivo
  await cycleRef.set({ status:'registering' }, { merge:true });
  await cycleRef.collection('registrants').doc('u0').set({ uid:'u0', name:'T0', registeredAt: 1 });
  await fns.advanceTrainersLeague({});
  const depois = (await cycleRef.get()).data();
  /* 'registering' e um estado de REPOUSO legitimo (antes da hora da trava). O que nao pode
     acontecer nunca e ficar num estado TRANSITORIO, que e onde o ciclo de 31/08 ficou preso. */
  const preso = depois.status === 'locking' || depois.status === 'advancing';
  ok('o ciclo nunca fica preso num estado transitorio', !preso, 'status: ' + depois.status);
  if(depois.status === 'complete'){
    ok('e a tela tem como dizer por que nao teve liga', !!depois.noLeagueReason, 'motivo: ' + depois.noLeagueReason);
  }

  console.log('\n=== OS TIMES ELEGIVEIS: ORDEM DE SLOT E LEITURA SO DO QUE EXISTE ===');
/* Esta funcao lia UMA REFERENCIA POR SLOT, existindo ou nao: com o teto em 20, um jogador com 1
   save custava 20 leituras por travamento de liga -- e isso roda uma vez por inscrito. Passou a ler
   a colecao, que cobra por documento devolvido.
   O RISCO DA TROCA e a ORDEM. O Firestore devolve por ID de documento em ordem de TEXTO, e ai o
   slot "10" cai ENTRE o "1" e o "2". O time de cada rodada e sorteado por INDICE nesta lista, com
   semente, e o cliente refaz o mesmo sorteio pra mostrar quem vai lutar -- ordens diferentes fazem
   a tela mostrar um time e a batalha usar outro. So aparece pra quem tem mais de 10 saves, ou seja,
   exatamente depois de subir o teto. */
/* O arquivo inteiro ja roda dentro de um async: sem o await aqui, este bloco terminaria DEPOIS
   do resumo -- imprimia o titulo e nenhuma checagem, e o teste passava sem testar. */
await (async function(){
  const TIME = (esp) => [{ id:'m0', speciesId:esp, level:70, shiny:false }];
  const saves = db.collection('users').doc('ordem').collection('saves');
  /* Grava FORA de ordem de proposito -- se a funcao devolvesse na ordem de gravacao, isso passaria
     despercebido. */
  for(const slot of [12, 3, 0, 10, 1, 2]){
    await saves.doc(String(slot)).set({ badgeCount:8, team: TIME('charizard') });
  }
  const codes = await fns._trainersLeagueGatherEligibleCodes('ordem');
  ok('devolve um codigo por save elegivel', codes.length === 6, codes.length + ' codigos');
  /* A prova da ordem: cada save recebe uma especie diferente, e a lista tem que sair na ordem
     NUMERICA do slot. Com a ordem de texto do Firestore, o slot 10 e o 12 viriam depois do 1. */
  const ESPECIES = { 0:'bulbasaur', 1:'charmander', 2:'squirtle', 3:'pikachu', 10:'snorlax', 12:'gyarados' };
  for(const slot of Object.keys(ESPECIES)){
    await saves.doc(String(slot)).set({ badgeCount:8, team: TIME(ESPECIES[slot]) });
  }
  const codes2 = await fns._trainersLeagueGatherEligibleCodes('ordem');
  const ordem = codes2.map(c => (fns._decodeTeamCode ? fns._decodeTeamCode(c) : [{speciesId:c}])[0].speciesId);
  const esperada = [0,1,2,3,10,12].map(s => ESPECIES[s]);
  ok('e na ordem NUMERICA do slot, nao na de texto do Firestore',
     JSON.stringify(ordem) === JSON.stringify(esperada), ordem.join(',') + '   (esperado ' + esperada.join(',') + ')');

  /* Save sem as 8 insignias nao entra, e slot fora do teto tambem nao. */
  await saves.doc('4').set({ badgeCount:3, team: TIME('onix') });
  await saves.doc('99').set({ badgeCount:8, team: TIME('mewtwo') });
  const codes3 = await fns._trainersLeagueGatherEligibleCodes('ordem');
  ok('save sem as 8 insignias fica de fora', codes3.length === 6, codes3.length + ' codigos');
  ok('e slot acima do teto tambem', codes3.length === 6);

  /* Conta sem save nenhum: antes isso custava o teto inteiro em leituras. */
  const vazio = await fns._trainersLeagueGatherEligibleCodes('nao-existe');
  ok('conta sem save devolve lista vazia', Array.isArray(vazio) && vazio.length === 0);
})();

console.log('\n=== A RODADA GRAVA O LOG, E SO ENTAO NOTIFICA ===');
/* O INCIDENTE DE 13/09/2026: um treinador recebeu 285 notificacoes iguais de "Voce perdeu na
   Trainers League", uma por minuto, e o outro 91. A liga de 11, 12 e 13/09 nunca terminou.

   Eram TRES defeitos em fila, e nenhum teste via nenhum deles:
   1. a Danca da Chuva gravava `chuva: comChuva || undefined` em cada confronto do log. O Firestore
      RECUSA undefined -- e recusa a gravacao INTEIRA, nao o campo. O fake-firestore clonava com
      JSON.parse(JSON.stringify()), que descarta undefined em silencio, entao a bateria ficava verde;
   2. a notificacao era criada ANTES do `ref.set`. Falhando a gravacao, o catch devolve o ciclo pra
      'locked' e o agendador (de minuto em minuto) refaz tudo -- inclusive as notificacoes;
   3. e a condicao `if(match.matchups && ...)` era lida DEPOIS do storeMatchLogAndStrip, que zera o
      campo quando consegue gravar: no caminho que da certo, a notificacao nao saia nunca.
   Os tres sao cobrados aqui, e o 1 tambem la dentro do fake (que agora recusa undefined). */
await (async function(){
  const TIME = (esp) => [{ id:'m0', speciesId:esp, level:70, shiny:false },
                         { id:'m1', speciesId:'gyarados', level:68, shiny:false }];
  for(const [uid, esp] of [['aa','venusaur'], ['bb','charizard']]){
    await db.collection('users').doc(uid).collection('saves').doc('0')
      .set({ badgeCount:8, team: TIME(esp) });
  }
  const codesA = await fns._trainersLeagueGatherEligibleCodes('aa');
  const codesB = await fns._trainersLeagueGatherEligibleCodes('bb');

  const HOJE = fns._trainersLeagueTodayDateStr();
  const ref = () => db.collection('trainersLeagueCycles').doc(HOJE);
  const montar = async () => {
    await ref().set({
      dateId: HOJE, status:'locked', currentRound: 0,
      players: [{ uid:'aa', name:'A', elite:false, eligibleCodes:codesA, specialties:[], mewtwoTeamCode:null },
                { uid:'bb', name:'B', elite:false, eligibleCodes:codesB, specialties:[], mewtwoTeamCode:null }],
      scheduleRounds: [{ matches: [{ a:{ uid:'aa', name:'A', code:codesA[0], specialties:[] },
                                      b:{ uid:'bb', name:'B', code:codesB[0], specialties:[] },
                                      winner:null, matchups:null, resolved:false, terrain:null }] }],
      roundTimes: [Date.now() - 60000], siblingCycleIds: [],
      lockedAt: Date.now(), updatedAt: Date.now()
    }, { merge:false });
  };
  const avisos = async (uid) => (await db.collection('users').doc(uid).collection('notifications').get())
    .docs.map(d=>d.data()).filter(n=>n.type === 'match_played');
  const limparAvisos = async (uid) => {
    const snap = await db.collection('users').doc(uid).collection('notifications').get();
    for(const d of snap.docs) await db.collection('users').doc(uid).collection('notifications').doc(d.id).delete();
  };

  /* ---- 1) o caminho que DA CERTO: log gravado e UMA notificacao de cada lado ---- */
  await montar();
  await limparAvisos('aa'); await limparAvisos('bb');
  await fns.advanceTrainersLeague({});
  const dep = (await ref().get()).data();
  ok('a partida fica resolvida', dep.scheduleRounds[0].matches[0].resolved === true);
  ok('e o ciclo fecha o dia', dep.status === 'complete', 'status: ' + dep.status);
  const logs = await ref().collection('matchLogs').get();
  ok('o log da batalha foi gravado', logs.docs.length === 1, logs.docs.length + ' log(s)');
  if(logs.docs.length){
    const m = (logs.docs[0].data().matchups) || [];
    ok('e ele tem os confrontos dentro', m.length > 0, m.length + ' confrontos');
  }
  /* ⚠️ ESTE E O DEFEITO 3: com a condicao lida depois do strip, isto dava ZERO dos dois lados. */
  ok('o vencedor e avisado UMA vez', (await avisos('aa')).length === 1, (await avisos('aa')).length + ' aviso(s)');
  ok('o perdedor tambem', (await avisos('bb')).length === 1, (await avisos('bb')).length + ' aviso(s)');

  /* ---- 2) o caminho que FALHA: ninguem pode ser avisado de um resultado que nao foi salvo ---- */
  let recusarEscrita = false;
  const collOriginal = db.collection.bind(db);
  db.collection = (nome) => {
    const c = collOriginal(nome);
    if(nome !== 'trainersLeagueCycles') return c;
    const docOriginal = c.doc.bind(c);
    c.doc = (id) => {
      const d = docOriginal(id);
      const setOriginal = d.set.bind(d);
      d.set = async (patch, opts) => {
        if(recusarEscrita) throw new Error('gravacao recusada de proposito (simula o undefined)');
        return setOriginal(patch, opts);
      };
      return d;
    };
    return c;
  };
  await montar();
  await limparAvisos('aa'); await limparAvisos('bb');
  recusarEscrita = true;
  await fns.advanceTrainersLeague({});
  await fns.advanceTrainersLeague({});
  await fns.advanceTrainersLeague({});   // tres passadas do agendador, como os tres minutos do incidente
  recusarEscrita = false;
  const spamA = (await avisos('aa')).length, spamB = (await avisos('bb')).length;
  ok('gravacao que falha NAO notifica ninguem', spamA === 0 && spamB === 0, spamA + ' e ' + spamB + ' aviso(s)');
  db.collection = collOriginal;

  /* ---- 3) e a trava que teria pegado a causa: um log de batalha DE VERDADE no banco ---- */
  const res = fns._simulateGymBattle(fns._decodeTeamCode(codesA[0]), fns._decodeTeamCode(codesB[0]),
                                     fns._makeSeededRng('undef'));
  let recusou = null;
  try{ await db.collection('provaDeLog').doc('1').set({ matchups: res.matchups, updatedAt: 1 }); }
  catch(e){ recusou = e.message; }
  ok('o log de uma batalha real cabe no Firestore (sem undefined)', recusou === null, recusou || '');
  /* e o fake precisa MESMO recusar, senao a linha acima nao prova nada */
  let pegou = false;
  try{ await db.collection('provaDeLog').doc('2').set({ a:[{ b: undefined }] }); } catch(e){ pegou = true; }
  ok('e o fake recusa undefined, como o Firestore de verdade', pegou);
})();

console.log(falhas ? '\n' + falhas + ' FALHA(S)\n' : '\nTudo certo.\n');
  process.exit(falhas ? 1 : 0);
})();
